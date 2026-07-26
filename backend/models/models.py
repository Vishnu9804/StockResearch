import uuid
from datetime import date, datetime

from sqlalchemy import (
    ForeignKey, Text, Numeric, Boolean, Date, DateTime, Index, Integer,
    SmallInteger, UniqueConstraint, func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
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


class NewsItem(Base):
    """Canonical, deduplicated news store — the INPUT to the Butterfly Effect
    workflow. FinEdge has no news product (it serves fundamentals, filings and
    market data), so these rows come from publisher RSS feeds and GDELT via
    services/news_ingest.py, plus corporate announcements already proxied from
    FinEdge.

    ``mentioned_symbols`` holds only the companies an article names outright.
    It is deliberately NOT the alert set — the whole point of the feature is
    that most alerts fire for symbols that never appear in this column."""

    __tablename__ = "news_items"
    __table_args__ = (
        Index("ix_news_items_published_at", "published_at"),
        Index("ix_news_items_title_hash", "title_hash"),
        Index("ix_news_items_cluster", "cluster_key"),
        Index("ix_news_items_category", "category"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    url: Mapped[str] = mapped_column(Text, nullable=False)
    url_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    title_hash: Mapped[str] = mapped_column(Text, nullable=False)
    cluster_key: Mapped[str | None] = mapped_column(Text)
    duplicate_of_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("news_items.id")
    )

    title: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    body: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(Text)
    language: Mapped[str] = mapped_column(Text, server_default="en")

    source_name: Mapped[str] = mapped_column(Text, nullable=False)
    source_slug: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[str] = mapped_column(Text, nullable=False)
    source_tier: Mapped[int] = mapped_column(SmallInteger, server_default="3")
    author: Mapped[str | None] = mapped_column(Text)

    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    category: Mapped[str | None] = mapped_column(Text)
    event_type: Mapped[str | None] = mapped_column(Text)
    regions: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default="{}")
    mentioned_symbols: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default="{}")
    mentioned_entities: Mapped[list] = mapped_column(JSONB, server_default="[]")

    market_relevance: Mapped[float | None] = mapped_column(Numeric)
    analysis_status: Mapped[str] = mapped_column(Text, server_default="PENDING")
    analysis_attempts: Mapped[int] = mapped_column(SmallInteger, server_default="0")
    analysis_error: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class NewsImpactAnalysis(Base):
    """Output of the multi-agent workflow — one row per (news, workflow_version).

    Portfolio-independent on purpose: it describes the world ("nickel supply
    tightens, nickel consumers face input-cost pressure over ~2 quarters"), not
    any particular user. Joining it to a user's holdings is deterministic Python
    against ``exposure_axes``, so cost scales with news volume rather than with
    news x users x holdings."""

    __tablename__ = "news_impact_analyses"
    __table_args__ = (
        UniqueConstraint("news_id", "workflow_version", name="news_impact_analyses_unique"),
        Index("ix_news_impact_news", "news_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    news_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("news_items.id", ondelete="CASCADE"), nullable=False
    )
    workflow_version: Mapped[str] = mapped_column(Text, nullable=False)

    event: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    causal_chains: Mapped[list] = mapped_column(JSONB, server_default="[]")
    exposure_axes: Mapped[list] = mapped_column(JSONB, server_default="[]")

    market_significance: Mapped[float | None] = mapped_column(Numeric)
    confidence: Mapped[float | None] = mapped_column(Numeric)
    novelty: Mapped[float | None] = mapped_column(Numeric)
    horizon: Mapped[str | None] = mapped_column(Text)
    skeptic_verdict: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    evidence: Mapped[list] = mapped_column(JSONB, server_default="[]")

    model_versions: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    token_usage: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(Text, server_default="OK")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CompanyExposureProfile(Base):
    """Per-company causal surface: what a company actually spends on, sells,
    where, in which currency, and how levered it is. Built offline once per
    company (refreshed quarterly) from FinEdge financials, segment revenue and
    concall transcripts.

    This is what turns a scoring model from opinion into arithmetic — a nickel
    shock is material to a company with nickel at 34% of COGS and immaterial to
    one at 2%, and only this table knows the difference."""

    __tablename__ = "company_exposure_profiles"
    __table_args__ = (
        Index("ix_exposure_sector", "sector"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    company_name: Mapped[str | None] = mapped_column(Text)
    sector: Mapped[str | None] = mapped_column(Text)
    industry: Mapped[str | None] = mapped_column(Text)

    revenue_mix: Mapped[list] = mapped_column(JSONB, server_default="[]")
    cost_mix: Mapped[list] = mapped_column(JSONB, server_default="[]")
    input_commodities: Mapped[list] = mapped_column(JSONB, server_default="[]")
    output_markets: Mapped[list] = mapped_column(JSONB, server_default="[]")
    geographies: Mapped[list] = mapped_column(JSONB, server_default="[]")
    fx_exposure: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    customer_concentration: Mapped[list] = mapped_column(JSONB, server_default="[]")
    supplier_dependencies: Mapped[list] = mapped_column(JSONB, server_default="[]")
    regulatory_exposure: Mapped[list] = mapped_column(JSONB, server_default="[]")
    substitutes: Mapped[list] = mapped_column(JSONB, server_default="[]")
    complements: Mapped[list] = mapped_column(JSONB, server_default="[]")
    peers: Mapped[list] = mapped_column(JSONB, server_default="[]")

    rate_sensitivity: Mapped[float | None] = mapped_column(Numeric)
    commodity_beta: Mapped[float | None] = mapped_column(Numeric)
    export_share: Mapped[float | None] = mapped_column(Numeric)
    import_share: Mapped[float | None] = mapped_column(Numeric)

    axis_keys: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default="{}")

    evidence_refs: Mapped[list] = mapped_column(JSONB, server_default="[]")
    confidence: Mapped[float | None] = mapped_column(Numeric)
    profile_version: Mapped[str] = mapped_column(Text, server_default="v1")
    model_version: Mapped[str | None] = mapped_column(Text)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserNewsAlert(Base):
    """Materialised per-user alert: one row per (user, news, symbol) that
    cleared the YELLOW floor. Materialised rather than derived on read because
    push notifications, unread badges and after-the-fact auditing ("why did you
    alert me last Tuesday?") all need a durable record of what was sent."""

    __tablename__ = "user_news_alerts"
    __table_args__ = (
        UniqueConstraint("user_id", "news_id", "symbol", name="user_news_alerts_unique"),
        Index("ix_user_alerts_news", "news_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    portfolio_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("portfolios.id", ondelete="CASCADE")
    )
    news_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("news_items.id", ondelete="CASCADE"), nullable=False
    )
    analysis_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("news_impact_analyses.id")
    )

    symbol: Mapped[str] = mapped_column(Text, nullable=False)
    company_name: Mapped[str | None] = mapped_column(Text)

    severity: Mapped[str] = mapped_column(Text, nullable=False)
    score: Mapped[float] = mapped_column(Numeric, nullable=False)
    direction: Mapped[int] = mapped_column(SmallInteger, server_default="0")
    score_components: Mapped[dict] = mapped_column(JSONB, server_default="{}")

    chain: Mapped[list] = mapped_column(JSONB, server_default="[]")
    explanation: Mapped[str | None] = mapped_column(Text)
    hops: Mapped[int | None] = mapped_column(SmallInteger)

    exposure_value: Mapped[float | None] = mapped_column(Numeric)
    exposure_pct: Mapped[float | None] = mapped_column(Numeric)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dismissed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user_feedback: Mapped[int | None] = mapped_column(SmallInteger)


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
