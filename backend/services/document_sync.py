"""
services/document_sync.py
Populates/refreshes the persisted `company_documents` table — "what PDFs does
FinEdge have for this company" — for EVERY listed company, not only ones a
user happens to hold or watch.

This is the single source of truth two independent features read from:
  - routers/finedge.py::get_documents        the company page's Documents tab
  - services/rag/sources/transcript_source.py Research Chat's transcript fetch

Both used to call FinEdge live, independently, every time they needed this
list. That meant (a) a page load or a first chat question about a company
always paid a live round trip, and (b) the two features could drift — one
finding a filing the other's independent call happened to miss. Fetching once
into a shared table fixes both.

`fetch_documents_for_symbol` is deliberately the ONLY place the corp-
announcements/investor-presentations classification logic lives. It used to be
inlined in routers/finedge.py; it is factored out here so the background sync
and any live fallback call the exact same function and can never disagree
about what category a filing belongs to.

Cadence: see core/config.py:DOCUMENT_SYNC_* for why a same-order-of-magnitude
cadence to the fundamentals sync (documents change on the order of months, not
minutes) is still run at a similar rolling-batch pace — being faster than
strictly necessary here is cheap (2 lightweight, upstream-cached calls per
symbol) and buys a shorter cold-start window for any company nobody has asked
about yet.
"""

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.models import CompanyDocument, CompanyMetric
from services.finedge_service import execute_proxy_request

logger = logging.getLogger("document_sync")

_LOOKBACK_DAYS = 2 * 365


def _classify(item: dict) -> str:
    """Same keyword rules routers/finedge.py used inline before this module
    existed — moved here, not changed, so a filing already seen keeps the
    category a user has already looked at."""
    text = f"{item.get('category', '')} {item.get('description', '')}".lower()
    if "annual report" in text:
        return "annual-report"
    if any(x in text for x in [
        "concall", "con. call", "conference call", "earnings call",
        "institutional investor meet", "analyst meet", "investor meet",
        "earnings press conference", "audio and video recording",
        "transcript of the analyst",
    ]):
        return "concall"
    if any(x in text for x in [
        "credit rating", "crisil", "icra", "care ratings", "care edge",
        "india ratings", "ind-ra", "rating agency", "rating action",
    ]):
        return "credit-rating"
    return "announcement"


def _real_pdf_url(item: dict) -> str:
    """A real link, or "" — never the placeholder junk FinEdge sometimes sends.

    Verified live: some items carry `pdf_file_link: "-"` instead of omitting
    the field for a filing with no attached PDF. A bare truthiness check lets
    that through as if it were a URL, and when TWO such items land in the same
    symbol (a real, reproducible case — HDFCBANK did this), Postgres rejects
    the whole INSERT with "ON CONFLICT DO UPDATE command cannot affect row a
    second time" because both rows resolve to the identical (symbol, "-")
    conflict key. Requiring an actual http(s) URL is what a placeholder can
    never satisfy.
    """
    url = (item.get("pdf_file_link") or item.get("pdf_file_link_hist") or "").strip()
    return url if url.startswith("http") else ""


def _parse_filed_date(raw: str | None) -> date | None:
    if not raw:
        return None
    try:
        return datetime.strptime(raw.split(" ")[0], "%Y-%m-%d").date()
    except ValueError:
        return None


async def fetch_documents_for_symbol(symbol: str, request_id: str) -> list[dict[str, Any]]:
    """Live FinEdge fetch + classification for ONE symbol. Returns rows shaped
    for company_documents (symbol/category/title/filed_date/pdf_url/source_ref).

    Two calls, same pair routers/finedge.py always made: corp-announcements
    (classified by keyword — annual reports, concalls, credit ratings, and
    everything else falls back to a plain announcement) and
    investor-presentations (its own dedicated, more reliable feed, so it
    never needs keyword-guessing). Both go through execute_proxy_request, so
    they share the same global FinEdge rate limit and TTL cache as every other
    call in this app — this function adds no new load pattern, only a shared
    place its result gets written down.
    """
    import asyncio

    symbol = symbol.upper()
    today = datetime.now(timezone.utc)
    query = {
        "symbol": symbol,
        "from_date": (today - timedelta(days=_LOOKBACK_DAYS)).strftime("%Y-%m-%d"),
        "to_date": today.strftime("%Y-%m-%d"),
    }

    async def safe(coro):
        try:
            return await coro
        except Exception as exc:
            logger.warning("[document_sync] %s — fetch failed: %s", symbol, exc)
            return None

    announcements, presentations = await asyncio.gather(
        safe(execute_proxy_request("GET", "corp-announcements", query, None, request_id)),
        safe(execute_proxy_request("GET", "investor-presentations", query, None, request_id)),
    )

    rows: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    if isinstance(announcements, list):
        for item in announcements:
            pdf_url = _real_pdf_url(item)
            if not pdf_url or pdf_url in seen_urls:
                # The second condition matters as much as the first: FinEdge
                # has also been seen to repeat the identical item twice in one
                # response for the same symbol, which is the same "duplicate
                # conflict key in one INSERT" failure as the placeholder case
                # above, just from a different cause.
                continue
            seen_urls.add(pdf_url)
            rows.append({
                "symbol": symbol,
                "category": _classify(item),
                "title": (item.get("description") or item.get("category") or "Regulatory Filing")[:200],
                "filed_date": _parse_filed_date(item.get("announcement_date")),
                "pdf_url": pdf_url,
                "source_ref": str(item.get("timestamp_unix") or ""),
            })

    if isinstance(presentations, list):
        for item in presentations:
            pdf_url = _real_pdf_url(item)
            # Presentations get their own dedicated feed but can legitimately
            # overlap with corp-announcements for the same filing, and can
            # repeat within their own response too — skip anything already
            # captured above (from either feed) so the same PDF never appears
            # twice in the same company's document list or the same INSERT.
            if not pdf_url or pdf_url in seen_urls:
                continue
            seen_urls.add(pdf_url)
            rows.append({
                "symbol": symbol,
                "category": "presentation",
                "title": (item.get("description") or item.get("category") or "Investor Presentation")[:200],
                "filed_date": _parse_filed_date(item.get("announcement_date")),
                "pdf_url": pdf_url,
                "source_ref": str(item.get("timestamp_unix") or ""),
            })

    return rows


async def _write_documents(db: AsyncSession, symbol: str, rows: list[dict[str, Any]]) -> None:
    """Upsert into company_documents and stamp company_metrics.documents_synced_at
    — done together, in the caller's transaction, so a symbol can never end up
    marked "synced" without its rows actually landing (or vice versa)."""
    if rows:
        # asyncpg's bound-parameter ceiling is nowhere near reachable at
        # per-symbol volumes (a company rarely has more than a few hundred
        # filings in a 2-year window), so this is one statement, not chunked
        # like sync_quote_data's whole-universe upsert has to be.
        statement = pg_insert(CompanyDocument).values(rows)
        statement = statement.on_conflict_do_update(
            index_elements=["symbol", "pdf_url"],
            set_={
                "category": statement.excluded.category,
                "title": statement.excluded.title,
                "filed_date": statement.excluded.filed_date,
                "source_ref": statement.excluded.source_ref,
            },
        )
        await db.execute(statement)

    await db.execute(
        CompanyMetric.__table__.update()
        .where(CompanyMetric.symbol == symbol)
        .values(documents_synced_at=datetime.now(timezone.utc))
    )


async def sync_one_symbol(db: AsyncSession, symbol: str) -> int:
    """Fetch + persist ONE symbol's documents, immediately. Used by the live
    fallback path in routers/finedge.py so a company nobody has synced yet
    still ends up in the table after its first real page view, instead of
    paying the live-fetch cost again on every subsequent visit."""
    rows = await fetch_documents_for_symbol(symbol, f"document_sync_ondemand_{symbol}")
    await _write_documents(db, symbol.upper(), rows)
    await db.commit()
    return len(rows)


async def sync_documents_batch(db: AsyncSession, batch_size: int | None = None) -> int:
    """Rolling background sweep: oldest-synced-first, largest-market-cap-first
    — the exact selection rule services/metrics_sync.py::sync_fundamentals_batch
    already uses, reused here on purpose so both syncs converge on the same
    "important companies get fresh data sooner" behaviour with one pattern to
    reason about instead of two."""
    batch_size = batch_size or settings.DOCUMENT_SYNC_BATCH_SIZE
    stale_cutoff = datetime.now(timezone.utc) - timedelta(days=settings.DOCUMENT_REFRESH_DAYS)

    targets = (
        await db.execute(
            select(CompanyMetric.symbol)
            .where(
                CompanyMetric.market_cap.isnot(None),
                (CompanyMetric.documents_synced_at.is_(None))
                | (CompanyMetric.documents_synced_at < stale_cutoff),
            )
            .order_by(CompanyMetric.documents_synced_at.asc().nulls_first(), CompanyMetric.market_cap.desc())
            .limit(batch_size)
        )
    ).scalars().all()

    if not targets:
        return 0

    rid = "document_sync_batch"
    synced = 0
    for symbol in targets:
        try:
            rows = await fetch_documents_for_symbol(symbol, rid)
            await _write_documents(db, symbol, rows)
            # Committed PER SYMBOL, not once at the end of the batch. A
            # Postgres error inside one symbol's INSERT (verified live: a
            # FinEdge placeholder link, "-", made an early build of this
            # collide inside a single statement) leaves the whole SESSION in
            # an aborted-transaction state — every statement after it fails
            # too, cascading, until something rolls back. A single commit at
            # the end meant one bad symbol silently discarded every OTHER
            # symbol's already-good work in the same batch. Per-symbol commits
            # make each symbol's success or failure independent, matching what
            # the log line below already claimed was true.
            await db.commit()
            synced += 1
        except Exception:
            logger.exception("[document_sync] symbol=%s failed — leaving documents_synced_at unset "
                             "so the next cycle retries it", symbol)
            # Required after ANY failure, not just this specific one: without
            # it the session stays in the aborted state described above and
            # every symbol after this one in the loop fails too, regardless of
            # whether ITS fetch and write were perfectly fine.
            await db.rollback()

    logger.info("[document_sync] batch synced %d/%d symbol(s)", synced, len(targets))
    return synced
