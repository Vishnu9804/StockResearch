"""
company_profiler_worker.py
Dedicated, standalone process that builds/refreshes company_exposure_profiles
for symbols users actually hold. Mirrors sync_worker.py / butterfly_worker.py.

This is the production pattern: run the web API with
ENABLE_COMPANY_PROFILER_WORKER=false, and run EXACTLY ONE copy of this
process.

    python company_profiler_worker.py

Local/dev shortcut: run the web app with ENABLE_COMPANY_PROFILER_WORKER=true
and the same loop runs inline — no separate process needed.
"""
import asyncio
import logging

from core.config import settings
from agents.company_profiler.worker import run_company_profiler_worker

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s - %(levelname)-8s - %(name)s - %(message)s",
)
logger = logging.getLogger("company_profiler_worker")


async def main() -> None:
    logger.info("[CompanyProfilerWorker] Starting dedicated worker [%s]", settings.ENVIRONMENT)
    try:
        await run_company_profiler_worker()
    except asyncio.CancelledError:
        pass
    finally:
        logger.info("[CompanyProfilerWorker] Shutting down")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("[CompanyProfilerWorker] Interrupted — exiting")
