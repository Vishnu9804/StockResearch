"""
services/news_sources/marketaux_client.py
marketaux — the sole news provider for the Butterfly Effect workflow.

Picked over mediastack and WorldAPI in a paid-tier review (12 Aug 2026, see
core/config.py's "News (marketaux)" block): mediastack's India "business"
coverage turned out to be a re-serve of the same free Google News RSS this
app used to fetch directly, and WorldAPI bills per call in crypto (USDC) —
there is no ordinary subscription to buy. marketaux is purpose-built for
market news: every article carries per-company sentiment, industry and a
match-confidence score, which services/news_ingest.py stores verbatim in
NewsItem.mentioned_entities.

QUERIES below mirrors the domestic/global split the old RSS+GDELT registries
used (see git history) — domestic queries filter by exchange country,
global/thematic queries filter by keyword search instead, because
marketaux's ``countries`` filter matches the country of an article's tagged
ENTITIES, not the country it was published in, and macro/commodity stories
(an Indonesian nickel export ban, an OPEC quota) routinely name no company at
all. One API call already searches 5,000+ sources, so this needs far fewer
requests than the old per-publisher RSS registry did for the same breadth.
"""

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import httpx

from core.config import settings

logger = logging.getLogger("news.marketaux")

_BASE_URL = "https://api.marketaux.com/v1/news/all"
_TIMEOUT = 25.0

# marketaux answers a throttled request with a 429; a short backoff and one
# retry is enough since QUERIES is small and each query is a single call.
_RETRY_BACKOFF_SECONDS = 5.0


@dataclass(frozen=True)
class QuerySpec:
    """One themed marketaux query.

    tier / butterfly_weight follow the same convention the old RSS registry
    used: tier 1 = regulator/exchange/primary wire, 2 = established coverage,
    3 = broad aggregation; butterfly_weight marks how likely a query is to
    surface the macro/commodity/global events the workflow's second-order
    chains actually start from.
    """

    slug: str
    category: str
    params: dict[str, str]
    tier: int = 2
    butterfly_weight: float = 0.5
    regions: tuple[str, ...] = ("IN",)


QUERIES: tuple[QuerySpec, ...] = (
    # ── Domestic — filtered by the exchange country of tagged entities ──────
    QuerySpec(
        "domestic_markets", "MARKETS",
        {"countries": "in", "language": "en"},
        tier=2, butterfly_weight=0.4, regions=("IN",),
    ),
    QuerySpec(
        "domestic_macro_policy", "MACRO",
        {"countries": "in", "language": "en",
         "search": '(rbi|"repo rate"|inflation|budget|gst|rupee|fiscal|"monetary policy")'},
        tier=2, butterfly_weight=0.9, regions=("IN",),
    ),
    QuerySpec(
        "domestic_sector", "SECTOR",
        {"countries": "in", "language": "en",
         "industries": "Energy,Basic Materials,Industrials,Utilities"},
        tier=2, butterfly_weight=0.85, regions=("IN",),
    ),

    # ── Global — keyword search, no country filter. These are what surface
    # the FOREIGN event at the head of a causal chain (an export ban, a
    # supply shock) that domestic-only coverage structurally cannot. ────────
    QuerySpec(
        "global_commodity", "COMMODITY",
        {"language": "en",
         "search": '(crude|"natural gas"|opec|nickel|copper|aluminium|lithium|coal)'
                    '+(supply|export|ban|shortage|tariff|output|quota)'},
        tier=3, butterfly_weight=1.0, regions=("GLOBAL",),
    ),
    QuerySpec(
        "global_macro", "MACRO",
        {"language": "en",
         "search": '(fed|"federal reserve"|"interest rate"|inflation)+(hike|cut|decision|policy)'},
        tier=3, butterfly_weight=0.95, regions=("US", "GLOBAL"),
    ),
    QuerySpec(
        "global_trade_policy", "POLICY",
        {"language": "en",
         "search": '(tariff|"export control"|sanction|"trade restriction")'
                    '+(china|india|"united states"|eu)'},
        tier=3, butterfly_weight=0.95, regions=("GLOBAL",),
    ),
    QuerySpec(
        "global_supply_agri", "GLOBAL",
        {"language": "en",
         "search": '("supply chain"|shipping|freight|monsoon|wheat|sugar|"palm oil"|fertiliser)'
                    '+(disruption|strike|export|ban|shortage|harvest)'},
        tier=3, butterfly_weight=1.0, regions=("GLOBAL",),
    ),
)


# ── Query health ──────────────────────────────────────────────────────────────
@dataclass
class QueryHealth:
    slug: str
    ok: bool = True
    last_ok_at: datetime | None = None
    last_error: str | None = None
    consecutive_failures: int = 0
    last_article_count: int = 0


_health: dict[str, QueryHealth] = {}


def query_health() -> list[dict[str, Any]]:
    """Per-query state, surfaced by GET /api/news/health."""
    return [
        {
            "slug": h.slug,
            "ok": h.ok,
            "last_ok_at": h.last_ok_at.isoformat() if h.last_ok_at else None,
            "last_error": h.last_error,
            "consecutive_failures": h.consecutive_failures,
            "last_article_count": h.last_article_count,
        }
        for h in sorted(_health.values(), key=lambda x: x.slug)
    ]


def _record(slug: str, *, ok: bool, count: int = 0, error: str | None = None) -> None:
    h = _health.setdefault(slug, QueryHealth(slug=slug))
    h.ok = ok
    if ok:
        h.last_ok_at = datetime.now(timezone.utc)
        h.last_error = None
        h.consecutive_failures = 0
        h.last_article_count = count
    else:
        h.last_error = error
        h.consecutive_failures += 1


# ── Parsing ──────────────────────────────────────────────────────────────────
def _parse_published_at(value: str | None) -> datetime:
    """marketaux stamps articles as 2026-08-11T18:07:36.000000Z."""
    if value:
        try:
            return datetime.strptime(value, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return datetime.now(timezone.utc)


def _slim_entity(entity: dict[str, Any]) -> dict[str, Any]:
    """Keep the fields the workflow actually consumes; drop per-entity
    ``highlights`` text, which duplicates the article body we already store
    and would otherwise roughly double the row's storage for no benefit."""
    return {
        "symbol": entity.get("symbol"),
        "name": entity.get("name"),
        "exchange": entity.get("exchange"),
        "country": entity.get("country"),
        "type": entity.get("type"),
        "industry": entity.get("industry"),
        "match_score": entity.get("match_score"),
        "sentiment_score": entity.get("sentiment_score"),
    }


def _to_raw_item(article: dict[str, Any], spec: QuerySpec) -> dict[str, Any] | None:
    url = (article.get("url") or "").strip()
    title = (article.get("title") or "").strip()
    if not url or not title:
        return None

    # ``description`` is a fuller editorial standfirst than ``snippet`` (which
    # is a truncated match excerpt); prefer it and fall back when absent.
    summary = (article.get("description") or article.get("snippet") or "").strip() or None
    entities = [_slim_entity(e) for e in (article.get("entities") or []) if isinstance(e, dict)]

    return {
        "url": url,
        "title": title,
        "summary": summary,
        "image_url": (article.get("image_url") or "").strip() or None,
        "author": None,
        "published_at": _parse_published_at(article.get("published_at")),
        "source_name": (article.get("source") or "marketaux").strip(),
        "source_slug": (article.get("source") or "marketaux").strip().lower(),
        "source_type": "MARKETAUX",
        "source_tier": spec.tier,
        "category": spec.category,
        "regions": list(spec.regions),
        "butterfly_weight": spec.butterfly_weight,
        "entities": entities,
    }


# ── Fetch ────────────────────────────────────────────────────────────────────
async def _fetch_one(client: httpx.AsyncClient, spec: QuerySpec) -> list[dict[str, Any]]:
    """Run one themed query. Never raises — one bad query must not take down
    the whole ingestion cycle."""
    params = {
        **spec.params,
        "limit": str(settings.MARKETAUX_ARTICLES_PER_REQUEST),
        "api_token": settings.MARKETAUX_API_KEY,
    }

    try:
        resp = await client.get(_BASE_URL, params=params, timeout=_TIMEOUT)

        if resp.status_code == 429:
            logger.info("[news.marketaux] %s rate-limited — retrying once", spec.slug)
            await asyncio.sleep(_RETRY_BACKOFF_SECONDS)
            resp = await client.get(_BASE_URL, params=params, timeout=_TIMEOUT)

        resp.raise_for_status()
        payload = resp.json()

        error = payload.get("error")
        if error:
            raise ValueError(f"marketaux error: {error}")

        articles = payload.get("data") or []
        out = [item for a in articles if (item := _to_raw_item(a, spec)) is not None]

        _record(spec.slug, ok=True, count=len(out))
        logger.info("[news.marketaux] %s — %d articles", spec.slug, len(out))
        return out

    except Exception as exc:
        _record(spec.slug, ok=False, error=f"{type(exc).__name__}: {exc}")
        logger.warning("[news.marketaux] %s FAILED — %s: %s", spec.slug, type(exc).__name__, exc)
        return []


async def fetch_marketaux(*, concurrency: int = 3) -> list[dict[str, Any]]:
    """Run every registered query concurrently, bounded by ``concurrency`` —
    this is a paid API with a real daily quota (unlike the old RSS/GDELT
    providers), so requests stay deliberately gentler than the old RSS
    fetcher's default of 6.
    """
    if not settings.MARKETAUX_API_KEY:
        logger.warning(
            "[news.marketaux] MARKETAUX_API_KEY is not set — idling without "
            "fetching anything until a key is configured in .env"
        )
        return []

    sem = asyncio.Semaphore(concurrency)

    async with httpx.AsyncClient(limits=httpx.Limits(max_connections=concurrency * 2)) as client:

        async def _one(spec: QuerySpec) -> list[dict[str, Any]]:
            async with sem:
                return await _fetch_one(client, spec)

        batches = await asyncio.gather(*(_one(q) for q in QUERIES))

    items = [item for batch in batches for item in batch]
    logger.info("[news.marketaux] batch complete — %d raw items from %d queries", len(items), len(QUERIES))
    return items
