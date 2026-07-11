"""
tests/conftest.py
Shared pytest fixtures for FinScreen backend tests.

Uses an in-memory SQLite database via aiosqlite so tests never touch dev.db.
The FastAPI `get_db` dependency is overridden with the in-memory session factory.
"""

import asyncio
import pytest
import pytest_asyncio

from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from core.database import Base, get_db
from core.seed import seed_metrics
from middleware.rate_limit import login_rate_limiter, signup_rate_limiter

# ── In-memory test database ────────────────────────────────────────────────────

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)
TestSessionLocal = async_sessionmaker(test_engine, expire_on_commit=False)


# ── Override get_db to use the in-memory DB ───────────────────────────────────

async def override_get_db():
    async with TestSessionLocal() as session:
        yield session


# ── Create / drop tables + seed around the session ───────────────────────────

@pytest_asyncio.fixture(scope="session")
def event_loop():
    """Use a single event-loop for all session-scoped fixtures."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def create_tables():
    """Create all tables once per test session, then drop them after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed a handful of company_metrics rows for screener tests
    async with TestSessionLocal() as session:
        await seed_metrics(session)

    yield

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


# ── AsyncClient fixture ────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def reset_rate_limiters():
    """
    Clear the in-process rate-limiter windows before every test so that
    counts from previous tests don't bleed into the next one.
    """
    login_rate_limiter._windows.clear()
    signup_rate_limiter._windows.clear()
    yield


@pytest_asyncio.fixture
async def client() -> AsyncClient:
    """
    Returns an httpx.AsyncClient that talks to the FastAPI app in-process.
    The `get_db` dependency is swapped to the in-memory session.
    """
    # Import late so the app is fully configured before we patch it
    from main import app

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
