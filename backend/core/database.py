from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean, Float, DateTime, ForeignKey, Text
from datetime import datetime, timezone
from typing import Optional, List
import uuid

from core.config import settings

db_url = settings.DATABASE_URL
if "postgresql" in db_url:
    if "?" in db_url:
        db_url = db_url.split("?")[0]
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(db_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


# ── Helper ────────────────────────────────────────────────────────────────────

def new_uuid() -> str:
    return str(uuid.uuid4())

def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ── Models (mirror Prisma schema exactly) ─────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    provider: Mapped[str] = mapped_column(String, default="local")
    provider_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    plan: Mapped[str] = mapped_column(String, default="FREE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    sessions: Mapped[List["Session"]] = relationship(back_populates="user", cascade="all, delete")
    watchlists: Mapped[List["Watchlist"]] = relationship(back_populates="user", cascade="all, delete")
    saved_screens: Mapped[List["SavedScreen"]] = relationship(back_populates="user", cascade="all, delete")
    subscriptions: Mapped[List["Subscription"]] = relationship(back_populates="user", cascade="all, delete")
    notifications: Mapped[List["Notification"]] = relationship(back_populates="user", cascade="all, delete")
    portfolios: Mapped[List["Portfolio"]] = relationship(back_populates="user", cascade="all, delete")
    saved_queries: Mapped[List["SavedQuery"]] = relationship(back_populates="user", cascade="all, delete")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    refresh_token: Mapped[str] = mapped_column(String, unique=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    user: Mapped["User"] = relationship(back_populates="sessions")


class Watchlist(Base):
    __tablename__ = "watchlists"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    user: Mapped["User"] = relationship(back_populates="watchlists")
    items: Mapped[List["WatchlistItem"]] = relationship(back_populates="watchlist", cascade="all, delete")


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    watchlist_id: Mapped[str] = mapped_column(ForeignKey("watchlists.id", ondelete="CASCADE"))
    symbol: Mapped[str] = mapped_column(String)
    target_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    alert_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    watchlist: Mapped["Watchlist"] = relationship(back_populates="items")


class SavedScreen(Base):
    __tablename__ = "saved_screens"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    query_text: Mapped[str] = mapped_column(Text)
    alert_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    alert_frequency: Mapped[str] = mapped_column(String, default="IMMEDIATE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    user: Mapped["User"] = relationship(back_populates="saved_screens")


class SavedQuery(Base):
    __tablename__ = "saved_queries"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    query_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    user: Mapped["User"] = relationship(back_populates="saved_queries")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    plan: Mapped[str] = mapped_column(String, default="FREE")
    status: Mapped[str] = mapped_column(String)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    payu_txn_id: Mapped[Optional[str]] = mapped_column(String, unique=True, nullable=True)
    payu_order_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    amount: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)

    user: Mapped["User"] = relationship(back_populates="subscriptions")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String)
    body: Mapped[str] = mapped_column(Text)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    symbol: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    action_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    user: Mapped["User"] = relationship(back_populates="notifications")


class Portfolio(Base):
    __tablename__ = "portfolios"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    user: Mapped["User"] = relationship(back_populates="portfolios")
    holdings: Mapped[List["PortfolioHolding"]] = relationship(back_populates="portfolio", cascade="all, delete")


class PortfolioHolding(Base):
    __tablename__ = "portfolio_holdings"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=new_uuid)
    portfolio_id: Mapped[str] = mapped_column(ForeignKey("portfolios.id", ondelete="CASCADE"))
    symbol: Mapped[str] = mapped_column(String)
    company_name: Mapped[str] = mapped_column(String)
    quantity: Mapped[float] = mapped_column(Float, default=0.0)
    avg_buy_price: Mapped[float] = mapped_column(Float, default=0.0)
    buy_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

    portfolio: Mapped["Portfolio"] = relationship(back_populates="holdings")


class CompanyMetric(Base):
    __tablename__ = "company_metrics"

    symbol: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    sector: Mapped[str] = mapped_column(String, default="Other")
    industry: Mapped[str] = mapped_column(String, default="Other")
    cmp: Mapped[float] = mapped_column(Float, default=0.0)
    change_pct: Mapped[float] = mapped_column(Float, default=0.0)
    market_cap: Mapped[float] = mapped_column(Float, default=0.0)
    pe: Mapped[float] = mapped_column(Float, default=0.0)
    pb: Mapped[float] = mapped_column(Float, default=0.0)
    dividend_yield: Mapped[float] = mapped_column(Float, default=0.0)
    roe: Mapped[float] = mapped_column(Float, default=0.0)
    roce: Mapped[float] = mapped_column(Float, default=0.0)
    debt_to_equity: Mapped[float] = mapped_column(Float, default=0.0)
    sales_growth_3y: Mapped[float] = mapped_column(Float, default=0.0)
    profit_growth_3y: Mapped[float] = mapped_column(Float, default=0.0)
    net_profit_margin: Mapped[float] = mapped_column(Float, default=0.0)
    ebitda_margin: Mapped[float] = mapped_column(Float, default=0.0)
    promoter_holding: Mapped[float] = mapped_column(Float, default=0.0)
    fii_holding: Mapped[float] = mapped_column(Float, default=0.0)
    current_ratio: Mapped[float] = mapped_column(Float, default=0.0)
    interest_coverage: Mapped[float] = mapped_column(Float, default=0.0)
    high_52w: Mapped[float] = mapped_column(Float, default=0.0)
    low_52w: Mapped[float] = mapped_column(Float, default=0.0)
    eps: Mapped[float] = mapped_column(Float, default=0.0)
    book_value: Mapped[float] = mapped_column(Float, default=0.0)
    rsi14: Mapped[float] = mapped_column(Float, default=0.0)
    beta: Mapped[float] = mapped_column(Float, default=0.0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc, onupdate=now_utc)


# ── DB Session Dependency ──────────────────────────────────────────────────────

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
