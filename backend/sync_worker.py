"""
sync_worker.py
Dedicated, standalone process that runs the FinEdge → company_metrics sync.

This is the production pattern (Phase 1): run the web API with any number of
workers and ENABLE_BACKGROUND_SYNC=false, and run EXACTLY ONE copy of this
process. That guarantees the upstream data provider is polled by a single owner
regardless of how far the web tier scales out.

    python sync_worker.py

Local/dev shortcut: if you just run the web app with ENABLE_BACKGROUND_SYNC=true
(the default), the same loops run inline and you don't need this process at all.
"""

import asyncio
import logging

from core.config import settings
from services.sync_service import run_background_sync

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s - %(levelname)-8s - %(name)s - %(message)s",
)
logger = logging.getLogger("sync_worker")


async def main() -> None:
    logger.info("[SyncWorker] Starting dedicated sync worker [%s]", settings.ENVIRONMENT)
    try:
        await run_background_sync()
    except asyncio.CancelledError:
        pass
    finally:
        logger.info("[SyncWorker] Shutting down")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("[SyncWorker] Interrupted — exiting")
