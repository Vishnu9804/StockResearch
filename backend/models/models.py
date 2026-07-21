import uuid
from datetime import date, datetime

from sqlalchemy import ForeignKey, Text, Numeric, Boolean, Date, DateTime, Index, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auth_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), unique=True)
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    plan: Mapped[str] = mapped_column(Text, server_default="FREE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Watchlist(Base):
    __tablename__ = "watchlists"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list["WatchlistItem"]] = relationship(
        back_populates="watchlist", cascade="all, delete-orphan", order_by="WatchlistItem.created_at"
    )


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    watchlist_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("watchlists.id"), nullable=False)
    symbol: Mapped[str] = mapped_column(Text, nullable=False)
    company_name: Mapped[str | None] = mapped_column(Text)
    target_price: Mapped[float | None] = mapped_column(Numeric)
    alert_enabled: Mapped[bool] = mapped_column(Boolean, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    watchlist: Mapped["Watchlist"] = relationship(back_populates="items")


class Portfolio(Base):
    __tablename__ = "portfolios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    holdings: Mapped[list["PortfolioHolding"]] = relationship(
        back_populates="portfolio", cascade="all, delete-orphan", order_by="PortfolioHolding.created_at"
    )


class PortfolioHolding(Base):
    __tablename__ = "portfolio_holdings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    portfolio_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("portfolios.id"), nullable=False)
    symbol: Mapped[str] = mapped_column(Text, nullable=False)
    company_name: Mapped[str | None] = mapped_column(Text)
    quantity: Mapped[float] = mapped_column(Numeric, server_default="0.0")
    avg_buy_price: Mapped[float] = mapped_column(Numeric, server_default="0.0")
    buy_date: Mapped[date | None] = mapped_column(Date)
    extra_metadata: Mapped[dict | None] = mapped_column("metadata", JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    portfolio: Mapped["Portfolio"] = relationship(back_populates="holdings")


class CompanyMetric(Base):
    """Local cache of screenable stock fundamentals, synced from FinEdge's
    working endpoints (bulk /quote + per-symbol /ratios). FinEdge has no real
    screener endpoint of its own — this table is what the screener actually
    filters against."""
    __tablename__ = "company_metrics"
    __table_args__ = (Index("ix_company_metrics_symbol", "symbol", unique=True),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    sector: Mapped[str | None] = mapped_column(Text)
    industry: Mapped[str | None] = mapped_column(Text)

    cmp: Mapped[float | None] = mapped_column(Numeric)
    change_pct: Mapped[float | None] = mapped_column(Numeric)
    market_cap: Mapped[float | None] = mapped_column(Numeric)
    high_52w: Mapped[float | None] = mapped_column(Numeric)
    low_52w: Mapped[float | None] = mapped_column(Numeric)
    volume: Mapped[float | None] = mapped_column(Numeric)

    pe: Mapped[float | None] = mapped_column(Numeric)
    pb: Mapped[float | None] = mapped_column(Numeric)
    dividend_yield: Mapped[float | None] = mapped_column(Numeric)
    roe: Mapped[float | None] = mapped_column(Numeric)
    roce: Mapped[float | None] = mapped_column(Numeric)
    net_profit_margin: Mapped[float | None] = mapped_column(Numeric)
    ebitda_margin: Mapped[float | None] = mapped_column(Numeric)
    debt_to_equity: Mapped[float | None] = mapped_column(Numeric)
    current_ratio: Mapped[float | None] = mapped_column(Numeric)
    interest_coverage: Mapped[float | None] = mapped_column(Numeric)
    sales_growth_3y: Mapped[float | None] = mapped_column(Numeric)
    profit_growth_3y: Mapped[float | None] = mapped_column(Numeric)
    promoter_holding: Mapped[float | None] = mapped_column(Numeric)
    fii_holding: Mapped[float | None] = mapped_column(Numeric)
    eps: Mapped[float | None] = mapped_column(Numeric)
    book_value: Mapped[float | None] = mapped_column(Numeric)

    quote_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fundamentals_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserRatioPreference(Base):
    """Which extra (opt-in) ratio-catalog keys a user has chosen to see on every
    company page, via the 'Add Ratio' picker. Global per-user, not per-company."""
    __tablename__ = "user_ratio_preferences"
    __table_args__ = (Index("ix_user_ratio_preferences_user_ratio", "user_id", "ratio_key", unique=True),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    ratio_key: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CustomRatio(Base):
    """A user-defined formula (e.g. 'Graham Number') built from the same
    variable catalog used by the Screener, evaluated on demand against live
    FinEdge company data — see services/custom_ratio_engine.py."""
    __tablename__ = "custom_ratios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    formula: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SavedQuery(Base):
    __tablename__ = "saved_queries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    query_text: Mapped[str] = mapped_column(Text, nullable=False)
    alert_enabled: Mapped[bool] = mapped_column(Boolean, server_default="false")
    alert_frequency: Mapped[str] = mapped_column(Text, server_default="IMMEDIATE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
