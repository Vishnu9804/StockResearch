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

Two independent loops (see services/metrics_sync.py for the actual work):
  * quote loop        — one cheap bulk /quote call for the whole universe.
                        Cadence adapts to market hours (Phase 4): frequent while
                        the market is open, slow when it's closed.
  * fundamentals loop — expensive per-symbol ratios, a gentle rolling batch that
                        works through the universe largest-company-first. Runs
                        an accelerated warmup first on a cold table (Phase 5).
"""

import asyncio
import logging

from sqlalchemy import func, select

from core.database import async_session_maker
from core.market_hours import is_market_open
from models.models import CompanyMetric
from services.metrics_sync import sync_fundamentals_batch, sync_quote_data

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


async def run_background_sync() -> None:
    """Run both sync loops until cancelled. This is the single entry point used
    by both the inline app startup and the standalone worker."""
    logger.info("[SyncService] Background sync starting (quote + fundamentals loops)")
    await asyncio.gather(_quote_sync_loop(), _fundamentals_sync_loop())
