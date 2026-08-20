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
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from agents.company_profiler.pipeline import build_profile
from agents.shared.adk_runner import is_quota_error
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
    # ZLM drives every step in this workflow — see agents/company_profiler/
    # agents.py — so it's the only key that gates the worker.
    if not settings.ZLM_API_KEY:
        logger.warning(
            "[company_profiler.worker] ZLM_API_KEY is not set — idling without "
            "building any profiles until a key is configured in .env"
        )
    else:
        # Staggered from agents/butterfly/worker.py's own startup on purpose:
        # both workers share the cheap model's per-MINUTE request limit (a
        # separate, much smaller cap than the per-day one), and both used to
        # fire their first call within a second of each other at app boot —
        # enough on its own to trip that per-minute limit before either had
        # done any real work. Starting a beat apart avoids that collision
        # without touching either worker's steady-state cadence.
        logger.info(
            "[company_profiler.worker] starting — waiting %ds first so it doesn't "
            "collide with the butterfly worker's own startup burst",
            settings.COMPANY_PROFILER_STARTUP_STAGGER_SECONDS,
        )
        await asyncio.sleep(settings.COMPANY_PROFILER_STARTUP_STAGGER_SECONDS)

    while True:
        if not settings.ZLM_API_KEY:
            await asyncio.sleep(settings.COMPANY_PROFILER_POLL_INTERVAL_IDLE_SECONDS)
            continue

        try:
            symbols = await _symbols_needing_profile()
        except Exception:
            logger.exception("[company_profiler.worker] failed to select symbols")
            await asyncio.sleep(settings.COMPANY_PROFILER_POLL_INTERVAL_IDLE_SECONDS)
            continue

        if not symbols:
            logger.info(
                "[company_profiler.worker] idle — every held symbol already has a "
                "profile younger than %d days", settings.COMPANY_PROFILER_REFRESH_DAYS,
            )
            await asyncio.sleep(settings.COMPANY_PROFILER_POLL_INTERVAL_IDLE_SECONDS)
            continue

        quota_hit = False
        for symbol in symbols:
            try:
                await build_profile(symbol)
            except Exception as exc:
                if is_quota_error(exc):
                    # agents/shared/adk_runner.py already logged exactly which
                    # model hit its limit — stop working through the rest of
                    # this batch against the same exhausted quota.
                    quota_hit = True
                    break
                logger.exception("[company_profiler.worker] unhandled error symbol=%s", symbol)

        if quota_hit:
            # Randomised so this worker and agents/butterfly/worker.py, if they
            # ever collide on the same per-minute limit once, don't then retry
            # in lockstep forever after — see the startup-stagger comment above
            # for the fuller version of this reasoning.
            cooldown = settings.LLM_QUOTA_COOLDOWN_SECONDS + random.uniform(0, 15)
            logger.warning("[company_profiler.worker] quota exhausted — cooling down %.0fs", cooldown)
            await asyncio.sleep(cooldown)
        else:
            await asyncio.sleep(settings.COMPANY_PROFILER_POLL_INTERVAL_IDLE_SECONDS)
