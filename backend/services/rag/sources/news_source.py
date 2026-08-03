"""services/rag/sources/news_source.py
News articles, plus the Butterfly Effect workflow's analysis of them.

Yes, news belongs in the index. The alternative — answering news questions by
querying news_items with SQL LIKE at chat time — only finds an article when the
user happens to use the publisher's own words. "How did the rate decision hit
banks?" has to match a headline that says "RBI holds repo rate", and keyword
matching simply cannot bridge that. Embedding is what makes the two the same
question.

The article and its analysis are ONE document, not two. news_impact_analyses
is meaningless without the story it analyses ("second-order effect: input costs
rise over two quarters" — of what?), and splitting them would let retrieval
return the analysis alone. Merging also means the expensive workflow output
gets surfaced by the chat for free, which is the whole reason it was computed.

Scope is bounded by AGE (RAG_NEWS_MAX_AGE_DAYS), matching the retention window
that news_items itself is pruned to — indexing past it would leave the corpus
holding chunks whose source row has already been deleted.
"""
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from core.config import settings
from core.database import async_session_maker
from models.models import NewsImpactAnalysis, NewsItem, NewsThematicResearch, RagDocument
from services.rag.schemas import RagSourceDocument, SourceType

logger = logging.getLogger("services.rag.sources.news")

# Hard ceiling on how much of one article's body is indexed. Most feeds give a
# summary plus a few paragraphs; a handful give the whole page including
# navigation furniture. Cutting here keeps a single verbose source from
# consuming a disproportionate share of an index cycle's embedding budget.
_MAX_BODY_CHARS = 6000


def _render_causal_chains(chains: list) -> list[str]:
    lines: list[str] = []
    for chain in chains or []:
        if not isinstance(chain, dict):
            continue
        steps = chain.get("steps") or chain.get("chain") or []
        rendered = []
        for step in steps:
            if isinstance(step, dict):
                rendered.append(step.get("effect") or step.get("description") or str(step))
            elif isinstance(step, str):
                rendered.append(step)
        if rendered:
            lines.append("- " + " -> ".join(rendered))
        elif chain.get("summary"):
            lines.append(f"- {chain['summary']}")
    return lines


def _render_analysis(analysis: NewsImpactAnalysis) -> list[str]:
    parts = ["", "Impact analysis of this news (produced by FinScreen's causal-analysis workflow):"]

    event = analysis.event if isinstance(analysis.event, dict) else {}
    if event.get("summary"):
        parts.append(f"- What happened: {event['summary']}")
    if event.get("event_type"):
        parts.append(f"- Event type: {event['event_type']}")

    chains = _render_causal_chains(analysis.causal_chains)
    if chains:
        parts.append("- Knock-on effects traced from this event:")
        parts.extend(f"  {line}" for line in chains)

    axes = []
    for axis in analysis.exposure_axes or []:
        if isinstance(axis, dict):
            key = axis.get("key") or axis.get("axis")
            direction = axis.get("direction")
            if key:
                axes.append(f"{key}{f' (direction {direction})' if direction is not None else ''}")
    if axes:
        parts.append(f"- Parts of the economy this touches: {', '.join(axes)}.")

    if analysis.market_significance is not None:
        parts.append(f"- How market-moving this looks: {float(analysis.market_significance):.2f} on a 0-1 scale.")
    if analysis.confidence is not None:
        parts.append(f"- Confidence in this analysis: {float(analysis.confidence):.2f} on a 0-1 scale.")
    if analysis.horizon:
        parts.append(f"- Time horizon over which it plays out: {analysis.horizon}.")

    verdict = analysis.skeptic_verdict if isinstance(analysis.skeptic_verdict, dict) else {}
    if verdict.get("critique"):
        # The adversarial step's objections are indexed alongside the claim on
        # purpose: a research assistant that can only recite the bull case is
        # not doing research. This is where "what could be wrong with this
        # reading" comes from in an answer.
        parts.append(f"- Counter-argument considered: {verdict['critique']}")

    return parts if len(parts) > 2 else []


def _render_thematic(research: NewsThematicResearch) -> list[str]:
    parts = ["", "Derived theme — new demand or dependency this event creates:"]
    need = research.derived_need if isinstance(research.derived_need, dict) else {}
    if need.get("description"):
        parts.append(f"- {need['description']}")
    if research.thesis:
        parts.append(f"- Reasoning: {research.thesis}")
    companies = [
        f"{c.get('symbol')} ({c.get('company_name')})"
        for c in (research.candidate_companies or [])
        if isinstance(c, dict) and c.get("symbol")
    ]
    if companies:
        parts.append(f"- Verified listed companies sitting on that dependency: {', '.join(companies)}.")
    return parts if len(parts) > 2 else []


def _render_news(
    item: NewsItem,
    analysis: NewsImpactAnalysis | None,
    thematic: NewsThematicResearch | None,
) -> str:
    published = item.published_at.strftime("%d %b %Y")
    parts = [
        f"News article: {item.title}",
        f"Published {published} by {item.source_name}. Category: {item.category or 'general market'}.",
    ]
    if item.mentioned_symbols:
        parts.append(f"Companies named in the article: {', '.join(item.mentioned_symbols)}.")
    if item.regions:
        parts.append(f"Regions: {', '.join(item.regions)}.")
    if item.summary:
        parts.append("")
        parts.append(item.summary)
    if item.body:
        body = item.body.strip()
        parts.append("")
        parts.append(body[:_MAX_BODY_CHARS])

    if analysis is not None:
        parts.extend(_render_analysis(analysis))
    if thematic is not None:
        parts.extend(_render_thematic(thematic))

    return "\n".join(parts)


async def build_news_documents(limit: int | None = None) -> list[RagSourceDocument]:
    """Recent, non-duplicate, English news that is not already indexed.

    Unlike the other sources this one pre-filters against rag_documents rather
    than handing everything to the indexer's hash check. The reason is scale:
    the other corpora are tens of rows, this one is thousands, and rendering
    every article's full text plus joined analysis just to hash it and discard
    it would dominate the cycle. A news article's text is also effectively
    immutable once ingested, so "already indexed" and "unchanged" are the same
    question here — which is exactly the condition under which skipping the
    hash check is safe.
    """
    limit = limit or settings.RAG_NEWS_BATCH_SIZE
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.RAG_NEWS_MAX_AGE_DAYS)

    async with async_session_maker() as session:
        already_indexed = set(
            (
                await session.execute(
                    select(RagDocument.source_key).where(RagDocument.source_type == SourceType.NEWS)
                )
            ).scalars().all()
        )

        rows = (
            await session.execute(
                select(NewsItem, NewsImpactAnalysis, NewsThematicResearch)
                .outerjoin(NewsImpactAnalysis, NewsImpactAnalysis.news_id == NewsItem.id)
                .outerjoin(NewsThematicResearch, NewsThematicResearch.news_id == NewsItem.id)
                .where(
                    NewsItem.duplicate_of_id.is_(None),
                    NewsItem.language == "en",
                    NewsItem.published_at >= cutoff,
                )
                # Newest first: if the batch cap bites, the corpus should be
                # missing the oldest stories in the window, not the freshest.
                .order_by(NewsItem.published_at.desc())
                # Over-fetch, because the already-indexed filter below runs in
                # Python — without the headroom a mostly-indexed table would
                # return a batch that is almost entirely skipped.
                .limit(limit * 4)
            )
        ).all()

    documents: list[RagSourceDocument] = []
    for item, analysis, thematic in rows:
        if str(item.id) in already_indexed:
            continue
        documents.append(
            RagSourceDocument(
                source_type=SourceType.NEWS,
                source_key=str(item.id),
                title=item.title,
                text=_render_news(item, analysis, thematic),
                # Deliberately null even when the article names companies: a
                # news chunk should be findable by anyone asking about the
                # topic, and a non-null symbol would let the retriever's
                # symbol filter hide it from every other question.
                symbol=None,
                url=item.url,
                doc_date=item.published_at,
                metadata={
                    "sourceName": item.source_name,
                    "category": item.category,
                    "symbols": list(item.mentioned_symbols or []),
                    "hasImpactAnalysis": analysis is not None,
                },
            )
        )
        if len(documents) >= limit:
            break

    logger.info("[rag.news] %d new article(s) to index", len(documents))
    return documents


async def stale_news_source_keys() -> list[str]:
    """Indexed news whose source row is gone or has aged out of the window.

    news_items is pruned on a time window (services/news_ingest.py), so without
    this the index would keep serving passages whose article no longer exists —
    a citation pointing at a deleted row.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.RAG_NEWS_MAX_AGE_DAYS)
    async with async_session_maker() as session:
        indexed = (
            await session.execute(
                select(RagDocument.source_key, RagDocument.doc_date).where(
                    RagDocument.source_type == SourceType.NEWS
                )
            )
        ).all()
        live_ids = set(
            str(news_id)
            for news_id in (
                await session.execute(select(NewsItem.id).where(NewsItem.published_at >= cutoff))
            ).scalars().all()
        )

    return [source_key for source_key, _ in indexed if source_key not in live_ids]
