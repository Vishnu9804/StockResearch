"""services/rag/index_worker.py
Keeps the Research Chat corpus current.

Two entry points, same building blocks:

  run_index_cycle()          one full pass over every corpus. Called by the
                             loop below and by POST /api/chat/index/run.
  ensure_company_indexed()   index ONE company right now, because a user just
                             asked about it and nothing is indexed for it.

The second one is the answer to a scaling problem the pre-existing workflows
have: agents/company_profiler/worker.py profiles only symbols users HOLD,
because profiling all 6700 with a multi-agent workflow would be ruinous. But a
chat user will ask about companies nobody holds. Rather than pre-index
everything, the corpus grows to fit what is actually asked: the first question
about a company pays a few seconds to index its fundamentals and recent
transcripts, and every question after that is instant. Cost then scales with
genuine interest instead of with the size of the listed universe.

Single-owner rule, same as every other worker here (see
core/config.py:ENABLE_BACKGROUND_SYNC): run the loop inline in single-process
dev, or as the dedicated `python rag_index_worker.py` process in production —
never both.
"""
import asyncio
import logging
import random

from sqlalchemy import select

from core.config import settings
from core.database import async_session_maker
from models.models import PortfolioHolding, RagDocument, WatchlistItem
from services.rag import embeddings
from services.rag.indexer import IndexResult, delete_documents, index_documents
from services.rag.schemas import SourceType
from services.rag.sources import company_source, news_source, platform_source, transcript_source

logger = logging.getLogger("services.rag.index_worker")


async def _scope_symbols() -> list[str]:
    """Symbols worth keeping indexed unprompted: anything a user holds or
    watches. Everything else arrives via ensure_company_indexed()."""
    async with async_session_maker() as session:
        held = set((await session.execute(select(PortfolioHolding.symbol).distinct())).scalars().all())
        watched = set((await session.execute(select(WatchlistItem.symbol).distinct())).scalars().all())
    return sorted({symbol.upper() for symbol in (held | watched) if symbol})


async def _indexed_symbols(source_type: str) -> set[str]:
    async with async_session_maker() as session:
        rows = (
            await session.execute(
                select(RagDocument.symbol).where(
                    RagDocument.source_type == source_type,
                    RagDocument.symbol.is_not(None),
                )
            )
        ).scalars().all()
    return {symbol.upper() for symbol in rows if symbol}


async def run_index_cycle(include_news: bool = True, chunk_budget: int | None = None) -> dict:
    """One full pass. Returns a per-corpus breakdown of what changed.

    Corpus order is deliberate, and it is the mechanism by which
    RAG_MAX_CHUNKS_PER_CYCLE degrades gracefully. Help topics come first
    because they are tiny and make the chat immediately useful; company data
    next because it is small and high-value; transcripts and news last because
    they are the two corpora big enough to exhaust the budget. When the budget
    does run out, what gets deferred is the corpus that suffers least from
    arriving a cycle later — never the one the chat is useless without.
    """
    if not settings.GEMINI_API_KEY:
        logger.warning("[rag.index_worker] GEMINI_API_KEY is not set — nothing can be embedded")
        return {"skipped": "GEMINI_API_KEY is not set"}

    budget = settings.RAG_MAX_CHUNKS_PER_CYCLE if chunk_budget is None else chunk_budget
    report: dict = {}
    total = IndexResult()

    async def _step(source_type: str, documents: list) -> None:
        """Index one corpus against the shared budget, unless a previous step
        already hit the real quota wall (in which case every later call would
        just be another 429)."""
        nonlocal budget
        if total.quota_exhausted:
            report[source_type] = {"skipped": "embedding quota exhausted earlier in this cycle"}
            return
        result = await index_documents(documents, chunk_budget=budget)
        budget -= result.chunks_written
        report[source_type] = result.as_dict()
        total.merge(result)

    # ── Platform help ────────────────────────────────────────────────────────
    await _step(SourceType.PLATFORM_HELP, platform_source.build_help_documents())

    symbols = await _scope_symbols()
    logger.info("[rag.index_worker] scope: %d held/watched symbol(s)", len(symbols))

    # ── Company exposure profiles ────────────────────────────────────────────
    # No symbol filter: this table only ever contains companies that were
    # explicitly profiled, so every row in it is worth having.
    if not total.quota_exhausted:
        await _step(SourceType.COMPANY_PROFILE, await company_source.build_profile_documents())

    # ── Company fundamentals ─────────────────────────────────────────────────
    # Held/watched symbols PLUS anything already indexed by an on-demand pass,
    # so a company someone asked about last week keeps getting refreshed
    # instead of going stale the moment they stop asking.
    if not total.quota_exhausted:
        fundamentals_scope = sorted(set(symbols) | await _indexed_symbols(SourceType.COMPANY_FUNDAMENTALS))
        await _step(
            SourceType.COMPANY_FUNDAMENTALS,
            await company_source.build_fundamentals_documents(fundamentals_scope),
        )

    # ── Transcripts ──────────────────────────────────────────────────────────
    # Skipped entirely when the budget is already spent: fetching them means
    # downloading and parsing multi-megabyte PDFs, which is expensive work to
    # do only to defer every one of them.
    if not total.quota_exhausted and budget > 0:
        transcript_scope = sorted(set(symbols) | await _indexed_symbols(SourceType.TRANSCRIPT))
        await _step(
            SourceType.TRANSCRIPT,
            await transcript_source.build_transcript_documents(transcript_scope),
        )
    elif not total.quota_exhausted:
        report[SourceType.TRANSCRIPT] = {"skipped": "chunk budget for this cycle already spent"}

    # ── News ─────────────────────────────────────────────────────────────────
    if include_news and not total.quota_exhausted and budget > 0:
        await _step(SourceType.NEWS, await news_source.build_news_documents())

        # Drop chunks whose article has aged out of news_items — without this
        # the chat would cite stories that no longer exist.
        stale = await news_source.stale_news_source_keys()
        if stale:
            removed = await delete_documents(SourceType.NEWS, stale)
            report[SourceType.NEWS]["removed"] = removed
            logger.info("[rag.index_worker] pruned %d news document(s) past retention", removed)
    elif include_news and not total.quota_exhausted:
        report[SourceType.NEWS] = {"skipped": "chunk budget for this cycle already spent"}

    total_dict = total.as_dict()
    # The signal a caller needs to decide whether to run another cycle. True
    # means "there is more work waiting", which is a normal, expected state on
    # a first run — not an error.
    total_dict["moreWorkPending"] = bool(total.deferred) or any(
        isinstance(entry, dict) and "skipped" in entry for entry in report.values()
    )
    total_dict["chunkBudgetRemaining"] = max(0, budget)
    report["total"] = total_dict
    report["embeddingRequestsThisProcess"] = embeddings.get_request_count()
    return report


# Symbols whose transcripts are being fetched in the background right now.
# Without this, five quick questions about the same unindexed company would
# start five identical PDF downloads. In-process only, which is correct: the
# work is idempotent, so the worst a second process can do is duplicate it
# once, and the content-hash check makes even that write nothing.
_transcripts_in_flight: set[str] = set()


async def _index_transcripts_in_background(symbol: str) -> None:
    try:
        documents = await transcript_source.build_transcript_documents(
            [symbol], per_symbol=settings.RAG_ON_DEMAND_TRANSCRIPTS
        )
        result = await index_documents(documents)
        logger.info(
            "[rag.index_worker] background transcript index for %s — indexed=%d chunks=%d",
            symbol, result.indexed, result.chunks_written,
        )
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("[rag.index_worker] background transcript index failed for %s", symbol)
    finally:
        _transcripts_in_flight.discard(symbol)


async def ensure_company_indexed(symbol: str) -> dict:
    """Make a company answerable, right now, without making the user wait for
    the slow half.

    Split deliberately down the middle:

      SYNCHRONOUS   fundamentals + exposure profile. Both come straight from
                    tables this app already keeps, render to a single chunk
                    each, and index in about a second. The question that
                    triggered this gets to use them.

      BACKGROUND    transcripts. A single 40-page concall is ~70 chunks, and
                    at the free tier's texts-per-minute ceiling that is most
                    of a minute of pacing on top of downloading and parsing
                    multi-megabyte PDFs. Holding a user's first question for
                    that would be a bad trade — so it is started and left to
                    run, and the SECOND question about that company (or any
                    later one) has them.

    The alternative, waiting for everything, was tried first and is why the
    split exists: it turns a 3-second answer into a 90-second one to improve
    an answer the user has not asked for yet.
    """
    symbol = symbol.upper()
    outcome: dict = {"symbol": symbol}

    try:
        fundamentals = await asyncio.wait_for(
            company_source.build_fundamentals_documents([symbol]),
            timeout=settings.RAG_ON_DEMAND_TIMEOUT_SECONDS,
        )
        profiles = await company_source.build_profile_documents([symbol])
        result = await index_documents(fundamentals + profiles)
        outcome["company"] = result.as_dict()
        if result.quota_exhausted:
            return outcome
    except asyncio.TimeoutError:
        logger.warning("[rag.index_worker] on-demand company index for %s timed out", symbol)
        outcome["timedOut"] = True
        return outcome
    except Exception:
        logger.exception("[rag.index_worker] on-demand company index failed for %s", symbol)
        outcome["failed"] = True
        return outcome

    if settings.RAG_ON_DEMAND_TRANSCRIPTS > 0 and symbol not in _transcripts_in_flight:
        _transcripts_in_flight.add(symbol)
        asyncio.create_task(_index_transcripts_in_background(symbol))
        outcome["transcripts"] = "started in background"
    else:
        outcome["transcripts"] = "already in progress"

    return outcome


async def run_rag_index_worker() -> None:
    if not settings.GEMINI_API_KEY:
        logger.warning(
            "[rag.index_worker] GEMINI_API_KEY is not set — idling without indexing "
            "anything until a key is configured in .env"
        )
    else:
        # Staggered past the butterfly and company-profiler workers for the
        # same reason they are staggered from each other (see
        # COMPANY_PROFILER_STARTUP_STAGGER_SECONDS): several workers firing
        # their first Gemini call within the same second at boot can trip a
        # per-minute limit before any of them has done real work. Embeddings
        # draw on a different quota than generation, but the startup burst is
        # the same shape, and being last costs nothing.
        logger.info(
            "[rag.index_worker] starting — waiting %ds so the first cycle doesn't "
            "collide with the other workers' startup",
            settings.RAG_INDEX_STARTUP_STAGGER_SECONDS,
        )
        await asyncio.sleep(settings.RAG_INDEX_STARTUP_STAGGER_SECONDS)

    while True:
        if not settings.GEMINI_API_KEY:
            await asyncio.sleep(settings.RAG_INDEX_INTERVAL_SECONDS)
            continue

        try:
            report = await run_index_cycle()
        except Exception:
            logger.exception("[rag.index_worker] index cycle failed")
            await asyncio.sleep(settings.RAG_INDEX_INTERVAL_SECONDS)
            continue

        total = report.get("total", {})
        if total.get("quotaExhausted"):
            # Randomised, same reasoning as agents/company_profiler/worker.py:
            # so two workers that collide on a shared limit once don't then
            # retry in lockstep forever.
            cooldown = settings.GEMINI_QUOTA_COOLDOWN_SECONDS + random.uniform(0, 15)
            logger.warning("[rag.index_worker] embedding quota exhausted — cooling down %.0fs", cooldown)
            await asyncio.sleep(cooldown)
        elif total.get("moreWorkPending"):
            # The cycle stopped on its own chunk budget, not on a limit, and
            # there is a known backlog. Waiting the full idle interval would
            # stretch a first-run backfill over hours for no reason — but going
            # straight round again would ignore the per-minute pacing the last
            # cycle just spent, so take a short breath instead.
            logger.info("[rag.index_worker] backlog remaining — next cycle in 60s")
            await asyncio.sleep(60)
        else:
            await asyncio.sleep(settings.RAG_INDEX_INTERVAL_SECONDS)
