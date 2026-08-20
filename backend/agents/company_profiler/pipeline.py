"""
agents/company_profiler/pipeline.py
Builds or refreshes ONE company_exposure_profiles row for ONE symbol. Runs
offline, on a slow cadence — see agents/company_profiler/worker.py — never
per news, never per user.

This is the workflow that makes services/butterfly_scorer.py's VERIFIED tier
possible: once a symbol has a row here, the scorer can compute a precise,
side-aware materiality/direction for it in plain Python, instead of the
sector-level guess it falls back to otherwise.
"""
import logging
import time

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from agents.company_profiler import agents as profiler_agents
from agents.company_profiler import prompts
from agents.company_profiler.schemas import ProfileExtractionResult
from agents.company_profiler.verifier import verify_and_shape
from agents.shared.adk_runner import run_agent_text
from agents.shared.json_utils import parse_structured
from agents.shared.zlm_web_search import format_results, web_search_many
from core.config import settings
from core.database import async_session_maker
from models.models import CompanyExposureProfile, CompanyMetric

logger = logging.getLogger("agents.company_profiler.pipeline")

WORKFLOW_VERSION = "company_profiler-v1"


async def build_profile(symbol: str) -> None:
    async with async_session_maker() as session:
        company = (
            await session.execute(select(CompanyMetric).where(CompanyMetric.symbol == symbol))
        ).scalar_one_or_none()

    if company is None:
        logger.warning("[company_profiler.pipeline] symbol=%s not found in company_metrics — skipping", symbol)
        return

    started = time.monotonic()
    logger.info("[company_profiler.pipeline] symbol=%s START — %s", symbol, company.name)

    # Three broad queries rather than one: this profile covers ten distinct
    # exposure categories (revenue mix through peers — see prompts.py), and a
    # single query rarely surfaces good evidence for all of them at once.
    queries = [
        f"{company.name} {symbol} annual report revenue business segments",
        f"{company.name} cost structure raw material input costs",
        f"{company.name} investor presentation export import currency exposure debt",
    ]
    try:
        search_results = await web_search_many(queries, count_per_query=settings.ZLM_WEB_SEARCH_RESULT_COUNT)
    except Exception:
        logger.exception(
            "[company_profiler.pipeline] symbol=%s web_search failed — deferring to next cycle",
            symbol,
        )
        return
    brief = prompts.format_company_brief(
        company.symbol, company.name, company.sector, company.industry, format_results(search_results),
    )

    research_text = await run_agent_text(profiler_agents.profiler_agent(), brief)
    extraction_raw = await run_agent_text(
        profiler_agents.extractor_agent(),
        prompts.format_extractor_input(research_text),
    )
    extraction = parse_structured(extraction_raw, ProfileExtractionResult)
    shaped = await verify_and_shape(symbol, extraction)
    latency_ms = int((time.monotonic() - started) * 1000)

    logger.info(
        "[company_profiler.pipeline] symbol=%s axes=%d peers=%d confidence=%.2f latency_ms=%d",
        symbol, len(shaped["axis_keys"]), len(shaped["peers"]), shaped["confidence"] or 0.0, latency_ms,
    )

    await _write_profile(symbol, company.name, company.sector, company.industry, shaped)


async def _write_profile(symbol: str, company_name: str, sector: str | None, industry: str | None, shaped: dict) -> None:
    values = dict(
        symbol=symbol,
        company_name=company_name,
        sector=sector,
        industry=industry,
        revenue_mix=shaped["revenue_mix"],
        cost_mix=shaped["cost_mix"],
        input_commodities=shaped["input_commodities"],
        output_markets=shaped["output_markets"],
        geographies=shaped["geographies"],
        fx_exposure=shaped["fx_exposure"],
        customer_concentration=shaped["customer_concentration"],
        supplier_dependencies=shaped["supplier_dependencies"],
        regulatory_exposure=shaped["regulatory_exposure"],
        substitutes=shaped["substitutes"],
        complements=shaped["complements"],
        peers=shaped["peers"],
        rate_sensitivity=shaped["rate_sensitivity"],
        commodity_beta=shaped["commodity_beta"],
        export_share=shaped["export_share"],
        import_share=shaped["import_share"],
        axis_keys=shaped["axis_keys"],
        evidence_refs=shaped["evidence_refs"],
        confidence=shaped["confidence"],
        profile_version=WORKFLOW_VERSION,
        # Both stages run on the same ZLM cheap tier — see agents/
        # company_profiler/agents.py.
        model_version=settings.ZLM_MODEL_CHEAP,
    )
    # updated_at is maintained by the trg_exposure_updated_at DB trigger
    # (migrations/001_news_and_butterfly_effect.sql) — never set it here.
    async with async_session_maker() as session:
        stmt = pg_insert(CompanyExposureProfile).values(**values)
        update_cols = {k: stmt.excluded[k] for k in values if k != "symbol"}
        stmt = stmt.on_conflict_do_update(index_elements=["symbol"], set_=update_cols)
        await session.execute(stmt)
        await session.commit()
