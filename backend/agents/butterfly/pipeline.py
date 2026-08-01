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
    DIRECTION_TO_INT,
    SkepticResult,
    ThematicExtractorResult,
    ThematicTriggerResult,
    TriageResult,
)
from agents.butterfly.verifier import verify_thematic_result
from agents.shared.adk_runner import QuotaExhaustedError, is_quota_error, run_agent_text
from agents.shared.json_utils import parse_structured
from core.config import settings
from services.butterfly_scorer import score_analysis_for_users

logger = logging.getLogger("agents.butterfly.pipeline")

WORKFLOW_VERSION = "butterfly-v1"


async def analyze_news_item(news_id) -> None:
    async with async_session_maker() as session:
        news = await session.get(NewsItem, news_id)
        if news is None:
            logger.warning("[butterfly.pipeline] news_id=%s not found — skipping", news_id)
            return
        title = news.title
        news.analysis_status = "ANALYZING"
        await session.commit()

    logger.info("[butterfly.pipeline] news_id=%s START — %r", news_id, title[:80])

    try:
        result = await _run_pipeline(news)
    except Exception as exc:
        quota_hit = is_quota_error(exc)
        if quota_hit:
            # agents/shared/adk_runner.py already logged exactly which model
            # hit its limit — a second, full-traceback dump of the same
            # (very long) Gemini error here would just be noise.
            logger.info("[butterfly.pipeline] news_id=%s paused — waiting on quota", news_id)
        else:
            logger.exception("[butterfly.pipeline] news_id=%s FAILED — %s", news_id, exc)
        async with async_session_maker() as session:
            news = await session.get(NewsItem, news_id)
            if news is None:
                return
            news.analysis_error = str(exc)[:2000]
            if quota_hit:
                # Not this item's fault — don't spend one of its limited
                # attempts on an infra/quota failure. Left as PENDING so the
                # next healthy cycle retries it first, same as before ANALYZING.
                news.analysis_status = "PENDING"
            else:
                news.analysis_attempts += 1
                news.analysis_status = (
                    "FAILED" if news.analysis_attempts >= settings.BUTTERFLY_MAX_ANALYSIS_ATTEMPTS else "PENDING"
                )
            await session.commit()
            logger.info(
                "[butterfly.pipeline] news_id=%s attempt %d/%d — status now %s%s",
                news_id, news.analysis_attempts, settings.BUTTERFLY_MAX_ANALYSIS_ATTEMPTS,
                news.analysis_status, " (quota — attempt not charged)" if quota_hit else "",
            )
        if quota_hit:
            # Propagate so the worker loop stops burning through the rest of
            # this batch against a quota that's already at zero, and cools
            # down instead — see agents/shared/adk_runner.py.
            raise QuotaExhaustedError(str(exc)) from exc
        return

    async with async_session_maker() as session:
        news = await session.get(NewsItem, news_id)
        if news is None:
            return
        news.analysis_status = result["news_status"]
        news.analysis_error = None
        await session.commit()

    logger.info("[butterfly.pipeline] news_id=%s DONE — status=%s", news_id, result["news_status"])


async def _run_pipeline(news: NewsItem) -> dict:
    article_text = prompts.format_article(news)

    # ── Step 1: Triage ────────────────────────────────────────────────────
    started = time.monotonic()
    triage_raw = await run_agent_text(butterfly_agents.triage_agent(), article_text)
    triage = parse_structured(triage_raw, TriageResult)
    logger.info(
        "[butterfly.pipeline] news_id=%s triage — relevant=%s significance=%.2f event_type=%s",
        news.id, triage.is_market_relevant, triage.significance, triage.event_type,
    )

    if not triage.is_market_relevant or triage.significance < settings.BUTTERFLY_TRIAGE_SIGNIFICANCE_FLOOR:
        logger.info(
            "[butterfly.pipeline] news_id=%s SKIPPED at triage (floor=%.2f)",
            news.id, settings.BUTTERFLY_TRIAGE_SIGNIFICANCE_FLOOR,
        )
        return {"news_status": "SKIPPED"}

    # ── Step 2: Causal Analyst ───────────────────────────────────────────
    causal_raw = await run_agent_text(
        butterfly_agents.causal_analyst_agent(),
        prompts.format_causal_input(article_text, triage),
    )
    causal = parse_structured(causal_raw, CausalAnalysisResult)
    logger.info(
        "[butterfly.pipeline] news_id=%s causal analyst — %d chain(s): %s",
        news.id, len(causal.chains), [c.key for c in causal.chains],
    )

    # ── Step 3: Skeptic ──────────────────────────────────────────────────
    if causal.chains:
        skeptic_raw = await run_agent_text(
            butterfly_agents.skeptic_agent(),
            prompts.format_skeptic_input(article_text, causal),
        )
        skeptic = parse_structured(skeptic_raw, SkepticResult)
        logger.info(
            "[butterfly.pipeline] news_id=%s skeptic — %s",
            news.id, [(v.chain_id, v.verdict) for v in skeptic.verdicts],
        )
    else:
        skeptic = SkepticResult(verdicts=[])

    compiled = compile_analysis(triage, causal, skeptic)
    latency_ms = int((time.monotonic() - started) * 1000)
    logger.info(
        "[butterfly.pipeline] news_id=%s compiled — %d surviving chain(s), "
        "%d exposure axis(es), confidence=%.2f, latency_ms=%d",
        news.id, len(compiled["causal_chains"]), len(compiled["exposure_axes"]),
        compiled["confidence"], latency_ms,
    )

    analysis_id = await _write_analysis(news, compiled, latency_ms)
    logger.info("[butterfly.pipeline] news_id=%s wrote news_impact_analyses id=%s", news.id, analysis_id)

    # ── Workflow B: score this analysis against every user's portfolio ──
    if compiled["exposure_axes"] or news.mentioned_symbols:
        try:
            await score_analysis_for_users(news, analysis_id, compiled)
            logger.info("[butterfly.pipeline] news_id=%s scoring pass complete", news.id)
        except Exception:
            logger.exception("[butterfly.pipeline] scoring failed news_id=%s", news.id)
    else:
        logger.info(
            "[butterfly.pipeline] news_id=%s scoring skipped — no exposure axes and no named symbols",
            news.id,
        )

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
    logger.info(
        "[butterfly.pipeline] news_id=%s thematic trigger — opportunity=%s need_key=%s",
        news.id, trigger.has_thematic_opportunity, trigger.need_key,
    )

    if not trigger.has_thematic_opportunity:
        return

    if settings.BUTTERFLY_SKIP_GROUNDED_RESEARCH:
        logger.warning(
            "[butterfly.pipeline] news_id=%s thematic trigger fired (need_key=%s) but "
            "BUTTERFLY_SKIP_GROUNDED_RESEARCH is set — skipping the google_search-grounded "
            "researcher_agent call rather than retrying a 429 it can't clear. No "
            "news_thematic_research row written this pass.",
            news.id, trigger.need_key,
        )
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
            "demand_direction": DIRECTION_TO_INT[trigger.demand_direction],
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

    logger.info(
        "[butterfly.pipeline] news_id=%s wrote news_thematic_research — %d candidate company(ies)",
        news.id, len(verified["candidate_companies"]),
    )
