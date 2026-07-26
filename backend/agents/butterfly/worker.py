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
from datetime import datetime, timezone

from sqlalchemy import select

from agents.butterfly.pipeline import analyze_news_item
from core.config import settings
from core.database import async_session_maker
from models.models import NewsItem

logger = logging.getLogger("agents.butterfly.worker")


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


async def _claim_batch() -> list:
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

    cutoff = _backlog_cutoff()
    if cutoff is not None:
        logger.info(
            "[butterfly.worker] starting — BACKLOG SKIPPED, only analysing news "
            "ingested on/after %s", cutoff.isoformat(),
        )
    else:
        logger.info("[butterfly.worker] starting — processing full backlog, oldest first")

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
            await asyncio.sleep(settings.BUTTERFLY_POLL_INTERVAL_IDLE_SECONDS)
            continue

        for news_id in batch:
            try:
                await analyze_news_item(news_id)
            except Exception:
                logger.exception("[butterfly.worker] unhandled error news_id=%s", news_id)

        await asyncio.sleep(settings.BUTTERFLY_POLL_INTERVAL_BUSY_SECONDS)
