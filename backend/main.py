import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.config import settings
from core.database import init_db
from services.scheduler import start_scheduler

from routers.finedge import _auth as guest_auth

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s"
)
logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("⚡ [FinScreen FastAPI] Starting up…")
    await init_db()
    
    # Seed initial company metrics
    from core.database import AsyncSessionLocal
    from core.seed import seed_metrics
    async with AsyncSessionLocal() as session:
        await seed_metrics(session)

    start_scheduler()
    logger.info(f"✅ Server ready on port {settings.PORT} [{settings.ENVIRONMENT}]")
    yield
    logger.info("👋 [FinScreen FastAPI] Shutting down…")


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


# ── Routers ───────────────────────────────────────────────────────────────────
from routers import auth, finedge, watchlist, screener, payments, portfolio, queries, admin
app.include_router(auth.router)       # /api/auth/login, /api/auth/signup etc. — kept
app.include_router(guest_auth)        # /api/auth/profile — returns guest if not logged in
app.include_router(finedge.router)    # /api/finscreen/... — NO auth required
app.include_router(watchlist.router)  # /api/watchlists/... — NO auth required
app.include_router(screener.router)   # /api/screener/... — NO auth required
app.include_router(payments.router)   # /api/payments/... — kept
app.include_router(portfolio.router)  # /api/portfolio/... — authenticated
app.include_router(queries.router)    # /api/queries/... — authenticated
app.include_router(admin.router)      # /api/admin/... — authenticated


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=settings.PORT, reload=True)