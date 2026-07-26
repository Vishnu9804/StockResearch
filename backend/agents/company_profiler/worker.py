"""
agents/company_profiler/worker.py
Finds symbols that need a company_exposure_profiles row built or refreshed,
and runs agents/company_profiler/pipeline.py for a small batch of them.

Deliberately scoped to symbols users actually HOLD (not the whole NSE
universe, not watchlists) — those are exactly the symbols
services/butterfly_scorer.py can ever score an alert for, so profiling
anything else would spend tokens with no way to ever be used. Deliberately
low-frequency (see COMPANY_PROFILER_POLL_INTERVAL_IDLE_SECONDS) — this
workflow refreshes a handful of companies on a quarterly-ish cadence, not a
continuous news firehose like agents/butterfly/worker.py.

Single-owner, same rule as every other worker in this codebase: run inline
(ENABLE_COMPANY_PROFILER_WORKER=true) in single-process dev, or as its own
dedicated process (company_profiler_worker.py) in production.
"""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from agents.company_profiler.pipeline import build_profile
from core.config import settings
from core.database import async_session_maker
from models.models import CompanyExposureProfile, PortfolioHolding

logger = logging.getLogger("agents.company_profiler.worker")


async def _symbols_needing_profile() -> list[str]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.COMPANY_PROFILER_REFRESH_DAYS)

    async with async_session_maker() as session:
        held_symbols = set(
            (await session.execute(select(PortfolioHolding.symbol).distinct())).scalars().all()
        )
        if not held_symbols:
            return []

        fresh_symbols = set(
            (
                await session.execute(
                    select(CompanyExposureProfile.symbol).where(
                        CompanyExposureProfile.symbol.in_(held_symbols),
                        CompanyExposureProfile.updated_at >= cutoff,
                    )
                )
            ).scalars().all()
        )

    stale_or_missing = sorted(held_symbols - fresh_symbols)
    return stale_or_missing[: settings.COMPANY_PROFILER_POLL_BATCH_SIZE]


async def run_company_profiler_worker() -> None:
    if not settings.GEMINI_API_KEY:
        logger.warning(
            "[company_profiler.worker] GEMINI_API_KEY is not set — idling without "
            "building any profiles until a key is configured in .env"
        )

    logger.info("[company_profiler.worker] starting")
    while True:
        if not settings.GEMINI_API_KEY:
            await asyncio.sleep(settings.COMPANY_PROFILER_POLL_INTERVAL_IDLE_SECONDS)
            continue

        try:
            symbols = await _symbols_needing_profile()
        except Exception:
            logger.exception("[company_profiler.worker] failed to select symbols")
            await asyncio.sleep(settings.COMPANY_PROFILER_POLL_INTERVAL_IDLE_SECONDS)
            continue

        if not symbols:
            await asyncio.sleep(settings.COMPANY_PROFILER_POLL_INTERVAL_IDLE_SECONDS)
            continue

        for symbol in symbols:
            try:
                await build_profile(symbol)
            except Exception:
                logger.exception("[company_profiler.worker] unhandled error symbol=%s", symbol)

        await asyncio.sleep(settings.COMPANY_PROFILER_POLL_INTERVAL_IDLE_SECONDS)
