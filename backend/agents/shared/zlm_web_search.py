"""
agents/shared/zlm_web_search.py
Direct REST call to Z.ai's web_search endpoint — the ZLM replacement for
ADK's Gemini-only google_search tool (see core/config.py's provider-split
comment: that tool raises ValueError for any non-Gemini model, and Gemini's
own search grounding requires billing for real use anyway).

Z.ai's web_search is a standalone REST endpoint, NOT a model-invoked
function-calling tool (verified against Z.ai's own API reference, Aug 2026:
POST https://api.z.ai/api/paas/v4/web_search, plain request/response JSON,
no tool-calling loop involved). So the pattern here is "retrieve first, then
hand the model plain text" — the same shape services/rag/ already uses for
Research Chat — not an agentic tool loop. Deliberately NOT routed through
agents/shared/adk_runner.py for the same reason services/rag/embeddings.py
isn't: this is a plain stateless HTTP call, no agent/session/tool loop
involved.

Used by agents/butterfly/pipeline.py (before researcher_agent) and
agents/company_profiler/pipeline.py (before profiler_agent) — both fetch
real results here, then format them straight into that agent's prompt.
"""
import logging
from dataclasses import dataclass

import httpx

from core.config import settings

logger = logging.getLogger("agents.shared.zlm_web_search")

_ENDPOINT = "https://api.z.ai/api/paas/v4/web_search"


class WebSearchError(RuntimeError):
    """The web_search call failed outright (network, auth, malformed response).

    Callers (agents/butterfly/pipeline.py, agents/company_profiler/
    pipeline.py) treat this the same way they already treat a skipped
    grounded-research step: log a warning and skip that step for this cycle
    rather than failing the whole news item / company profile over one
    search call. A search hiccup is not a reason to burn one of a news
    item's limited analysis_attempts."""


@dataclass(slots=True)
class WebSearchResult:
    title: str
    content: str
    link: str
    source: str
    publish_date: str | None


async def web_search(query: str, count: int | None = None) -> list[WebSearchResult]:
    """One search query, `count` results (default core/config.py:
    ZLM_WEB_SEARCH_RESULT_COUNT). Raises WebSearchError on any failure —
    never returns a partial/guessed result silently."""
    if not settings.ZLM_API_KEY:
        raise WebSearchError("ZLM_API_KEY is not set — cannot search.")

    payload = {
        "search_engine": settings.ZLM_WEB_SEARCH_ENGINE,
        "search_query": query,
        "count": count or settings.ZLM_WEB_SEARCH_RESULT_COUNT,
    }
    headers = {"Authorization": f"Bearer {settings.ZLM_API_KEY}", "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(_ENDPOINT, json=payload, headers=headers)
    except httpx.HTTPError as exc:
        raise WebSearchError(f"web_search request failed for query {query!r}: {exc}") from exc

    if response.status_code != 200:
        raise WebSearchError(
            f"web_search returned HTTP {response.status_code} for query {query!r}: "
            f"{response.text[:500]}"
        )

    try:
        data = response.json()
    except ValueError as exc:
        raise WebSearchError(f"web_search returned non-JSON response for query {query!r}") from exc

    return [
        WebSearchResult(
            title=item.get("title") or "",
            content=item.get("content") or "",
            link=item.get("link") or "",
            source=item.get("media") or "",
            publish_date=item.get("publish_date"),
        )
        for item in (data.get("search_result") or [])
    ]


async def web_search_many(queries: list[str], count_per_query: int | None = None) -> list[WebSearchResult]:
    """Runs several queries and merges results, deduped by link (the same
    company/source often surfaces under more than one query). Queries run
    sequentially, not concurrently — this is offline batch work (butterfly/
    company_profiler), never a request a user is waiting on, so there's no
    latency pressure to parallelise, and sequential keeps this from bursting
    Z.ai's rate limit with N simultaneous requests.

    A single query's failure is logged and skipped rather than aborting the
    rest — one bad query (or a transient blip) shouldn't cost the results
    every other query already found."""
    merged: dict[str, WebSearchResult] = {}
    for query in queries:
        try:
            results = await web_search(query, count=count_per_query)
        except WebSearchError as exc:
            logger.warning("[zlm_web_search] query failed, skipping it: %s", exc)
            continue
        for result in results:
            key = result.link or f"{result.title}|{result.source}"
            merged.setdefault(key, result)
    return list(merged.values())


def format_results(results: list[WebSearchResult]) -> str:
    """Plain-text block, numbered so a prompt can ask the model to cite `[n]`."""
    if not results:
        return "(no search results found)"
    blocks = []
    for index, result in enumerate(results, start=1):
        date = f" ({result.publish_date})" if result.publish_date else ""
        blocks.append(
            f"[{index}] {result.title}{date} — {result.source}\n{result.link}\n{result.content[:1200]}"
        )
    return "\n\n".join(blocks)
