"""
routers/news.py
Read API over the central news store, plus ingestion ops endpoints.

The feed is served from ``news_items`` rather than proxied per-request. News is
identical for every user, so fetching it once into the database and serving all
users from there is both cheaper and a hard prerequisite for the Butterfly
Effect workflow, which must analyse each story exactly once — not once per
viewer.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from sqlalchemy import func, or_, select

from core.config import settings
from core.database import async_session_maker
from models.models import NewsItem
from services.news_ingest import cleanup_stale_news, ingest_news
from services.news_sources.rss_client import RSS_FEEDS, feed_health

logger = logging.getLogger("news.router")

router = APIRouter(prefix="/api/news", tags=["news"])

# Feed-card colours, keyed by the coarse category set on ingestion. Kept here so
# the palette lives with the API that serves it, matching how routers/finedge.py
# already colours announcement categories.
CATEGORY_COLORS: dict[str, str] = {
    "MACRO": "var(--fs-brand)",
    "MARKETS": "var(--fs-positive)",
    "COMMODITY": "#f59e0b",
    "POLICY": "#8b5cf6",
    "GLOBAL": "#06b6d4",
    "SECTOR": "#10b981",
    "CORPORATE": "#64748b",
}
DEFAULT_COLOR = "var(--fs-brand)"


def _relative_time(published: datetime) -> str:
    now = datetime.now(timezone.utc)
    if published.tzinfo is None:
        published = published.replace(tzinfo=timezone.utc)
    delta = now - published

    if delta < timedelta(minutes=1):
        return "Just now"
    if delta < timedelta(hours=1):
        return f"{int(delta.total_seconds() // 60)}m ago"
    if delta < timedelta(days=1):
        return f"{int(delta.total_seconds() // 3600)}h ago"
    if delta < timedelta(days=2):
        return "Yesterday"
    return f"{delta.days}d ago"


def _to_card(item: NewsItem) -> dict[str, Any]:
    """Shape a row into the news-card contract the frontend already renders."""
    return {
        "id": str(item.id),
        "category": item.category or "MARKET",
        "categoryColor": CATEGORY_COLORS.get(item.category or "", DEFAULT_COLOR),
        "headline": item.title,
        "summary": item.summary or "",
        "time": _relative_time(item.published_at),
        "publishedAt": item.published_at.isoformat(),
        "source": item.source_name,
        "url": item.url,
        "symbols": list(item.mentioned_symbols or []),
        "regions": list(item.regions or []),
    }


@router.get("")
async def list_news(
    request: Request,
    limit: int = Query(25, ge=1, le=100),
    page: int = Query(1, ge=1),
    category: str | None = Query(None),
    symbol: str | None = Query(None),
    q: str | None = Query(None, description="Full-text search over title/summary/source, across the whole table — not just the current page"),
    since_hours: int = Query(72, ge=1, le=720),
):
    """Paginated general news feed, newest first.

    ``symbol`` filters on companies the article NAMES. It is not the butterfly
    alert set — indirect impact lives in user_news_alerts and is served by the
    alerts endpoint once the workflow is in place.

    ``q`` is a server-side search. It must be — a client that only filters the
    25 items already on screen will report "no results" for a search term that
    exists in row 400 of 629, which is a real accuracy problem for a page
    whose whole point is "does this term appear in the news," not a UI nicety.
    """
    filters = [
        NewsItem.duplicate_of_id.is_(None),
        # A source can mislabel its own language (verified live: PIB serves
        # Hindi while its feed URL claims English) — services/news_ingest.py
        # detects the real language from the title itself, and this is the
        # feed-facing enforcement of that: never show a non-English row in the
        # default English feed regardless of what any upstream source claims.
        NewsItem.language == "en",
    ]
    if category:
        filters.append(NewsItem.category == category.upper())
    if symbol:
        filters.append(NewsItem.mentioned_symbols.any(symbol.upper()))
    if q:
        # An explicit search means "find it anywhere in the store" — a term
        # that exists but falls just outside the default recency window
        # reporting "no results" would be a second, independent way to wrongly
        # tell a user something isn't there when it is.
        like = f"%{q.strip()}%"
        filters.append(or_(
            NewsItem.title.ilike(like),
            NewsItem.summary.ilike(like),
            NewsItem.source_name.ilike(like),
        ))
    else:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=since_hours)
        filters.append(NewsItem.published_at >= cutoff)

    async with async_session_maker() as session:
        total = await session.scalar(
            select(func.count()).select_from(NewsItem).where(*filters)
        )
        rows = (
            await session.execute(
                select(NewsItem)
                .where(*filters)
                .order_by(NewsItem.published_at.desc())
                .offset((page - 1) * limit)
                .limit(limit)
            )
        ).scalars().all()

    return {
        "data": [_to_card(row) for row in rows],
        "total": total or 0,
        "page": page,
        "limit": limit,
    }


@router.get("/latest")
async def latest_news(limit: int = Query(12, ge=1, le=50)):
    """Flat array for sidebar widgets — matches the legacy /market/news shape so
    existing frontend callers keep working unchanged."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    async with async_session_maker() as session:
        rows = (
            await session.execute(
                select(NewsItem)
                .where(
                    NewsItem.published_at >= cutoff,
                    NewsItem.duplicate_of_id.is_(None),
                    NewsItem.language == "en",
                )
                .order_by(NewsItem.published_at.desc())
                .limit(limit)
            )
        ).scalars().all()

    return [_to_card(row) for row in rows]


@router.get("/health")
async def news_health():
    """Ingestion observability: row counts, freshness, and per-feed state.

    RSS URLs rot silently — a publisher reorganises a section and the feed 404s
    forever. ``feeds`` is what turns that into something you can see.
    """
    async with async_session_maker() as session:
        total = await session.scalar(select(func.count()).select_from(NewsItem))
        newest = await session.scalar(select(func.max(NewsItem.published_at)))
        last_24h = await session.scalar(
            select(func.count())
            .select_from(NewsItem)
            .where(NewsItem.ingested_at >= datetime.now(timezone.utc) - timedelta(hours=24))
        )
        by_status = (
            await session.execute(
                select(NewsItem.analysis_status, func.count())
                .group_by(NewsItem.analysis_status)
            )
        ).all()
        by_category = (
            await session.execute(
                select(NewsItem.category, func.count())
                .group_by(NewsItem.category)
                .order_by(func.count().desc())
            )
        ).all()

    feeds = feed_health()
    return {
        "total_items": total or 0,
        "ingested_last_24h": last_24h or 0,
        "newest_published_at": newest.isoformat() if newest else None,
        "analysis_status": {status: count for status, count in by_status},
        "categories": {(cat or "UNCLASSIFIED"): count for cat, count in by_category},
        "registered_feeds": len(RSS_FEEDS),
        "feeds_reporting": len(feeds),
        "feeds_failing": [f["slug"] for f in feeds if not f["ok"]],
        "feeds": feeds,
    }


@router.post("/ingest")
async def trigger_ingest(include_gdelt: bool = Query(True)):
    """Run one ingestion cycle synchronously.

    Manual trigger for first-run seeding and for testing feed changes without
    waiting on the background loop.
    """
    try:
        return await ingest_news(include_gdelt=include_gdelt)
    except Exception as exc:
        logger.error("[news.router] manual ingest failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail=f"Ingestion failed: {exc}")


@router.post("/cleanup")
async def trigger_cleanup(retention_days: int | None = Query(None, ge=1)):
    """Manual trigger for the retention pass — same time-based delete the
    background loop runs once a day (core.config.NEWS_RETENTION_DAYS)."""
    try:
        return await cleanup_stale_news(retention_days)
    except Exception as exc:
        logger.error("[news.router] manual cleanup failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail=f"Cleanup failed: {exc}")
