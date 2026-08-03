"""services/rag/retriever.py
Finds the passages that should be in front of the model when it answers.

Four stages, and each exists because the stage before it has a specific,
known blind spot:

  1. HYBRID SEARCH — an ANN pass over embeddings AND a Postgres full-text
     pass, run independently. Vector search alone cannot reliably hit exact
     identifiers: "PNCINFRA", "Q3FY26", "ROCE" are tokens whose meaning lives
     in their exact spelling, and an embedding smears that. Keyword search
     alone cannot bridge paraphrase: "is the company burning cash?" shares no
     words with "negative operating cash flow". Neither is optional.

  2. RECIPROCAL RANK FUSION — merges the two ranked lists by RANK, not by
     score. Cosine distance and ts_rank_cd are on incomparable scales; any
     attempt to weight the raw numbers against each other is arbitrary and
     breaks the moment either distribution shifts. RRF only needs "this was
     3rd in that list", which is scale-free.

  3. RE-RANKING — cheap, deterministic signals applied on top: does the chunk
     belong to a company the question actually named, how old is it, does it
     literally contain the question's rarer words, and is this the kind of
     source the question is asking for. This is where a second LLM call would
     normally go (a cross-encoder rerank), and it deliberately does not: this
     is the only user-facing per-question path in the product, and doubling
     its model cost to re-order twelve passages is not a trade worth making
     when the signals below already capture most of the benefit for free.

  4. DIVERSIFICATION — caps how many chunks any one document may contribute.
     A 40-page transcript will otherwise win every slot on a broad question,
     leaving the model with one source's view of a question that needed three.

Everything here is one round trip to Postgres plus one embedding call. No
chat-model tokens are spent.
"""
import logging
import math
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import text

from core.config import settings
from core.database import async_session_maker
from services.rag import embeddings
from services.rag.company_resolver import ResolvedCompany
from services.rag.schemas import SOURCE_LABELS, SourceType

logger = logging.getLogger("services.rag.retriever")


@dataclass(slots=True)
class RetrievedChunk:
    chunk_id: str
    document_id: str
    content: str
    source_type: str
    title: str | None
    url: str | None
    symbol: str | None
    doc_date: datetime | None
    metadata: dict = field(default_factory=dict)

    vector_rank: int | None = None
    keyword_rank: int | None = None
    fused_score: float = 0.0
    final_score: float = 0.0

    @property
    def source_label(self) -> str:
        return SOURCE_LABELS.get(self.source_type, self.source_type)


@dataclass(slots=True)
class RetrievalResult:
    chunks: list[RetrievedChunk]
    query_used: str
    symbols: list[str]
    # Everything needed to answer "why did it retrieve THAT?" later — stored on
    # the assistant message so a bad answer can be diagnosed as a retrieval
    # miss versus the model ignoring what it was handed.
    debug: dict


# ── Stage 1: the two searches ────────────────────────────────────────────────
# Written as raw SQL rather than ORM constructs. The vector half needs pgvector's
# `<=>` operator and the keyword half needs websearch_to_tsquery + ts_rank_cd;
# expressing either through the ORM would be a wrapper over a string anyway,
# and having both halves visible as SQL is what makes the fusion below
# reviewable.

_VECTOR_SQL = text("""
    select
        c.id::text            as chunk_id,
        c.document_id::text   as document_id,
        c.content             as content,
        c.source_type         as source_type,
        c.symbol              as symbol,
        c.doc_date            as doc_date,
        d.title               as title,
        d.url                 as url,
        d.metadata            as metadata,
        (c.embedding <=> cast(:query_vector as vector)) as distance
    from rag_chunks c
    join rag_documents d on d.id = c.document_id
    where c.embedding is not null
    order by c.embedding <=> cast(:query_vector as vector)
    limit :limit
""")

_KEYWORD_SQL = text("""
    select
        c.id::text            as chunk_id,
        c.document_id::text   as document_id,
        c.content             as content,
        c.source_type         as source_type,
        c.symbol              as symbol,
        c.doc_date            as doc_date,
        d.title               as title,
        d.url                 as url,
        d.metadata            as metadata,
        ts_rank_cd(c.tsv, query) as rank
    from rag_chunks c
    join rag_documents d on d.id = c.document_id
    cross join websearch_to_tsquery('english', :query_text) as query
    where c.tsv @@ query
    order by rank desc
    limit :limit
""")


def _row_to_chunk(row) -> RetrievedChunk:
    return RetrievedChunk(
        chunk_id=row.chunk_id,
        document_id=row.document_id,
        content=row.content,
        source_type=row.source_type,
        title=row.title,
        url=row.url,
        symbol=row.symbol,
        doc_date=row.doc_date,
        metadata=row.metadata if isinstance(row.metadata, dict) else {},
    )


# ── Stage 3 inputs: intent priors ────────────────────────────────────────────
# Which corpus a question is probably asking for. A small, explicit nudge —
# never a filter. A hard filter would mean a question phrased as "how do I..."
# could NEVER reach a company answer, and users phrase things unpredictably;
# a nudge lets the evidence win when the guess is wrong.
_INTENT_PATTERNS: list[tuple[re.Pattern, str, float]] = [
    (re.compile(r"\b(how do i|how can i|where (do|can) i|which page|navigate|button|"
                r"click|steps? to|set up|create a (custom )?ratio|save|screener page|"
                r"dashboard|log ?in|sign ?up|website|platform|app|feature)\b", re.I),
     SourceType.PLATFORM_HELP, 0.28),
    (re.compile(r"\b(said|say|commentary|management|guidance|concall|con ?call|"
                r"earnings call|analyst call|transcript|q&a|answered|outlook for|"
                r"capex plan|order book|guided)\b", re.I),
     SourceType.TRANSCRIPT, 0.22),
    (re.compile(r"\b(news|happened|announced|announcement|latest|today|yesterday|"
                r"this week|report(ed|s)?|headline|event|why did .* (fall|rise|drop|jump))\b", re.I),
     SourceType.NEWS, 0.18),
    (re.compile(r"\b(p ?/ ?e|pe ratio|valuation|market ?cap|roe|roce|margin|debt|"
                r"eps|book value|dividend|promoter|holding|revenue|profit|"
                r"balance sheet|cash flow|growth|ratio)\b", re.I),
     SourceType.COMPANY_FUNDAMENTALS, 0.18),
    (re.compile(r"\b(exposed|exposure|depends? on|supplier|customer|input cost|"
                r"raw material|commodity|currency|fx|export|import|sensitiv|"
                r"business model|competitor|peer|moat|risk)\b", re.I),
     SourceType.COMPANY_PROFILE, 0.18),
]

# Words too common in market English to say anything about which passage is
# right. Used only for the lexical-overlap bonus below.
_LEXICAL_STOPWORDS = {
    "what", "which", "when", "where", "how", "why", "who", "the", "a", "an",
    "is", "are", "was", "were", "be", "been", "do", "does", "did", "of", "in",
    "on", "for", "to", "and", "or", "but", "with", "about", "from", "by", "at",
    "as", "it", "its", "this", "that", "these", "those", "i", "me", "my", "you",
    "your", "we", "our", "can", "could", "should", "would", "will", "shall",
    "company", "companies", "stock", "share", "shares", "tell", "explain",
    "give", "show", "please", "any", "some", "more", "most", "much", "many",
}
_WORD_RE = re.compile(r"[a-z0-9]+")


def _intent_priors(question: str) -> dict[str, float]:
    priors: dict[str, float] = {}
    for pattern, source_type, weight in _INTENT_PATTERNS:
        if pattern.search(question):
            priors[source_type] = max(priors.get(source_type, 0.0), weight)
    return priors


def _content_words(text_value: str) -> set[str]:
    return {
        word for word in _WORD_RE.findall(text_value.lower())
        if len(word) > 2 and word not in _LEXICAL_STOPWORDS
    }


def _recency_bonus(source_type: str, doc_date: datetime | None) -> float:
    """Exponential decay, applied ONLY to the two corpora where age changes
    truth. A fundamentals sheet or a help topic is not less correct for being
    older, and decaying those would rank a stale-but-relevant fact below a
    fresh-but-irrelevant one."""
    if source_type not in (SourceType.NEWS, SourceType.TRANSCRIPT) or doc_date is None:
        return 0.0
    if doc_date.tzinfo is None:
        doc_date = doc_date.replace(tzinfo=timezone.utc)
    age_days = max(0.0, (datetime.now(timezone.utc) - doc_date).days)
    # Half-life: 10 days for news (a week-old story is background), 200 days
    # for transcripts (last quarter's call is still the current one).
    half_life = 10.0 if source_type == SourceType.NEWS else 200.0
    return 0.20 * math.exp(-age_days / half_life)


def _rerank(
    chunks: list[RetrievedChunk],
    question: str,
    symbols: set[str],
) -> list[RetrievedChunk]:
    priors = _intent_priors(question)
    question_words = _content_words(question)

    for chunk in chunks:
        score = chunk.fused_score

        # The single strongest signal available: the user named a company and
        # this passage is about that company. Weighted well above the fusion
        # score's own range so it cannot be out-voted by wording.
        if symbols and chunk.symbol and chunk.symbol.upper() in symbols:
            score += 0.45
        elif symbols and chunk.source_type == SourceType.NEWS:
            # A news chunk carries no symbol by design (see news_source.py), so
            # check the article's named companies instead — a smaller bonus,
            # since being mentioned is weaker than being the subject.
            mentioned = {str(s).upper() for s in (chunk.metadata.get("symbols") or [])}
            if symbols & mentioned:
                score += 0.20

        score += priors.get(chunk.source_type, 0.0)
        score += _recency_bonus(chunk.source_type, chunk.doc_date)

        # Literal overlap with the question's rarer words. Small on purpose —
        # the keyword half of the search already rewards this; here it only
        # breaks ties between passages the fusion scored close together.
        if question_words:
            overlap = len(question_words & _content_words(chunk.content)) / len(question_words)
            score += 0.15 * overlap

        chunk.final_score = score

    return sorted(chunks, key=lambda c: c.final_score, reverse=True)


def _diversify(chunks: list[RetrievedChunk], max_chunks: int, max_chars: int) -> list[RetrievedChunk]:
    """Take the best chunks subject to a per-document cap and a total size cap.

    Two passes, and the second one matters: if the per-document cap leaves the
    context under-filled (a question genuinely about ONE transcript), the
    leftovers from that document are added back rather than sending the model a
    half-empty context out of principle.
    """
    per_document: dict[str, int] = {}
    selected: list[RetrievedChunk] = []
    deferred: list[RetrievedChunk] = []
    used_chars = 0

    for chunk in chunks:
        if len(selected) >= max_chunks or used_chars >= max_chars:
            break
        count = per_document.get(chunk.document_id, 0)
        if count >= settings.RAG_MAX_CHUNKS_PER_DOC:
            deferred.append(chunk)
            continue
        if used_chars + len(chunk.content) > max_chars and selected:
            continue
        selected.append(chunk)
        per_document[chunk.document_id] = count + 1
        used_chars += len(chunk.content)

    for chunk in deferred:
        if len(selected) >= max_chunks or used_chars + len(chunk.content) > max_chars:
            continue
        selected.append(chunk)
        used_chars += len(chunk.content)

    return selected


async def retrieve(
    question: str,
    companies: list[ResolvedCompany] | None = None,
    max_chunks: int | None = None,
) -> RetrievalResult:
    """Run the full pipeline for one question and return the chosen passages."""
    max_chunks = max_chunks or settings.RAG_CONTEXT_CHUNKS
    symbols = {company.symbol.upper() for company in (companies or [])}

    # Embedding failure must not take the whole answer down: the keyword half
    # alone still finds exact-term matches, which is a degraded but genuinely
    # useful search. Losing quota should cost quality, not availability.
    query_vector: list[float] | None = None
    embedding_error: str | None = None
    try:
        query_vector = await embeddings.embed_query(question)
    except Exception as exc:
        embedding_error = f"{type(exc).__name__}: {exc}"
        logger.warning("[rag.retriever] query embedding failed, keyword-only fallback: %s", exc)

    vector_rows: list = []
    keyword_rows: list = []
    async with async_session_maker() as session:
        if query_vector is not None:
            vector_rows = (
                await session.execute(
                    _VECTOR_SQL,
                    {
                        # pgvector accepts its text input form; the cast in the
                        # SQL above turns it back into a vector server-side.
                        "query_vector": "[" + ",".join(f"{v:.7f}" for v in query_vector) + "]",
                        "limit": settings.RAG_VECTOR_CANDIDATES,
                    },
                )
            ).all()

        # websearch_to_tsquery is the forgiving parser — it accepts whatever a
        # human types (including quotes and OR) and never raises on malformed
        # input, unlike to_tsquery, which would turn an ordinary question mark
        # into a 500.
        keyword_rows = (
            await session.execute(
                _KEYWORD_SQL,
                {"query_text": question, "limit": settings.RAG_KEYWORD_CANDIDATES},
            )
        ).all()

    # ── Stage 2: reciprocal rank fusion ──────────────────────────────────────
    by_id: dict[str, RetrievedChunk] = {}
    rrf_k = settings.RAG_RRF_K

    for rank, row in enumerate(vector_rows, start=1):
        chunk = by_id.setdefault(row.chunk_id, _row_to_chunk(row))
        chunk.vector_rank = rank
        chunk.fused_score += 1.0 / (rrf_k + rank)

    for rank, row in enumerate(keyword_rows, start=1):
        chunk = by_id.setdefault(row.chunk_id, _row_to_chunk(row))
        chunk.keyword_rank = rank
        chunk.fused_score += 1.0 / (rrf_k + rank)

    ranked = _rerank(list(by_id.values()), question, symbols)
    selected = _diversify(ranked, max_chunks, settings.RAG_CONTEXT_MAX_CHARS)

    logger.info(
        "[rag.retriever] vector=%d keyword=%d fused=%d selected=%d symbols=%s",
        len(vector_rows), len(keyword_rows), len(by_id), len(selected),
        ",".join(sorted(symbols)) or "-",
    )

    return RetrievalResult(
        chunks=selected,
        query_used=question,
        symbols=sorted(symbols),
        debug={
            "vectorCandidates": len(vector_rows),
            "keywordCandidates": len(keyword_rows),
            "fusedCandidates": len(by_id),
            "selected": [
                {
                    "chunkId": chunk.chunk_id,
                    "sourceType": chunk.source_type,
                    "title": chunk.title,
                    "symbol": chunk.symbol,
                    "vectorRank": chunk.vector_rank,
                    "keywordRank": chunk.keyword_rank,
                    "finalScore": round(chunk.final_score, 5),
                }
                for chunk in selected
            ],
            "intentPriors": _intent_priors(question),
            "embeddingError": embedding_error,
        },
    )
