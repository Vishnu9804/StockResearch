"""
agents/butterfly/worker.py
Polls news_items for anything worth running the Butterfly workflow on, and
runs it one item at a time. Single-owner, same rule as services/
sync_service.py: run this inline (ENABLE_BUTTERFLY_WORKER=true) in
single-process dev, or as its own dedicated process (butterfly_worker.py) in
production — never both at once.
"""
import asyncio
import logging
import random
from datetime import datetime, timezone

from sqlalchemy import select, update

from agents.butterfly.pipeline import analyze_news_item
from agents.shared.adk_runner import QuotaExhaustedError
from core.config import settings
from core.database import async_session_maker
from models.models import NewsItem

logger = logging.getLogger("agents.butterfly.worker")


async def _recover_orphaned_analyzing() -> None:
    """Reset any row stuck in ANALYZING back to PENDING.

    Single-owner (this worker is the only writer of this status — see module
    docstring), and analyze_news_item only ever holds a row in ANALYZING for
    the few seconds it's actively inside _run_pipeline. So any row still in
    that state when the worker starts up can only be a leftover from a
    process that died mid-item (crash, redeploy, Ctrl+C) — never a live run —
    and would otherwise sit there forever, since _claim_batch only selects
    PENDING/TRIAGED.
    """
    async with async_session_maker() as session:
        result = await session.execute(
            update(NewsItem)
            .where(NewsItem.analysis_status == "ANALYZING")
            .values(analysis_status="PENDING")
        )
        await session.commit()
    if result.rowcount:
        logger.warning(
            "[butterfly.worker] recovered %d item(s) stuck in ANALYZING from a "
            "previous run — requeued as PENDING", result.rowcount,
        )


def _backlog_cutoff() -> datetime | None:
    """Parses BUTTERFLY_ANALYSIS_MIN_INGESTED_AT — see core/config.py for why
    this exists. None means no cutoff (process the full backlog, oldest
    included), which is the correct default for a real production launch."""
    raw = settings.BUTTERFLY_ANALYSIS_MIN_INGESTED_AT.strip()
    if not raw:
        return None
    cutoff = datetime.fromisoformat(raw)
    if cutoff.tzinfo is None:
        cutoff = cutoff.replace(tzinfo=timezone.utc)
    return cutoff


def _test_news_ids() -> list[str]:
    return [t.strip() for t in settings.BUTTERFLY_TEST_NEWS_IDS.split(",") if t.strip()]


async def _claim_batch() -> list:
    # ── TEST MODE (see core/config.py:BUTTERFLY_TEST_NEWS_IDS) ─────────────
    # Only active when that env var is non-empty. Claims exactly the listed
    # rows, bypassing the cutoff/attempts/ordering/batch-size filters below
    # entirely, so a manual test run never picks up anything else from the
    # table. Everything downstream of this function (triage, causal analysis,
    # scoring, thematic research) is completely unaffected — this only
    # changes which rows get selected.
    test_ids = _test_news_ids()
    if test_ids:
        async with async_session_maker() as session:
            rows = (
                await session.execute(
                    select(NewsItem.id).where(
                        NewsItem.id.in_(test_ids),
                        NewsItem.analysis_status.in_(["PENDING", "TRIAGED"]),
                    )
                )
            ).scalars().all()
        return list(rows)

    # ── Real production filters ──────────────────────────────────────────────
    cutoff = _backlog_cutoff()
    filters = [
        NewsItem.analysis_status.in_(["PENDING", "TRIAGED"]),
        NewsItem.analysis_attempts < settings.BUTTERFLY_MAX_ANALYSIS_ATTEMPTS,
    ]
    if cutoff is not None:
        filters.append(NewsItem.ingested_at >= cutoff)

    async with async_session_maker() as session:
        rows = (
            await session.execute(
                select(NewsItem.id)
                .where(*filters)
                .order_by(NewsItem.market_relevance.desc(), NewsItem.published_at.desc())
                .limit(settings.BUTTERFLY_POLL_BATCH_SIZE)
            )
        ).scalars().all()
    return list(rows)


async def run_butterfly_worker() -> None:
    if not settings.GEMINI_API_KEY:
        logger.warning(
            "[butterfly.worker] GEMINI_API_KEY is not set — idling without "
            "analysing anything until a key is configured in .env"
        )

    await _recover_orphaned_analyzing()

    test_ids = _test_news_ids()
    cutoff = _backlog_cutoff()
    if test_ids:
        logger.warning(
            "[butterfly.worker] TEST MODE — BUTTERFLY_TEST_NEWS_IDS is set, only "
            "claiming %d specific news_id(s), ignoring cutoff/backlog entirely: %s — "
            "clear this env var to resume normal production polling",
            len(test_ids), test_ids,
        )
    elif cutoff is not None:
        logger.info(
            "[butterfly.worker] starting — BACKLOG SKIPPED, only analysing news "
            "ingested on/after %s — model_cheap=%s model_smart=%s",
            cutoff.isoformat(), settings.GEMINI_MODEL_CHEAP, settings.GEMINI_MODEL_SMART,
        )
    else:
        logger.info(
            "[butterfly.worker] starting — processing full backlog, oldest first — "
            "model_cheap=%s model_smart=%s",
            settings.GEMINI_MODEL_CHEAP, settings.GEMINI_MODEL_SMART,
        )

    while True:
        if not settings.GEMINI_API_KEY:
            await asyncio.sleep(settings.BUTTERFLY_POLL_INTERVAL_IDLE_SECONDS)
            continue

        try:
            batch = await _claim_batch()
        except Exception:
            logger.exception("[butterfly.worker] failed to claim batch")
            await asyncio.sleep(settings.BUTTERFLY_POLL_INTERVAL_IDLE_SECONDS)
            continue

        if not batch:
            logger.info("[butterfly.worker] idle — nothing waiting to be analysed right now")
            await asyncio.sleep(settings.BUTTERFLY_POLL_INTERVAL_IDLE_SECONDS)
            continue

        logger.info("[butterfly.worker] claimed batch of %d item(s): %s", len(batch), batch)
        quota_hit = False
        for news_id in batch:
            try:
                await analyze_news_item(news_id)
            except QuotaExhaustedError:
                # The rest of this batch would hit the same exhausted quota —
                # stop here rather than burning through it item by item.
                # Randomised for the same reason agents/company_profiler/
                # worker.py's cooldown is: if the two workers ever collide on
                # the same per-minute limit once, a fixed cooldown keeps them
                # retrying in lockstep forever after — jitter breaks that.
                cooldown = settings.GEMINI_QUOTA_COOLDOWN_SECONDS + random.uniform(0, 15)
                logger.warning(
                    "[butterfly.worker] quota exhausted — cooling down %.0fs before the next attempt",
                    cooldown,
                )
                quota_hit = True
                break
            except Exception:
                logger.exception("[butterfly.worker] unhandled error news_id=%s", news_id)

        if quota_hit:
            await asyncio.sleep(cooldown)
        else:
            await asyncio.sleep(settings.BUTTERFLY_POLL_INTERVAL_BUSY_SECONDS)
