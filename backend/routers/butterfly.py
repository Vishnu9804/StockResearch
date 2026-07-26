"""
routers/butterfly.py
Read/action API over the Butterfly Effect workflow's two outputs.

  /alerts*     per-user, portfolio-aware (O1 + Workflow B scoring joined into
               user_news_alerts) — RED/ORANGE/YELLOW, requires auth.
  /thematic*   O2, portfolio-INDEPENDENT — identical for every user, so it is
               served publicly, the same way routers/news.py serves the
               general feed with no auth.
  /analysis/{news_id}   the raw O1 row for one news item — the "why" behind a
               general-feed card, also public (it describes the world, not a
               user).

Nothing here calls an LLM. Everything is served straight out of the tables
agents/butterfly/pipeline.py and services/butterfly_scorer.py already wrote.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from core.database import async_session_maker, get_db
from dependencies.db_user import get_db_user
from models.models import NewsImpactAnalysis, NewsItem, NewsThematicResearch, User, UserNewsAlert

logger = logging.getLogger("butterfly.router")

router = APIRouter(prefix="/api/butterfly", tags=["butterfly"])

_SEVERITY_ORDER = {"RED": 0, "ORANGE": 1, "YELLOW": 2}


def _alert_to_dict(alert: UserNewsAlert, news: NewsItem | None) -> dict[str, Any]:
    return {
        "id": str(alert.id),
        "newsId": str(alert.news_id),
        "symbol": alert.symbol,
        "companyName": alert.company_name,
        "severity": alert.severity,
        "score": float(alert.score) if alert.score is not None else None,
        "direction": alert.direction,
        "scoreComponents": alert.score_components,
        "chain": alert.chain,
        "explanation": alert.explanation,
        "hops": alert.hops,
        "exposureValue": float(alert.exposure_value) if alert.exposure_value is not None else None,
        "exposurePct": float(alert.exposure_pct) if alert.exposure_pct is not None else None,
        "createdAt": alert.created_at.isoformat(),
        "readAt": alert.read_at.isoformat() if alert.read_at else None,
        "dismissedAt": alert.dismissed_at.isoformat() if alert.dismissed_at else None,
        "userFeedback": alert.user_feedback,
        "news": {
            "title": news.title,
            "summary": news.summary,
            "url": news.url,
            "sourceName": news.source_name,
            "publishedAt": news.published_at.isoformat(),
        } if news else None,
    }


@router.get("/alerts")
async def list_alerts(
    db_user: User = Depends(get_db_user),
    db: AsyncSession = Depends(get_db),
    severity: str | None = Query(None, description="Filter to one severity: RED, ORANGE, or YELLOW"),
    include_dismissed: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
    page: int = Query(1, ge=1),
):
    """The user's inbox: RED first, then ORANGE, then YELLOW, newest first
    within each. Anything below YELLOW never became a row at all — see
    services/butterfly_scorer.py — so it simply isn't here; those stories
    belong in the general /api/news feed instead."""
    filters = [UserNewsAlert.user_id == db_user.id]
    if severity:
        severity = severity.upper()
        if severity not in _SEVERITY_ORDER:
            raise HTTPException(status_code=400, detail="severity must be RED, ORANGE, or YELLOW")
        filters.append(UserNewsAlert.severity == severity)
    if not include_dismissed:
        filters.append(UserNewsAlert.dismissed_at.is_(None))

    total = await db.scalar(select(func.count()).select_from(UserNewsAlert).where(*filters))
    rows = (
        await db.execute(
            select(UserNewsAlert, NewsItem)
            .join(NewsItem, NewsItem.id == UserNewsAlert.news_id)
            .where(*filters)
            .order_by(UserNewsAlert.severity, UserNewsAlert.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
    ).all()
    rows.sort(key=lambda pair: (_SEVERITY_ORDER.get(pair[0].severity, 9), -pair[0].created_at.timestamp()))

    return {
        "data": [_alert_to_dict(alert, news) for alert, news in rows],
        "total": total or 0,
        "page": page,
        "limit": limit,
    }


@router.get("/alerts/summary")
async def alerts_summary(db_user: User = Depends(get_db_user), db: AsyncSession = Depends(get_db)):
    """Unread counts per severity — what a bell-icon badge needs."""
    rows = (
        await db.execute(
            select(UserNewsAlert.severity, func.count())
            .where(
                UserNewsAlert.user_id == db_user.id,
                UserNewsAlert.read_at.is_(None),
                UserNewsAlert.dismissed_at.is_(None),
            )
            .group_by(UserNewsAlert.severity)
        )
    ).all()
    counts = {"RED": 0, "ORANGE": 0, "YELLOW": 0}
    counts.update({severity: count for severity, count in rows})
    return {"unread": counts, "unreadTotal": sum(counts.values())}


async def _get_owned_alert(db: AsyncSession, db_user: User, alert_id: UUID) -> UserNewsAlert:
    alert = await db.get(UserNewsAlert, alert_id)
    if alert is None or alert.user_id != db_user.id:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.patch("/alerts/{alert_id}/read")
async def mark_alert_read(alert_id: UUID, db_user: User = Depends(get_db_user), db: AsyncSession = Depends(get_db)):
    alert = await _get_owned_alert(db, db_user, alert_id)
    alert.read_at = datetime.now(timezone.utc)
    await db.commit()
    return {"success": True}


@router.patch("/alerts/{alert_id}/dismiss")
async def dismiss_alert(alert_id: UUID, db_user: User = Depends(get_db_user), db: AsyncSession = Depends(get_db)):
    alert = await _get_owned_alert(db, db_user, alert_id)
    alert.dismissed_at = datetime.now(timezone.utc)
    await db.commit()
    return {"success": True}


class AlertFeedbackBody(BaseModel):
    thumbs_up: bool = Field(description="True = this alert was useful/accurate, False = it wasn't")


@router.post("/alerts/{alert_id}/feedback")
async def submit_alert_feedback(
    alert_id: UUID,
    body: AlertFeedbackBody,
    db_user: User = Depends(get_db_user),
    db: AsyncSession = Depends(get_db),
):
    """The training signal user_news_alerts.user_feedback exists for — without
    it there is no way to ever prove the scorer's thresholds are calibrated
    right."""
    alert = await _get_owned_alert(db, db_user, alert_id)
    alert.user_feedback = 1 if body.thumbs_up else -1
    await db.commit()
    return {"success": True}


def _thematic_to_dict(research: NewsThematicResearch, news: NewsItem | None) -> dict[str, Any]:
    return {
        "id": str(research.id),
        "newsId": str(research.news_id),
        "derivedNeed": research.derived_need,
        "candidateCompanies": research.candidate_companies,
        "thesis": research.thesis,
        "confidence": float(research.confidence) if research.confidence is not None else None,
        "novelty": float(research.novelty) if research.novelty is not None else None,
        "horizon": research.horizon,
        "evidence": research.evidence,
        "createdAt": research.created_at.isoformat(),
        "news": {
            "title": news.title,
            "summary": news.summary,
            "url": news.url,
            "sourceName": news.source_name,
            "publishedAt": news.published_at.isoformat(),
        } if news else None,
    }


@router.get("/thematic")
async def list_thematic_research(
    limit: int = Query(20, ge=1, le=100),
    page: int = Query(1, ge=1),
    since_hours: int = Query(168, ge=1, le=720),
):
    """Public, portfolio-independent 'new demand this news creates' feed (O2).
    Identical for every user, same as the general news feed — no auth needed.
    Sparse by design: most news never produces a row here at all."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=since_hours)
    filters = [NewsThematicResearch.created_at >= cutoff]

    async with async_session_maker() as session:
        total = await session.scalar(
            select(func.count()).select_from(NewsThematicResearch).where(*filters)
        )
        rows = (
            await session.execute(
                select(NewsThematicResearch, NewsItem)
                .join(NewsItem, NewsItem.id == NewsThematicResearch.news_id)
                .where(*filters)
                .order_by(NewsThematicResearch.created_at.desc())
                .offset((page - 1) * limit)
                .limit(limit)
            )
        ).all()

    return {
        "data": [_thematic_to_dict(research, news) for research, news in rows],
        "total": total or 0,
        "page": page,
        "limit": limit,
    }


@router.get("/analysis/{news_id}")
async def get_analysis(news_id: UUID):
    """The raw O1 row for one news item — public, portfolio-independent (it
    describes the world, not any one user). This is the 'why' a frontend can
    show behind a general-feed card without needing a logged-in user."""
    async with async_session_maker() as session:
        analysis = (
            await session.execute(
                select(NewsImpactAnalysis)
                .where(NewsImpactAnalysis.news_id == news_id)
                .order_by(NewsImpactAnalysis.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()

    if analysis is None:
        raise HTTPException(status_code=404, detail="No analysis for this news item yet")

    return {
        "id": str(analysis.id),
        "newsId": str(analysis.news_id),
        "workflowVersion": analysis.workflow_version,
        "event": analysis.event,
        "causalChains": analysis.causal_chains,
        "exposureAxes": analysis.exposure_axes,
        "marketSignificance": float(analysis.market_significance) if analysis.market_significance is not None else None,
        "confidence": float(analysis.confidence) if analysis.confidence is not None else None,
        "novelty": float(analysis.novelty) if analysis.novelty is not None else None,
        "horizon": analysis.horizon,
        "createdAt": analysis.created_at.isoformat(),
    }
