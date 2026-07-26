"""
services/news_sources/gdelt_client.py
GDELT DOC 2.0 — global event coverage, free and keyless.

GDELT monitors world news in 100+ languages and exposes a query API with no key
and no registration. For this feature it does something the Indian publisher
feeds structurally cannot: it surfaces the FOREIGN event at the head of a causal
chain. An Indonesian export restriction, a Chilean mine strike, a Red Sea
re-routing or a US export-control rule will be covered heavily abroad and barely
at all in Indian markets sections — yet those are exactly the events that reach
an Indian portfolio two or three hops later.

Queries are deliberately themed around transmission mechanisms (supply, tariff,
export ban, strike, sanction) rather than around companies, because a query for
company names would only ever rediscover the direct hits we already have.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

import httpx

logger = logging.getLogger("news.gdelt")

_GDELT_DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc"
_TIMEOUT = 40.0

# GDELT ranks by volume; ask for a wide net and let triage do the filtering.
_MAX_RECORDS = 75

# GDELT enforces one request per 5 seconds per IP and answers violations with a
# 429 carrying a plaintext body. Verified against the live service: concurrent
# queries fail wholesale, and the penalty outlives the burst that caused it. So
# queries are serialised behind a process-wide lock with a conservative spacing,
# and a 429 is retried rather than dropped.
_MIN_REQUEST_INTERVAL = 6.0
_RETRY_BACKOFF = (8.0, 16.0)

_pace_lock = asyncio.Lock()
_last_request_at: float = 0.0

# The service is a browser-oriented public endpoint and rejects some default
# client UAs outright.
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
}

# Each entry is (label, query, regions). GDELT query syntax: bare terms are
# AND-ed, quoted phrases are exact, OR needs explicit parentheses.
GDELT_QUERIES: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    ("commodity_supply",
     '(nickel OR copper OR aluminium OR lithium OR cobalt) (export OR ban OR strike OR shortage OR quota)',
     ("GLOBAL",)),
    ("energy_supply",
     '(crude OR "natural gas" OR LNG OR OPEC) (supply OR output OR sanction OR pipeline OR quota)',
     ("GLOBAL",)),
    ("supply_chain",
     '("supply chain" OR shipping OR freight OR port) (disruption OR delay OR strike OR closure)',
     ("GLOBAL",)),
    ("trade_policy",
     '(tariff OR "export control" OR sanction OR "trade restriction") (China OR India OR "United States" OR EU)',
     ("GLOBAL",)),
    ("semiconductors",
     'semiconductor (shortage OR "export control" OR fab OR capacity)',
     ("GLOBAL",)),
    ("india_macro",
     'India (inflation OR "monetary policy" OR rupee OR GDP OR fiscal OR budget)',
     ("IN",)),
    ("agri_supply",
     '(wheat OR sugar OR "palm oil" OR rice OR fertiliser) (export OR ban OR harvest OR shortage)',
     ("GLOBAL",)),
)


def _parse_gdelt_datetime(value: str) -> datetime:
    """GDELT stamps articles as YYYYMMDDTHHMMSSZ."""
    try:
        return datetime.strptime(value, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return datetime.now(timezone.utc)


async def _paced_get(client: httpx.AsyncClient, params: dict[str, str]) -> httpx.Response:
    """Serialise every GDELT call and hold the minimum interval between them."""
    global _last_request_at

    async with _pace_lock:
        elapsed = asyncio.get_event_loop().time() - _last_request_at
        if elapsed < _MIN_REQUEST_INTERVAL:
            await asyncio.sleep(_MIN_REQUEST_INTERVAL - elapsed)
        try:
            return await client.get(
                _GDELT_DOC_URL, params=params, headers=_HEADERS, timeout=_TIMEOUT
            )
        finally:
            _last_request_at = asyncio.get_event_loop().time()


async def _fetch_one(
    client: httpx.AsyncClient,
    label: str,
    query: str,
    regions: tuple[str, ...],
    timespan: str,
) -> list[dict[str, Any]]:
    # GDELT indexes 100+ languages, so an unfiltered query returns Portuguese
    # and Vietnamese coverage of the same event (verified against the live API).
    # The downstream agents work in English, and translated headlines lose
    # exactly the nuance the extractor depends on.
    params = {
        "query": f"{query} sourcelang:english",
        "mode": "ArtList",
        "format": "json",
        "maxrecords": str(_MAX_RECORDS),
        "sort": "DateDesc",
        "timespan": timespan,
    }

    try:
        resp = await _paced_get(client, params)

        # A 429 outlives the burst that triggered it, so back off and retry
        # rather than losing the whole themed query for this cycle.
        for backoff in _RETRY_BACKOFF:
            if resp.status_code != 429:
                break
            logger.info("[news.gdelt] %s rate-limited — retrying in %.0fs", label, backoff)
            await asyncio.sleep(backoff)
            resp = await _paced_get(client, params)

        resp.raise_for_status()

        # GDELT answers a malformed or over-broad query with an HTML/plaintext
        # error body under a 200, so this cannot assume JSON.
        try:
            payload = resp.json()
        except ValueError:
            logger.warning("[news.gdelt] %s — non-JSON response, skipping", label)
            return []

        articles = payload.get("articles") or []
        out: list[dict[str, Any]] = []

        for art in articles:
            url = (art.get("url") or "").strip()
            title = (art.get("title") or "").strip()
            if not url or not title:
                continue

            out.append({
                "url": url,
                "title": title,
                # GDELT returns no standfirst — only title and metadata. The
                # workflow's extractor handles title-only items; they simply
                # carry slightly lower confidence.
                "summary": None,
                "author": None,
                "published_at": _parse_gdelt_datetime(art.get("seendate", "")),
                "source_name": (art.get("domain") or "GDELT").strip(),
                "source_slug": f"gdelt_{label}",
                "source_type": "GDELT",
                "source_tier": 3,
                "category": "GLOBAL",
                "regions": list(regions),
                "butterfly_weight": 1.0,
                "image_url": (art.get("socialimage") or "").strip() or None,
                "language": (art.get("language") or "English").lower()[:2],
            })

        logger.info("[news.gdelt] %s — %d articles", label, len(out))
        return out

    except Exception as exc:
        logger.warning("[news.gdelt] %s FAILED — %s: %s", label, type(exc).__name__, exc)
        return []


async def fetch_gdelt(timespan: str = "1d") -> list[dict[str, Any]]:
    """Run every themed query, strictly sequentially.

    The whole pass takes roughly a minute at the enforced pacing. That is fine:
    it runs on the background sync loop, not in a request path, and GDELT is
    best-effort enrichment — the RSS registry alone already supplies the bulk of
    the feed, so a fully rate-limited GDELT cycle degrades coverage rather than
    breaking ingestion.
    """
    items: list[dict[str, Any]] = []

    async with httpx.AsyncClient() as client:
        for label, query, regions in GDELT_QUERIES:
            items.extend(await _fetch_one(client, label, query, regions, timespan))

    logger.info("[news.gdelt] batch complete — %d raw items", len(items))
    return items
