"""
butterfly_worker.py
Dedicated, standalone process that runs the Butterfly Effect multi-agent
workflow against the news_items queue.

This is the production pattern (mirrors sync_worker.py): run the web API with
any number of workers and ENABLE_BUTTERFLY_WORKER=false, and run EXACTLY ONE
copy of this process.

    python butterfly_worker.py

Local/dev shortcut: if you just run the web app with
ENABLE_BUTTERFLY_WORKER=true, the same loop runs inline and you don't need
this process at all.
"""
import asyncio
import logging

from core.config import settings
from agents.butterfly.worker import run_butterfly_worker

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s - %(levelname)-8s - %(name)s - %(message)s",
)
logger = logging.getLogger("butterfly_worker")


async def main() -> None:
    logger.info("[ButterflyWorker] Starting dedicated worker [%s]", settings.ENVIRONMENT)
    try:
        await run_butterfly_worker()
    except asyncio.CancelledError:
        pass
    finally:
        logger.info("[ButterflyWorker] Shutting down")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("[ButterflyWorker] Interrupted — exiting")
