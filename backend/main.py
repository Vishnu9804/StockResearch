import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from core.config import settings
from core.cache import init_cache, close_cache
from routers import finedge, screener, portfolio, watchlist, ratio_preferences, custom_ratios, peer_comparison, news, butterfly, chat
from middleware.auth import get_current_user, AuthenticatedUser
from services.sync_service import run_background_sync
from agents.butterfly.worker import run_butterfly_worker
from agents.company_profiler.worker import run_company_profiler_worker
from services.rag.index_worker import run_rag_index_worker

# Quiet by default, agent logs opted IN explicitly — the opposite of trying to
# name every noisy source one by one (FinEdge sync, news ingestion, uvicorn,
# sqlalchemy, the raw litellm/ZLM SDK, ...). logging.basicConfig sets the ROOT
# logger, and every logger in the process that never calls its own
# .setLevel() inherits whatever level its nearest ancestor has — so setting
# root to WARNING silences everything in the app EXCEPT the loggers in
# _AGENT_LOGGERS below, which are bumped back up to INFO right after. Add a
# logger name to that tuple the day a new agent module needs to be heard from
# — nothing else needs to change.
logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s - %(levelname)-8s - %(name)s - %(message)s"
)

_AGENT_LOG_LEVEL = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
_AGENT_LOGGERS = (
    "agents.runner",                       # agents/shared/adk_runner.py — clean quota-limit lines
    "agents.butterfly.pipeline",           # per-news-item workflow progress
    "agents.butterfly.worker",             # batch claiming, idle, quota cooldown
    "agents.company_profiler.pipeline",    # per-symbol workflow progress
    "agents.company_profiler.worker",      # batch claiming, idle, quota cooldown
    "services.butterfly_scorer",           # candidate matching + alert-write results
    "agents.research_chat.pipeline",       # per-question retrieve/answer summary
    "agents.research_chat.guardrails",     # off-topic rejections, stripped advice
    "services.rag.embeddings",             # live embedding-request counter
    "services.rag.indexer",                # what each index cycle changed
    "services.rag.index_worker",           # cycle start/idle/cooldown
    "services.rag.retriever",              # per-question retrieval counts
    "services.rag.company_resolver",       # which company a question resolved to
    "services.rag.sources.transcript",     # transcript PDF fetch/extract results
    "services.rag.sources.news",           # how many articles a cycle picked up
)
for _name in _AGENT_LOGGERS:
    logging.getLogger(_name).setLevel(_AGENT_LOG_LEVEL)

# Belt-and-braces for google_adk/google_genai/LiteLLM specifically: they log
# the FULL raw provider error at ERROR level on every failed call, and ERROR
# is ABOVE WARNING — root's WARNING default would not hide it. "LiteLLM" is
# the logger ADK's LiteLlm wrapper drives every ZLM call through (agents/
# shared/llm.py) — verified live against this project's own litellm install,
# Aug 2026. Our own code already logs a clean one-line equivalent for every
# failure that matters (see agents/shared/adk_runner.py), so nothing real is
# lost by silencing these.
#
# "finedge" is the same story but for a different reason: it's a REAL,
# unrelated system (the stock-price/fundamentals proxy, see services/
# finedge_service.py) that logs its own retries/timeouts at WARNING/ERROR —
# root's WARNING default would let those through. By explicit request this
# terminal should show agent-workflow logs and nothing else, so it's fully
# silenced too. Trade-off, on purpose: a genuine FinEdge outage won't be
# visible here anymore — if that visibility is ever needed again, drop
# "finedge" out of this tuple.
for _silent_logger in ("google_adk", "google_genai", "LiteLLM", "finedge"):
    logging.getLogger(_silent_logger).setLevel(logging.CRITICAL)

logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialise the shared proxy cache (Redis when configured, else in-memory).
    await init_cache()

    # Background sync keeps the local `company_metrics` cache populated from
    # FinEdge. It must run in exactly one process — see services/sync_service.py.
    # In production, disable it here (ENABLE_BACKGROUND_SYNC=false) and run the
    # dedicated `python sync_worker.py` process once instead.
    sync_task = None
    if settings.ENABLE_BACKGROUND_SYNC:
        sync_task = asyncio.create_task(run_background_sync())
        logger.info("  [FinScreen FastAPI] Inline background sync ENABLED")
    else:
        logger.info(
            "  [FinScreen FastAPI] Inline background sync DISABLED "
            "(expecting a dedicated sync_worker process)"
        )

    # Butterfly Effect multi-agent workflow — same single-owner rule as the
    # FinEdge sync above. See agents/butterfly/worker.py + butterfly_worker.py.
    butterfly_task = None
    if settings.ENABLE_BUTTERFLY_WORKER:
        butterfly_task = asyncio.create_task(run_butterfly_worker())
        logger.info("  [FinScreen FastAPI] Inline Butterfly worker ENABLED")
    else:
        logger.info(
            "  [FinScreen FastAPI] Inline Butterfly worker DISABLED "
            "(expecting a dedicated butterfly_worker process, or not running yet)"
        )

    # Company Profiler workflow (Phase 2) — builds company_exposure_profiles
    # for held symbols, offline, once per company. Same single-owner rule.
    # See agents/company_profiler/worker.py + company_profiler_worker.py.
    company_profiler_task = None
    if settings.ENABLE_COMPANY_PROFILER_WORKER:
        company_profiler_task = asyncio.create_task(run_company_profiler_worker())
        logger.info("  [FinScreen FastAPI] Inline Company Profiler worker ENABLED")
    else:
        logger.info(
            "  [FinScreen FastAPI] Inline Company Profiler worker DISABLED "
            "(expecting a dedicated company_profiler_worker process, or not running yet)"
        )

    # Research Chat's retrieval corpus (rag_documents/rag_chunks). Same
    # single-owner rule again. Off by default even in dev — POST
    # /api/chat/index/run builds the index on demand, which is the right
    # default for a machine that isn't meant to be spending embedding quota in
    # the background. See services/rag/index_worker.py + rag_index_worker.py.
    rag_index_task = None
    if settings.ENABLE_RAG_INDEX_WORKER:
        rag_index_task = asyncio.create_task(run_rag_index_worker())
        logger.info("  [FinScreen FastAPI] Inline RAG index worker ENABLED")
    else:
        logger.info(
            "  [FinScreen FastAPI] Inline RAG index worker DISABLED "
            "(use POST /api/chat/index/run, or a dedicated rag_index_worker process)"
        )

    logger.info(f"  [FinScreen FastAPI] Server ready on port {settings.PORT} [{settings.ENVIRONMENT}]")
    yield

    for task in (sync_task, butterfly_task, company_profiler_task, rag_index_task):
        if task is not None:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
    await close_cache()
    logger.info("  [FinScreen FastAPI] Shutting down")

app = FastAPI(
    title="FinScreen API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

ALLOWED_ORIGINS = [
    settings.FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": True, "message": "An unexpected error occurred."}
    )

@app.get("/health")
async def health():
    return {"status": "ok", "service": "FinScreen FastAPI", "environment": settings.ENVIRONMENT}

# Relational User Profile Sync Contract
class ProfileSyncBody(BaseModel):
    name: str

@app.post("/api/auth/sync-profile")
async def sync_profile(body: ProfileSyncBody, current_user: AuthenticatedUser = Depends(get_current_user)):
    """
    Invoked immediately after successful frontend Supabase sign-up.
    Ensures a database entry maps records (Watchlists/Portfolios) to the Supabase UUID.
    """
    logger.info(f"Synchronizing database profile for Supabase User ID: {current_user.id}")
    # Run database operational logic here to select/insert into public.users:
    # INSERT INTO public.users (auth_id, email, name) VALUES (current_user.id, current_user.email, body.name)
    return {
        "success": True,
        "message": " Relational database profile aligned with Supabase identity.",
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "name": body.name,
            "plan": "FREE"
        }
    }

# Protected Sample Test Route
@app.get("/api/auth/profile")
async def get_profile(current_user: AuthenticatedUser = Depends(get_current_user)):
    return {
        "success": True,
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "name": "Authenticated User",
            "plan": "FREE"
        }
    }

app.include_router(finedge.router)
app.include_router(screener.router)
app.include_router(portfolio.router)
app.include_router(watchlist.router)
app.include_router(ratio_preferences.router)
app.include_router(custom_ratios.router)
app.include_router(peer_comparison.router)
app.include_router(news.router)
app.include_router(butterfly.router)
app.include_router(chat.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)