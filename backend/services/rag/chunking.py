"""services/rag/chunking.py
Splits a document's text into retrievable passages.

Two shapes of source feed this, and they need opposite treatment:

  * Short structured records (a company fundamentals sheet, a news article, a
    help topic) are ALREADY the right size and are self-contained. Splitting
    them would strip each half of the context that makes the other half
    interpretable — "ROE 14.2%" retrieved without the company name attached is
    worse than useless. These pass through as one chunk.

  * Concall transcripts are 20-40 page PDFs of continuous speech. These need
    real splitting, and the split must respect where the text naturally
    breaks: cutting mid-sentence produces a chunk whose embedding describes
    half a thought.

Both cases go through `split_text`; the first simply never exceeds the
threshold. Everything is character-based rather than token-based on purpose —
a tokenizer would be a heavyweight extra dependency to make a boundary
decision that "~4 chars per token" already gets right to within a few percent
for English prose.
"""
import re

from core.config import settings

# Paragraph first (the strongest semantic boundary in a transcript — usually a
# speaker change), then sentence, then line. Never split on a bare space: a
# chunk ending mid-sentence is exactly what this ordering exists to avoid.
_PARAGRAPH_BREAK = re.compile(r"\n\s*\n")
_SENTENCE_END = re.compile(r"(?<=[.!?])\s+")


def estimate_tokens(text: str) -> int:
    """~4 characters per token for English. Used for budgeting and for the
    stored token_estimate, never for a hard API limit."""
    return max(1, len(text) // 4)


def normalise_text(text: str) -> str:
    """Collapse the whitespace damage PDF extraction leaves behind.

    pypdf reconstructs text from glyph positions, so a two-column or
    generously-leaded page comes back with runs of spaces mid-line and stray
    single newlines inside sentences. Left alone, that noise ends up inside
    the embedding and inside the tsvector, degrading both halves of retrieval.
    Blank lines are preserved because they are the paragraph boundary the
    splitter relies on.
    """
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t\f\v]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _split_oversized(segment: str, max_chars: int) -> list[str]:
    """Last resort for a 'paragraph' with no internal break — typically a PDF
    page that extracted as one unbroken run. Sentence boundaries first, and
    only a hard character cut if even a single sentence exceeds the limit."""
    if len(segment) <= max_chars:
        return [segment]

    pieces: list[str] = []
    buffer = ""
    for sentence in _SENTENCE_END.split(segment):
        if not sentence:
            continue
        candidate = f"{buffer} {sentence}".strip() if buffer else sentence
        if len(candidate) <= max_chars:
            buffer = candidate
            continue
        if buffer:
            pieces.append(buffer)
        while len(sentence) > max_chars:
            pieces.append(sentence[:max_chars])
            sentence = sentence[max_chars:]
        buffer = sentence
    if buffer:
        pieces.append(buffer)
    return pieces


def split_text(
    text: str,
    max_chars: int | None = None,
    overlap_chars: int | None = None,
) -> list[str]:
    """Split `text` into chunks of at most `max_chars`, overlapping by
    `overlap_chars`.

    The overlap is what keeps an answer that straddles a boundary retrievable:
    without it, a question whose evidence spans the last two sentences of one
    chunk and the first two of the next matches neither chunk well.
    """
    max_chars = max_chars or settings.RAG_CHUNK_CHARS
    overlap_chars = settings.RAG_CHUNK_OVERLAP_CHARS if overlap_chars is None else overlap_chars
    # An overlap at/above half the chunk size makes each chunk mostly a copy of
    # its neighbour — inflating both embedding cost and duplicate retrieval
    # hits for no added recall.
    overlap_chars = max(0, min(overlap_chars, max_chars // 2))

    text = normalise_text(text)
    if not text:
        return []
    if len(text) <= max_chars:
        return [text]

    segments: list[str] = []
    for paragraph in _PARAGRAPH_BREAK.split(text):
        paragraph = paragraph.strip()
        if paragraph:
            segments.extend(_split_oversized(paragraph, max_chars))

    chunks: list[str] = []
    buffer = ""
    for segment in segments:
        candidate = f"{buffer}\n\n{segment}" if buffer else segment
        if len(candidate) <= max_chars:
            buffer = candidate
            continue
        if buffer:
            chunks.append(buffer)
            # Carry the tail of the finished chunk into the next one. Cut at a
            # whitespace boundary so the overlap starts on a whole word.
            tail = buffer[-overlap_chars:] if overlap_chars else ""
            space = tail.find(" ")
            buffer = (tail[space + 1:] + "\n\n" + segment).strip() if space != -1 else segment
        else:
            buffer = segment
    if buffer:
        chunks.append(buffer)

    return [chunk for chunk in chunks if chunk.strip()]
