"""
agents/butterfly/pipeline.py
The Butterfly workflow, run once per news item. Two independent outputs:

  O1 news_impact_analyses    world-level causal analysis. Never mentions a
                              held company — Workflow B (services/
                              butterfly_scorer.py) does that join in plain
                              Python, right after O1 commits.
  O2 news_thematic_research  sparse "what new demand does this create"
                              research. Most news earns nothing here, by
                              design.

Called by agents/butterfly/worker.py, one news_id at a time. Every step is an
explicit call through agents/shared/adk_runner.py — see that module for why
this isn't built on ADK's own SequentialAgent.
"""
import logging
import time

from sqlalchemy.dialects.postgresql import insert as pg_insert

from core.database import async_session_maker
from models.models import NewsImpactAnalysis, NewsItem, NewsThematicResearch
from agents.butterfly import agents as butterfly_agents
from agents.butterfly import prompts
from agents.butterfly.compiler import compile_analysis
from agents.butterfly.schemas import (
    CausalAnalysisResult,
    SkepticResult,
    ThematicExtractorResult,
    ThematicTriggerResult,
    TriageResult,
)
from agents.butterfly.verifier import verify_thematic_result
from agents.shared.adk_runner import run_agent_text
from agents.shared.json_utils import parse_structured
from core.config import settings
from services.butterfly_scorer import score_analysis_for_users

logger = logging.getLogger("agents.butterfly.pipeline")

WORKFLOW_VERSION = "butterfly-v1"


async def analyze_news_item(news_id) -> None:
    async with async_session_maker() as session:
        news = await session.get(NewsItem, news_id)
        if news is None:
            return
        news.analysis_status = "ANALYZING"
        await session.commit()

    try:
        result = await _run_pipeline(news)
    except Exception as exc:
        logger.exception("[butterfly.pipeline] news_id=%s failed", news_id)
        async with async_session_maker() as session:
            news = await session.get(NewsItem, news_id)
            if news is None:
                return
            news.analysis_attempts += 1
            news.analysis_error = str(exc)[:2000]
            news.analysis_status = (
                "FAILED" if news.analysis_attempts >= settings.BUTTERFLY_MAX_ANALYSIS_ATTEMPTS else "PENDING"
            )
            await session.commit()
        return

    async with async_session_maker() as session:
        news = await session.get(NewsItem, news_id)
        if news is None:
            return
        news.analysis_status = result["news_status"]
        news.analysis_error = None
        await session.commit()


async def _run_pipeline(news: NewsItem) -> dict:
    article_text = prompts.format_article(news)

    # ── Step 1: Triage ────────────────────────────────────────────────────
    started = time.monotonic()
    triage_raw = await run_agent_text(butterfly_agents.triage_agent(), article_text)
    triage = parse_structured(triage_raw, TriageResult)

    if not triage.is_market_relevant or triage.significance < settings.BUTTERFLY_TRIAGE_SIGNIFICANCE_FLOOR:
        return {"news_status": "SKIPPED"}

    # ── Step 2: Causal Analyst ───────────────────────────────────────────
    causal_raw = await run_agent_text(
        butterfly_agents.causal_analyst_agent(),
        prompts.format_causal_input(article_text, triage),
    )
    causal = parse_structured(causal_raw, CausalAnalysisResult)

    # ── Step 3: Skeptic ──────────────────────────────────────────────────
    if causal.chains:
        skeptic_raw = await run_agent_text(
            butterfly_agents.skeptic_agent(),
            prompts.format_skeptic_input(article_text, causal),
        )
        skeptic = parse_structured(skeptic_raw, SkepticResult)
    else:
        skeptic = SkepticResult(verdicts=[])

    compiled = compile_analysis(triage, causal, skeptic)
    latency_ms = int((time.monotonic() - started) * 1000)

    analysis_id = await _write_analysis(news, compiled, latency_ms)

    # ── Workflow B: score this analysis against every user's portfolio ──
    if compiled["exposure_axes"] or news.mentioned_symbols:
        try:
            await score_analysis_for_users(news, analysis_id, compiled)
        except Exception:
            logger.exception("[butterfly.pipeline] scoring failed news_id=%s", news.id)

    # ── Steps 4-6: Thematic research (sparse — most news earns nothing) ──
    await _run_thematic_research(news, analysis_id, article_text)

    return {"news_status": "ANALYZED"}


async def _write_analysis(news: NewsItem, compiled: dict, latency_ms: int):
    values = dict(
        news_id=news.id,
        workflow_version=WORKFLOW_VERSION,
        event=compiled["event"],
        causal_chains=compiled["causal_chains"],
        exposure_axes=compiled["exposure_axes"],
        market_significance=compiled["market_significance"],
        confidence=compiled["confidence"],
        novelty=compiled["novelty"],
        horizon=compiled["horizon"],
        skeptic_verdict=compiled["skeptic_verdict"],
        evidence=[],
        model_versions={
            "triage": settings.GEMINI_MODEL_CHEAP,
            "causal_analyst": settings.GEMINI_MODEL_SMART,
            "skeptic": settings.GEMINI_MODEL_SMART,
        },
        token_usage={},
        latency_ms=latency_ms,
        status="OK",
    )
    async with async_session_maker() as session:
        stmt = pg_insert(NewsImpactAnalysis).values(**values)
        update_cols = {k: stmt.excluded[k] for k in values if k not in ("news_id", "workflow_version")}
        stmt = stmt.on_conflict_do_update(
            index_elements=["news_id", "workflow_version"], set_=update_cols
        ).returning(NewsImpactAnalysis.id)
        result = await session.execute(stmt)
        await session.commit()
        return result.scalar_one()


async def _run_thematic_research(news: NewsItem, analysis_id, article_text: str) -> None:
    started = time.monotonic()
    trigger_raw = await run_agent_text(butterfly_agents.thematic_trigger_agent(), article_text)
    trigger = parse_structured(trigger_raw, ThematicTriggerResult)

    if not trigger.has_thematic_opportunity:
        return

    research_text = await run_agent_text(
        butterfly_agents.researcher_agent(),
        prompts.format_researcher_input(article_text, trigger),
    )
    extractor_raw = await run_agent_text(
        butterfly_agents.thematic_extractor_agent(),
        prompts.format_extractor_input(research_text),
    )
    extracted = parse_structured(extractor_raw, ThematicExtractorResult)
    verified = await verify_thematic_result(extracted)
    latency_ms = int((time.monotonic() - started) * 1000)

    values = dict(
        news_id=news.id,
        analysis_id=analysis_id,
        workflow_version=WORKFLOW_VERSION,
        trigger_reasoning=trigger.trigger_reasoning,
        derived_need={
            "need_type": trigger.need_type,
            "key": trigger.need_key,
            "description": trigger.need_description,
            "demand_direction": trigger.demand_direction,
        },
        candidate_companies=verified["candidate_companies"],
        thesis=verified["thesis"],
        confidence=verified["confidence"],
        novelty=verified["novelty"],
        horizon=verified["horizon"],
        skeptic_verdict={},
        evidence=verified["evidence"],
        model_versions={
            "trigger": settings.GEMINI_MODEL_CHEAP,
            "researcher": settings.GEMINI_MODEL_SMART,
            "extractor": settings.GEMINI_MODEL_CHEAP,
        },
        token_usage={},
        latency_ms=latency_ms,
        status="OK",
    )
    async with async_session_maker() as session:
        stmt = pg_insert(NewsThematicResearch).values(**values)
        update_cols = {k: stmt.excluded[k] for k in values if k not in ("news_id", "workflow_version")}
        stmt = stmt.on_conflict_do_update(
            index_elements=["news_id", "workflow_version"], set_=update_cols
        )
        await session.execute(stmt)
        await session.commit()
