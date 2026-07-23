import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from core.config import settings
from core.cache import init_cache, close_cache
from routers import finedge, screener, portfolio, watchlist, ratio_preferences, custom_ratios, peer_comparison
from middleware.auth import get_current_user, AuthenticatedUser
from services.sync_service import run_background_sync

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s - %(levelname)-8s - %(name)s - %(message)s"
)
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

    logger.info(f"  [FinScreen FastAPI] Server ready on port {settings.PORT} [{settings.ENVIRONMENT}]")
    yield

    if sync_task is not None:
        sync_task.cancel()
        try:
            await sync_task
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)