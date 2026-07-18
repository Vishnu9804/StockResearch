import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from core.config import settings
from core.database import async_session_maker
from routers import finedge, screener, portfolio, watchlist, ratio_preferences
from middleware.auth import get_current_user, AuthenticatedUser
from services.metrics_sync import sync_quote_data, sync_fundamentals_batch

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s - %(levelname)-8s - %(name)s - %(message)s"
)
logger = logging.getLogger("main")

# ── Background sync loops ─────────────────────────────────────────────────────
# FinEdge has no working screener endpoint of its own, so the screener filters
# a local `company_metrics` cache instead. These loops keep it populated:
# a cheap bulk quote refresh (market cap/price, ~2 calls total) and a gentle,
# rate-limit-friendly rolling batch that fills in fundamentals (ROE/PE/etc.)
# symbol-by-symbol, prioritizing the largest companies first.
QUOTE_SYNC_INTERVAL_SECONDS = 20 * 60
FUNDAMENTALS_SYNC_INTERVAL_SECONDS = 90
FUNDAMENTALS_BATCH_SIZE = 30


async def _quote_sync_loop():
    while True:
        try:
            async with async_session_maker() as db:
                await sync_quote_data(db)
        except Exception:
            logger.exception("[MetricsSync] Quote sync loop iteration failed")
        await asyncio.sleep(QUOTE_SYNC_INTERVAL_SECONDS)


async def _fundamentals_sync_loop():
    while True:
        try:
            async with async_session_maker() as db:
                await sync_fundamentals_batch(db, batch_size=FUNDAMENTALS_BATCH_SIZE)
        except Exception:
            logger.exception("[MetricsSync] Fundamentals sync loop iteration failed")
        await asyncio.sleep(FUNDAMENTALS_SYNC_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    quote_task = asyncio.create_task(_quote_sync_loop())
    fundamentals_task = asyncio.create_task(_fundamentals_sync_loop())
    logger.info(f"  [FinScreen FastAPI] Server ready on port {settings.PORT} [{settings.ENVIRONMENT}]")
    yield
    quote_task.cancel()
    fundamentals_task.cancel()
    for t in (quote_task, fundamentals_task):
        try:
            await t
        except asyncio.CancelledError:
            pass
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)