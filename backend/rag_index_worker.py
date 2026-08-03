"""
rag_index_worker.py
Dedicated, standalone process that keeps the Research Chat retrieval corpus
(rag_documents + rag_chunks) current. Mirrors sync_worker.py /
butterfly_worker.py / company_profiler_worker.py.

This is the production pattern: run the web API with
ENABLE_RAG_INDEX_WORKER=false, and run EXACTLY ONE copy of this process.

    python rag_index_worker.py

Local/dev shortcut: run the web app with ENABLE_RAG_INDEX_WORKER=true and the
same loop runs inline — no separate process needed. For a one-off pass without
either, POST /api/chat/index/run.

Note this process needs core/cache.py initialised: the transcript source asks
FinEdge for each company's filing list through services/finedge_service.py,
which reads and writes the shared proxy cache.
"""
import asyncio
import logging

from core.cache import close_cache, init_cache
from core.config import settings
from services.rag.index_worker import run_rag_index_worker

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s - %(levelname)-8s - %(name)s - %(message)s",
)
logger = logging.getLogger("rag_index_worker")


async def main() -> None:
    logger.info("[RagIndexWorker] Starting dedicated worker [%s]", settings.ENVIRONMENT)
    await init_cache()
    try:
        await run_rag_index_worker()
    except asyncio.CancelledError:
        pass
    finally:
        await close_cache()
        logger.info("[RagIndexWorker] Shutting down")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("[RagIndexWorker] Interrupted — exiting")
