"""services/rag/sources/transcript_source.py
Earnings-call transcripts — the corpus FinEdge does not hand over directly.

FinEdge's `investor-call-transcripts` endpoint returns metadata plus a
`pdf_file_link` pointing at the exchange's own archive (nsearchives.nseindia.com).
There is no text field: the transcript IS the PDF. So this module does the step
the rest of the app never had to — it downloads the PDF and extracts its text —
because a question like "what did management say about margins last quarter"
cannot be answered from an announcement headline.

Three things are deliberate here:

  * The download does NOT go through services/finedge_service.py. That module
    is a proxy for the FinEdge JSON API — rate-limited against FinEdge's quota,
    JSON-decoded, TTL-cached in Redis. A 1 MB binary from a completely
    different host (the NSE archive) shares none of those concerns, and
    pushing it through would both mis-account FinEdge's rate budget and try to
    JSON-parse a PDF. The metadata call above it DOES use the proxy, correctly.

  * A browser-style User-Agent and Referer are sent. nsearchives serves
    exchange filings and refuses default library user agents — verified live
    against real transcript URLs while building this.

  * Extraction failure is expected, not exceptional. Some filings are scanned
    images with no text layer at all; those yield a handful of characters over
    dozens of pages. _looks_like_scanned catches that and skips the document
    rather than indexing whitespace, which would otherwise occupy a chunk slot
    and dilute retrieval for that company forever.
"""
import asyncio
import io
import logging
import re
from datetime import datetime, timedelta, timezone

import httpx
from pypdf import PdfReader
from sqlalchemy import select

from core.config import settings
from core.database import async_session_maker
from models.models import RagDocument
from services.finedge_service import execute_proxy_request
from services.rag.chunking import normalise_text
from services.rag.schemas import RagSourceDocument, SourceType

logger = logging.getLogger("services.rag.sources.transcript")

# The NSE archive rejects non-browser clients. Verified live: the default httpx
# User-Agent gets a block page, this gets the PDF.
_ARCHIVE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
    "Referer": "https://www.nseindia.com/",
}

# How far back to ask FinEdge for filings. Two years comfortably covers
# RAG_TRANSCRIPTS_PER_SYMBOL quarters even for a company that skipped a call,
# and services/finedge_service.py already clamps a symbol-scoped query to 730
# days anyway.
_LOOKBACK_DAYS = 730

_QUARTER_RE = re.compile(r"\bQ([1-4])\s*[-/ ]?\s*(?:FY)?\s*(\d{2,4})", re.IGNORECASE)


def _extract_quarter(description: str, announced: datetime | None) -> str:
    """A human-readable "Q2 FY26" label for the citation and the chunk header.

    Worth the effort because quarter is how people REFER to a call ("the Q2
    call"), so having it in the chunk header is what lets a question phrased
    that way match the right transcript instead of the most recent one.
    """
    match = _QUARTER_RE.search(description or "")
    if match:
        quarter, year = match.group(1), match.group(2)
        year = year[-2:]
        return f"Q{quarter} FY{year}"
    if announced:
        # Indian financial year runs April-March, and a transcript is filed
        # within weeks of the quarter it covers.
        quarter_by_month = {4: "Q4", 5: "Q4", 6: "Q1", 7: "Q1", 8: "Q1", 9: "Q2",
                            10: "Q2", 11: "Q2", 12: "Q3", 1: "Q3", 2: "Q3", 3: "Q4"}
        quarter = quarter_by_month.get(announced.month, "Q1")
        financial_year = announced.year + 1 if announced.month >= 4 else announced.year
        return f"{quarter} FY{str(financial_year)[2:]}"
    return "recent quarter"


def _parse_date(raw: str | None) -> datetime | None:
    if not raw:
        return None
    for pattern in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw.strip()[:19], pattern).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _looks_like_scanned(text: str, page_count: int) -> bool:
    """A text-layer PDF yields roughly 1500-3500 characters per page of speech.
    Under ~200 means the pages are images and pypdf only recovered stray
    headers — there is nothing to retrieve, so indexing it would cost an
    embedding call and permanently occupy a chunk slot with noise."""
    if page_count <= 0:
        return True
    return (len(text) / page_count) < 200


async def _fetch_transcript_list(symbol: str, limit: int) -> list[dict]:
    now = datetime.now(timezone.utc)
    query = {
        "symbol": symbol.upper(),
        "from_date": (now - timedelta(days=_LOOKBACK_DAYS)).strftime("%Y-%m-%d"),
        "to_date": now.strftime("%Y-%m-%d"),
    }
    try:
        data = await execute_proxy_request(
            "GET", "investor-call-transcripts", query, None, f"rag-transcripts-{symbol}"
        )
    except Exception as exc:
        logger.warning("[rag.transcripts] %s — FinEdge lookup failed: %s", symbol, exc)
        return []

    if not isinstance(data, list):
        return []

    items = [item for item in data if isinstance(item, dict) and
             (item.get("pdf_file_link") or item.get("pdf_file_link_hist"))]
    # Newest first, so RAG_TRANSCRIPTS_PER_SYMBOL means "the most recent N
    # quarters" rather than an arbitrary N.
    items.sort(key=lambda item: item.get("timestamp_unix") or 0, reverse=True)
    return items[:limit]


async def _download_pdf_text(client: httpx.AsyncClient, url: str) -> tuple[str, int] | None:
    response = await client.get(url, headers=_ARCHIVE_HEADERS)
    response.raise_for_status()
    content = response.content

    if len(content) > settings.RAG_TRANSCRIPT_MAX_BYTES:
        logger.warning("[rag.transcripts] %s is %d bytes — over the cap, skipped", url, len(content))
        return None
    if not content.startswith(b"%PDF"):
        logger.warning("[rag.transcripts] %s did not return a PDF (got %s)", url,
                       response.headers.get("content-type"))
        return None

    # pypdf is fully synchronous and CPU-bound; a 40-page parse would otherwise
    # block the event loop and stall every concurrent request on the server.
    def _parse() -> tuple[str, int]:
        reader = PdfReader(io.BytesIO(content))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(pages), len(reader.pages)

    return await asyncio.to_thread(_parse)


async def _already_indexed_urls() -> set[str]:
    async with async_session_maker() as session:
        rows = (
            await session.execute(
                select(RagDocument.source_key).where(RagDocument.source_type == SourceType.TRANSCRIPT)
            )
        ).scalars().all()
    return set(rows)


async def build_transcript_documents(
    symbols: list[str],
    per_symbol: int | None = None,
) -> list[RagSourceDocument]:
    """Fetch and extract the most recent transcripts for each symbol.

    Unlike the other sources, this one pre-filters against rag_documents
    instead of letting the indexer's content-hash check do it. That check
    happens AFTER the document is built, and building one here means
    downloading and parsing a multi-megabyte PDF from the exchange archive —
    so relying on it alone meant every index cycle re-downloaded every
    transcript it already had, purely to throw the result away. An exchange
    filing at a given archive URL is also immutable (a correction is published
    at a new URL), which is what makes skipping the hash check safe here.
    """
    per_symbol = per_symbol or settings.RAG_TRANSCRIPTS_PER_SYMBOL
    if not symbols or per_symbol <= 0:
        return []

    indexed_urls = await _already_indexed_urls()
    documents: list[RagSourceDocument] = []
    async with httpx.AsyncClient(follow_redirects=True, timeout=httpx.Timeout(60.0)) as client:
        for symbol in symbols:
            items = await _fetch_transcript_list(symbol, per_symbol)
            if not items:
                logger.info("[rag.transcripts] %s — no transcripts available from FinEdge", symbol)
                continue

            for item in items:
                url = item.get("pdf_file_link") or item.get("pdf_file_link_hist") or ""
                if not url or url in indexed_urls:
                    continue
                announced = _parse_date(item.get("announcement_date"))
                description = item.get("description") or ""
                quarter = _extract_quarter(description, announced)

                try:
                    extracted = await _download_pdf_text(client, url)
                except Exception as exc:
                    logger.warning("[rag.transcripts] %s — download failed for %s: %s", symbol, url, exc)
                    continue
                if extracted is None:
                    continue

                text, page_count = extracted
                text = normalise_text(text)
                if _looks_like_scanned(text, page_count):
                    logger.info(
                        "[rag.transcripts] %s — %s looks scanned (%d chars over %d pages), skipped",
                        symbol, url.rsplit("/", 1)[-1], len(text), page_count,
                    )
                    continue

                documents.append(
                    RagSourceDocument(
                        source_type=SourceType.TRANSCRIPT,
                        # The archive URL is the transcript's identity: the
                        # same call re-announced keeps the same file, and a
                        # corrected re-upload gets a new one. Neither the date
                        # nor the quarter label is reliable enough to key on.
                        source_key=url,
                        title=f"{symbol} — {quarter} earnings call transcript",
                        text=text,
                        symbol=symbol.upper(),
                        url=url,
                        doc_date=announced,
                        metadata={
                            "quarter": quarter,
                            "pages": page_count,
                            "description": description[:400],
                            "category": item.get("category"),
                        },
                    )
                )
                logger.info(
                    "[rag.transcripts] %s — %s: %d pages, %d chars",
                    symbol, quarter, page_count, len(text),
                )

    return documents
