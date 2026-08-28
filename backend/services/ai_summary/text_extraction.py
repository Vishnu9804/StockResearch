"""
services/ai_summary/text_extraction.py
Downloads one filing PDF (announcement, concall transcript, or investor
presentation) and extracts its text.

Deliberately its own small module rather than importing
services/rag/sources/transcript_source.py's downloader: that module is
concall-transcript-specific (its own docstring, its own log lines) and wired
into the Research Chat indexing pipeline. Reusing it here would either force
this feature to special-case "but I also need announcements and
presentations, not just transcripts" into a module that isn't expecting that,
or risk an edit made for THIS feature quietly changing behaviour for a
working, shipped one. The actual download+extract logic below is the same
proven shape (browser headers because the NSE archive blocks default
clients, a byte-size cap, a scanned-PDF heuristic) — duplicated on purpose,
kept small on purpose.
"""
import asyncio
import io
import logging

import httpx
from pypdf import PdfReader

from core.config import settings

logger = logging.getLogger("services.ai_summary.text_extraction")

# Verified live elsewhere in this codebase (services/rag/sources/
# transcript_source.py): the NSE archive rejects the default httpx User-Agent
# and serves a block page instead of the PDF.
_ARCHIVE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
    "Referer": "https://www.nseindia.com/",
}


def _looks_like_scanned(text: str, page_count: int) -> bool:
    """A text-layer PDF yields roughly 1500-3500 characters per page. Under
    ~200 means the pages are images and pypdf only recovered stray headers —
    there's no real content to summarise, and feeding a handful of
    near-empty characters to the model risks it inventing content to fill the
    gap instead of just saying "no readable text"."""
    if page_count <= 0:
        return True
    return (len(text) / page_count) < 200


async def extract_pdf_text(client: httpx.AsyncClient, url: str) -> tuple[str, int] | None:
    """Returns (extracted_text, page_count), or None if the document could
    not be read (too large, not actually a PDF, download failed, or looks
    scanned). None is the caller's signal to record this document as SKIPPED
    rather than silently dropped — see pipeline.py."""
    try:
        response = await client.get(url, headers=_ARCHIVE_HEADERS)
        response.raise_for_status()
    except Exception as exc:
        logger.warning("[ai_summary.text_extraction] download failed for %s: %s", url, exc)
        return None

    content = response.content
    if len(content) > settings.AI_SUMMARY_MAX_PDF_BYTES:
        logger.warning("[ai_summary.text_extraction] %s is %d bytes — over the cap, skipped", url, len(content))
        return None
    if not content.startswith(b"%PDF"):
        logger.warning(
            "[ai_summary.text_extraction] %s did not return a PDF (got %s)",
            url, response.headers.get("content-type"),
        )
        return None

    # pypdf is synchronous/CPU-bound — off the event loop so one large filing
    # can't stall every other concurrent request the server is handling.
    def _parse() -> tuple[str, int]:
        reader = PdfReader(io.BytesIO(content))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(pages).strip(), len(reader.pages)

    try:
        text, page_count = await asyncio.to_thread(_parse)
    except Exception as exc:
        logger.warning("[ai_summary.text_extraction] PDF parse failed for %s: %s", url, exc)
        return None

    if _looks_like_scanned(text, page_count):
        logger.info(
            "[ai_summary.text_extraction] %s looks scanned (%d chars over %d pages), skipped",
            url, len(text), page_count,
        )
        return None

    return text, page_count
