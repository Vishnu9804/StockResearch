"""
services/ai_summary/pipeline.py
Builds or refreshes ONE company's company_ai_summaries row for its current
quarter. This is the only place in the codebase that turns raw filing PDFs
into the "AI Summary" tab's content — both the on-demand cold-start path
(routers/finedge.py::get_ai_summary) and the background batch sweep
(sync_ai_summaries_batch, below) call this exact function, so the two paths
can never disagree about what a summary should contain.

Deliberately NO embeddings, NO vector search, NO chunking. The input for any
one company/quarter is a handful of filings (a few announcements, one
concall transcript, one presentation) — small enough to hand straight to a
model with a 200K-token context window. Retrieval only earns its cost when
you need to find a needle in a much bigger haystack (that's what
services/rag/ already does, for a different feature — Research Chat's
open-ended Q&A over years of history). Summarising a known, small, already-
identified set of documents is a different problem and doesn't need it.

Two LLM stages per company (see agents.py/schemas.py for why):
  1. One cheap-tier, purely-extractive call PER document.
  2. One smart-tier synthesis call over all of stage 1's output.

COST CONTROL AT UNIVERSE SCALE (the ~6700-symbol production case, not just
the 10-company pilot): before doing ANY of the above, this function computes
a cheap identity hash of "which documents make up this quarter's set" and
compares it to the existing row's source_content_hash. Unchanged → returns
the cached row immediately, no LLM calls at all. A quarter's filings don't
change once filed, so after the first successful run for a company, this
function is a free no-op until that company's NEXT quarter's documents show
up — which is also what makes the background sweep in sync_ai_summaries_batch
safe to run continuously over the whole universe without spending anything
on companies nothing has changed for.
"""
import hashlib
import logging
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from agents.shared.adk_runner import run_agent_text
from agents.shared.json_utils import parse_structured
from core.config import settings
from core.database import async_session_maker
from models.models import CompanyAiSummary, CompanyDocument, CompanyMetric
from services.ai_summary import agents as ai_summary_agents
from services.ai_summary import prompts
from services.ai_summary.quarter import quarter_parts, select_current_quarter_documents, select_within_budget
from services.ai_summary.schemas import DocumentFacts, QuarterSummaryResult
from services.ai_summary.text_extraction import extract_pdf_text

logger = logging.getLogger("services.ai_summary.pipeline")

_RELEVANT_CATEGORIES = ("announcement", "concall", "presentation")

_INSUFFICIENT_DATA_MESSAGE = (
    "This quarter's announcement, concall and presentation filings for {symbol} could not be "
    "read in enough detail to generate a summary yet — the documents may be scanned images "
    "without readable text. Please check the original documents above."
)
_NO_DOCUMENTS_MESSAGE = (
    "No announcement, concall or presentation filings have been found yet for {symbol} this "
    "quarter. Check back after the company's next results are filed."
)


def _doc_dict(doc: CompanyDocument, **extra) -> dict:
    return {
        "id": str(doc.id),
        "category": doc.category,
        "title": doc.title,
        "filed_date": doc.filed_date.isoformat() if doc.filed_date else None,
        "pdf_url": doc.pdf_url,
        **extra,
    }


def _content_hash(quarter_label: str, doc_ids: list) -> str:
    raw = quarter_label + "|" + ",".join(sorted(str(i) for i in doc_ids))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def _load_current_quarter_docs(db: AsyncSession, symbol: str) -> tuple[str, list[CompanyDocument]]:
    rows = (
        await db.execute(
            select(CompanyDocument).where(
                CompanyDocument.symbol == symbol,
                CompanyDocument.category.in_(_RELEVANT_CATEGORIES),
            )
        )
    ).scalars().all()
    label, current = select_current_quarter_documents(list(rows))
    # Bounds LLM calls per company at universe scale WITHOUT risking the
    # quarter's actual results content — see select_within_budget's
    # docstring for why a flat "newest N" cap is unsafe here.
    return label, select_within_budget(current, settings.AI_SUMMARY_MAX_DOCS_PER_QUARTER)


async def _extract_and_summarise_documents(
    docs: list[CompanyDocument],
) -> tuple[dict[str, list[dict]], list[dict], list[dict]]:
    """Returns (facts_by_category, documents_covered, documents_skipped)."""
    facts_by_category: dict[str, list[dict]] = {c: [] for c in _RELEVANT_CATEGORIES}
    covered: list[dict] = []
    skipped: list[dict] = []

    async with httpx.AsyncClient(follow_redirects=True, timeout=httpx.Timeout(60.0)) as client:
        for doc in docs:
            extracted = await extract_pdf_text(client, doc.pdf_url)
            if extracted is None:
                skipped.append(_doc_dict(doc, reason="unreadable_or_scanned"))
                continue
            text, _page_count = extracted
            covered.append(_doc_dict(doc))

            try:
                raw = await run_agent_text(
                    ai_summary_agents.fact_extractor_agent(),
                    prompts.format_fact_extraction_input(
                        doc.category, doc.title,
                        doc.filed_date.isoformat() if doc.filed_date else None,
                        text,
                    ),
                )
                facts = parse_structured(raw, DocumentFacts)
            except Exception:
                logger.exception(
                    "[ai_summary.pipeline] fact extraction failed for doc_id=%s (%s) — treating as no material info",
                    doc.id, doc.pdf_url,
                )
                continue

            if facts.has_material_info and facts.key_points:
                facts_by_category[doc.category].append({
                    "title": doc.title,
                    "filed_date": doc.filed_date.isoformat() if doc.filed_date else None,
                    "key_points": facts.key_points,
                })

    return facts_by_category, covered, skipped


async def _touch_synced_at(symbol: str) -> None:
    """Stamps company_metrics.ai_summary_synced_at WITHOUT touching the
    summary row itself — used on the cache-hit path (unchanged content_hash)
    so a symbol whose quarter hasn't changed still rotates to the back of
    sync_ai_summaries_batch's "oldest first" queue. Without this, an
    unchanged symbol's timestamp would freeze at whenever it was first
    generated and it would win every single subsequent sweep forever,
    starving every other symbol in the universe of a turn."""
    async with async_session_maker() as session:
        await session.execute(
            CompanyMetric.__table__.update()
            .where(CompanyMetric.symbol == symbol)
            .values(ai_summary_synced_at=datetime.now(timezone.utc))
        )
        await session.commit()


async def _write_row(symbol: str, values: dict) -> None:
    async with async_session_maker() as session:
        stmt = pg_insert(CompanyAiSummary).values(symbol=symbol, **values)
        update_cols = {k: stmt.excluded[k] for k in values}
        stmt = stmt.on_conflict_do_update(index_elements=["symbol"], set_=update_cols)
        await session.execute(stmt)
        await session.execute(
            CompanyMetric.__table__.update()
            .where(CompanyMetric.symbol == symbol)
            .values(ai_summary_synced_at=datetime.now(timezone.utc))
        )
        await session.commit()


async def generate_summary_for_symbol(symbol: str, *, force: bool = False) -> CompanyAiSummary | None:
    """Builds/refreshes company_ai_summaries for ONE symbol. Returns the
    resulting row, or None if the symbol isn't in company_metrics at all.

    Safe to call repeatedly/concurrently for the same symbol at low volume —
    the content-hash short-circuit makes a redundant call a single cheap
    SELECT, not a re-run of the LLM pipeline."""
    symbol = symbol.upper()

    async with async_session_maker() as db:
        company_name = await db.scalar(select(CompanyMetric.name).where(CompanyMetric.symbol == symbol))
        if company_name is None:
            logger.warning("[ai_summary.pipeline] symbol=%s not found in company_metrics — skipping", symbol)
            return None

        quarter_label, docs = await _load_current_quarter_docs(db, symbol)
        existing = (
            await db.execute(select(CompanyAiSummary).where(CompanyAiSummary.symbol == symbol))
        ).scalar_one_or_none()

    doc_hash = _content_hash(quarter_label, [d.id for d in docs])
    if not force and existing is not None and existing.source_content_hash == doc_hash:
        await _touch_synced_at(symbol)
        return existing

    if not docs:
        fiscal_year, quarter_number = quarter_parts(datetime.now(timezone.utc).date())
        values = dict(
            fiscal_year=fiscal_year, quarter_number=quarter_number, quarter_label=quarter_label,
            overview=_NO_DOCUMENTS_MESSAGE.format(symbol=symbol),
            announcements_summary=None, concall_summary=None, presentation_summary=None,
            key_highlights=[], documents_covered=[], documents_skipped=[],
            source_content_hash=doc_hash, status="no_documents", error_message=None,
            model_used=None, generated_at=datetime.now(timezone.utc),
        )
        await _write_row(symbol, values)
        logger.info("[ai_summary.pipeline] symbol=%s — no current-quarter documents", symbol)
        return await _reload(symbol)

    fiscal_year, quarter_number = quarter_parts(docs[0].filed_date)

    try:
        facts_by_category, covered, skipped = await _extract_and_summarise_documents(docs)
    except Exception as exc:
        logger.exception("[ai_summary.pipeline] symbol=%s extraction stage failed", symbol)
        values = dict(
            fiscal_year=fiscal_year, quarter_number=quarter_number, quarter_label=quarter_label,
            overview=existing.overview if existing else _INSUFFICIENT_DATA_MESSAGE.format(symbol=symbol),
            announcements_summary=existing.announcements_summary if existing else None,
            concall_summary=existing.concall_summary if existing else None,
            presentation_summary=existing.presentation_summary if existing else None,
            key_highlights=existing.key_highlights if existing else [],
            documents_covered=existing.documents_covered if existing else [],
            documents_skipped=existing.documents_skipped if existing else [],
            source_content_hash=existing.source_content_hash if existing else doc_hash,
            status="failed", error_message=str(exc)[:500],
            model_used=None, generated_at=datetime.now(timezone.utc),
        )
        await _write_row(symbol, values)
        return await _reload(symbol)

    has_any_facts = any(facts_by_category[c] for c in _RELEVANT_CATEGORIES)
    if not has_any_facts:
        values = dict(
            fiscal_year=fiscal_year, quarter_number=quarter_number, quarter_label=quarter_label,
            overview=_INSUFFICIENT_DATA_MESSAGE.format(symbol=symbol),
            announcements_summary=None, concall_summary=None, presentation_summary=None,
            key_highlights=[], documents_covered=covered, documents_skipped=skipped,
            source_content_hash=doc_hash, status="insufficient_data", error_message=None,
            model_used=None, generated_at=datetime.now(timezone.utc),
        )
        await _write_row(symbol, values)
        logger.info("[ai_summary.pipeline] symbol=%s — no readable material content this quarter", symbol)
        return await _reload(symbol)

    try:
        raw = await run_agent_text(
            ai_summary_agents.summarizer_agent(),
            prompts.format_synthesis_input(company_name, symbol, quarter_label, facts_by_category),
        )
        result = parse_structured(raw, QuarterSummaryResult)
    except Exception as exc:
        logger.exception("[ai_summary.pipeline] symbol=%s synthesis stage failed", symbol)
        values = dict(
            fiscal_year=fiscal_year, quarter_number=quarter_number, quarter_label=quarter_label,
            overview=existing.overview if existing else _INSUFFICIENT_DATA_MESSAGE.format(symbol=symbol),
            announcements_summary=existing.announcements_summary if existing else None,
            concall_summary=existing.concall_summary if existing else None,
            presentation_summary=existing.presentation_summary if existing else None,
            key_highlights=existing.key_highlights if existing else [],
            documents_covered=covered, documents_skipped=skipped,
            source_content_hash=existing.source_content_hash if existing else doc_hash,
            status="failed", error_message=str(exc)[:500],
            model_used=None, generated_at=datetime.now(timezone.utc),
        )
        await _write_row(symbol, values)
        return await _reload(symbol)

    values = dict(
        fiscal_year=fiscal_year, quarter_number=quarter_number, quarter_label=quarter_label,
        overview=result.overview,
        announcements_summary=result.announcements_summary,
        concall_summary=result.concall_summary,
        presentation_summary=result.presentation_summary,
        key_highlights=[h.model_dump() for h in result.key_highlights],
        documents_covered=covered, documents_skipped=skipped,
        source_content_hash=doc_hash, status="ready", error_message=None,
        model_used=settings.ZLM_MODEL_SMART, generated_at=datetime.now(timezone.utc),
    )
    await _write_row(symbol, values)
    logger.info(
        "[ai_summary.pipeline] symbol=%s quarter=%s — summary ready (%d docs covered, %d skipped)",
        symbol, quarter_label, len(covered), len(skipped),
    )
    return await _reload(symbol)


async def _reload(symbol: str) -> CompanyAiSummary:
    async with async_session_maker() as db:
        return (
            await db.execute(select(CompanyAiSummary).where(CompanyAiSummary.symbol == symbol))
        ).scalar_one()


def _sync_scope_symbols() -> list[str]:
    return [s.strip().upper() for s in settings.AI_SUMMARY_SYNC_SYMBOLS.split(",") if s.strip()]


async def sync_ai_summaries_batch(db: AsyncSession, batch_size: int | None = None) -> int:
    """Rolling background sweep — same oldest-synced-first, largest-market-
    cap-first selection rule as services/document_sync.py::sync_documents_batch
    — so this feature stays current on its own, unattended, without waiting
    for a user's visit to notice a company's documents moved to a new
    quarter. Only considers symbols document_sync has already reached
    (documents_synced_at not null) — there's nothing to summarise before
    that.

    Cheap even at full universe scale: generate_summary_for_symbol's
    content-hash short-circuit means a symbol whose current-quarter document
    set hasn't changed since last sweep costs one SELECT here, not an LLM
    call — so this can run continuously without runaway spend once it's
    swept the whole universe once.

    TEST-MODE SCOPING — see core/config.py:AI_SUMMARY_SYNC_SYMBOLS. When
    set, restricts the candidate pool to exactly those symbols (still
    respecting the same ordering/rotation above) so this sweep can't start
    silently spending ZLM calls on the wider universe before that's actually
    wanted. Empty is real production behaviour: the whole universe.
    """
    batch_size = batch_size or settings.AI_SUMMARY_SYNC_BATCH_SIZE
    scope_symbols = _sync_scope_symbols()

    query = (
        select(CompanyMetric.symbol)
        .where(CompanyMetric.documents_synced_at.isnot(None))
        .order_by(
            CompanyMetric.ai_summary_synced_at.asc().nulls_first(),
            CompanyMetric.market_cap.desc().nulls_last(),
        )
        .limit(batch_size)
    )
    if scope_symbols:
        query = query.where(CompanyMetric.symbol.in_(scope_symbols))

    targets = (await db.execute(query)).scalars().all()

    if not targets:
        return 0

    synced = 0
    for symbol in targets:
        try:
            await generate_summary_for_symbol(symbol)
            synced += 1
        except Exception:
            logger.exception(
                "[ai_summary.pipeline] symbol=%s batch generation failed — leaving "
                "ai_summary_synced_at unset so the next cycle retries it", symbol,
            )

    logger.info("[ai_summary.pipeline] batch synced %d/%d symbol(s)", synced, len(targets))
    return synced
