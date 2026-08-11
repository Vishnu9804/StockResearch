"""
services/sync_service.py
Owns the background FinEdge → ``company_metrics`` sync (Phases 1, 4, 5).

This module is the SINGLE place the sync loops live. It is started either:
  * inline by the web app when ``ENABLE_BACKGROUND_SYNC`` is true (fine for
    local / single-process dev), or
  * by the dedicated ``sync_worker.py`` process in production.

It must run in exactly one process. Running the web app with multiple workers
AND inline sync enabled would fan every FinEdge call out N times — in
production, disable inline sync on the web tier and run one worker instead.

Four independent loops:
  * quote loop        — one cheap bulk /quote call for the whole universe.
                        Cadence adapts to market hours (Phase 4): frequent while
                        the market is open, slow when it's closed.
                        (see services/metrics_sync.py)
  * fundamentals loop — expensive per-symbol ratios, a gentle rolling batch that
                        works through the universe largest-company-first. Runs
                        an accelerated warmup first on a cold table (Phase 5).
                        (see services/metrics_sync.py)
  * document loop     — "what PDFs does FinEdge have for this company",
                        a slower rolling batch (documents change on the order
                        of months, not minutes) across the WHOLE universe, not
                        just held/watched symbols. Feeds both the company
                        page's Documents tab and Research Chat's transcript
                        fetch. (see services/document_sync.py)
  * news loop         — marketaux into the central ``news_items`` store, the
                        input to the Butterfly Effect workflow.
                        (see services/news_ingest.py)

The news loop belongs here rather than in the web tier for the same reason as
the other two: news is identical for every user, so it must be fetched once by
one owner process, not once per worker or per request.
"""

import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy import func, select

from core.config import settings
from core.database import async_session_maker
from core.market_hours import is_market_open
from models.models import CompanyMetric
from services.document_sync import sync_documents_batch
from services.metrics_sync import sync_fundamentals_batch, sync_quote_data
from services.news_ingest import cleanup_stale_news, ingest_news

logger = logging.getLogger("sync_service")

# ── Quote loop cadence (Phase 4: market-hours aware) ─────────────────────────
QUOTE_SYNC_INTERVAL_OPEN_SECONDS = 5 * 60      # market open — keep prices fresh
QUOTE_SYNC_INTERVAL_CLOSED_SECONDS = 60 * 60   # market closed — prices don't move

# ── Fundamentals loop cadence ────────────────────────────────────────────────
# The global rate limiter (core/rate_limiter.py) is what actually caps FinEdge
# throughput at 300/min, so these intervals only decide how hard we lean on that
# shared budget. We back off while the market is open so live user requests get
# priority on the limited call budget, and drain fast while it's closed.
FUNDAMENTALS_BATCH_SIZE = 30
FUNDAMENTALS_SYNC_INTERVAL_OPEN_SECONDS = 60     # market open — yield budget to users
FUNDAMENTALS_SYNC_INTERVAL_CLOSED_SECONDS = 5    # market closed — work through the universe

# ── Cold-start warmup (Phase 5) ──────────────────────────────────────────────
# If fewer than this many companies already have fundamentals, run a few larger
# back-to-back batches at startup so a fresh deploy shows meaningful data fast
# instead of trickling in 30 symbols every 90s.
WARMUP_TARGET_ROWS = 200
WARMUP_BATCHES = 5
WARMUP_BATCH_SIZE = 100

# ── Document sync cadence ─────────────────────────────────────────────────────
# Read from core/config.py (DOCUMENT_SYNC_*) rather than duplicated here — see
# that module for the full reasoning (filings change on the order of months,
# so even the slower market-open rate finishes a full universe sweep well
# inside a day).


def _document_sync_interval_seconds() -> int:
    return (
        settings.DOCUMENT_SYNC_INTERVAL_OPEN_SECONDS
        if is_market_open()
        else settings.DOCUMENT_SYNC_INTERVAL_CLOSED_SECONDS
    )


# ── News ingestion cadence ───────────────────────────────────────────────────
# marketaux is a paid API with a real per-day request quota (unlike the old
# RSS/GDELT providers, which had none to budget), so this cadence is sized
# against that budget rather than against publisher-CDN courtesy. At 7 themed
# queries per cycle (services/news_sources/marketaux_client.py), this works
# out to roughly 400 calls/day — about 4% of the "Pro 10K" plan's 10,000/day
# — leaving generous headroom for retries and future per-portfolio lookups.
# Slower off-hours, since Indian financial publishers post very little
# overnight — but never stopped, because the global queries that matter most
# for butterfly chains cover other time zones, and a US Fed decision lands
# while Indian markets are shut. The ingest is idempotent (ON CONFLICT DO
# NOTHING on url_hash) either way, so polling faster than the underlying news
# actually changes would buy nothing.
NEWS_SYNC_INTERVAL_OPEN_SECONDS = 15 * 60
NEWS_SYNC_INTERVAL_CLOSED_SECONDS = 45 * 60

# Retention cleanup runs on its own daily cadence rather than every ingest
# tick — a delete pass over the table on every 15-minute poll would be pure
# waste, since "older than N days" can't have changed since the last check
# less than a day ago.
NEWS_CLEANUP_INTERVAL_SECONDS = 24 * 60 * 60


def _quote_interval_seconds() -> int:
    return (
        QUOTE_SYNC_INTERVAL_OPEN_SECONDS
        if is_market_open()
        else QUOTE_SYNC_INTERVAL_CLOSED_SECONDS
    )


def _fundamentals_interval_seconds() -> int:
    return (
        FUNDAMENTALS_SYNC_INTERVAL_OPEN_SECONDS
        if is_market_open()
        else FUNDAMENTALS_SYNC_INTERVAL_CLOSED_SECONDS
    )


async def _quote_sync_loop() -> None:
    while True:
        try:
            async with async_session_maker() as db:
                await sync_quote_data(db)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("[SyncService] Quote sync iteration failed")
        await asyncio.sleep(_quote_interval_seconds())


async def _warmup_fundamentals() -> None:
    """Accelerate the first fill when the table is cold, then hand off to the
    steady rolling loop. No-op once the universe is broadly populated."""
    try:
        async with async_session_maker() as db:
            synced = (
                await db.execute(
                    select(func.count()).select_from(CompanyMetric).where(
                        CompanyMetric.fundamentals_synced_at.isnot(None)
                    )
                )
            ).scalar_one()
    except Exception:
        logger.exception("[SyncService] Warmup precheck failed; skipping warmup")
        return

    if synced >= WARMUP_TARGET_ROWS:
        return

    logger.info(
        "[SyncService] Cold start detected (%d fundamentals rows) — running warmup", synced
    )
    for i in range(WARMUP_BATCHES):
        try:
            async with async_session_maker() as db:
                n = await sync_fundamentals_batch(db, batch_size=WARMUP_BATCH_SIZE)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("[SyncService] Warmup batch %d failed", i + 1)
            break
        logger.info("[SyncService] Warmup batch %d enriched %d symbols", i + 1, n)
        if n == 0:
            break


async def _fundamentals_sync_loop() -> None:
    await _warmup_fundamentals()
    while True:
        try:
            async with async_session_maker() as db:
                await sync_fundamentals_batch(db, batch_size=FUNDAMENTALS_BATCH_SIZE)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("[SyncService] Fundamentals sync iteration failed")
        await asyncio.sleep(_fundamentals_interval_seconds())


async def _document_sync_loop() -> None:
    while True:
        try:
            async with async_session_maker() as db:
                await sync_documents_batch(db)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("[SyncService] Document sync iteration failed")
        await asyncio.sleep(_document_sync_interval_seconds())


def _news_interval_seconds() -> int:
    return (
        NEWS_SYNC_INTERVAL_OPEN_SECONDS
        if is_market_open()
        else NEWS_SYNC_INTERVAL_CLOSED_SECONDS
    )


async def _news_sync_loop() -> None:
    """Poll every registered marketaux query into ``news_items``.

    Runs immediately on start rather than after a sleep, so a fresh deploy has a
    populated feed within a minute instead of a quarter of an hour. Individual
    query failures are swallowed inside the ingest itself — only a total failure
    of the cycle reaches this handler.
    """
    while True:
        try:
            summary = await ingest_news()
            logger.info(
                "[SyncService] News ingest — %d fetched, %d new, %d queued for analysis",
                summary["raw_fetched"], summary["inserted"], summary["queued_for_analysis"],
            )
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("[SyncService] News ingest iteration failed")
        await asyncio.sleep(_news_interval_seconds())


async def _news_cleanup_loop() -> None:
    """Delete news past the retention window once a day. See
    services/news_ingest.py::cleanup_stale_news for why this is time-based and
    never count-based."""
    while True:
        try:
            await cleanup_stale_news()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("[SyncService] News cleanup iteration failed")
        await asyncio.sleep(NEWS_CLEANUP_INTERVAL_SECONDS)


async def run_background_sync() -> None:
    """Run all sync loops until cancelled. This is the single entry point used
    by both the inline app startup and the standalone worker."""
    logger.info(
        "[SyncService] Background sync starting (quote + fundamentals + documents%s + news + cleanup loops)",
        "" if settings.ENABLE_DOCUMENT_SYNC else " [disabled]",
    )
    loops = [
        _quote_sync_loop(),
        _fundamentals_sync_loop(),
        _news_sync_loop(),
        _news_cleanup_loop(),
    ]
    if settings.ENABLE_DOCUMENT_SYNC:
        loops.append(_document_sync_loop())
    await asyncio.gather(*loops)
