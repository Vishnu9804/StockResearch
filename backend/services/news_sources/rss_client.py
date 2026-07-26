"""
services/news_sources/rss_client.py
Publisher RSS ingestion.

RSS is the right primitive here: publishers emit it deliberately for
syndication, it needs no key, has no quota, and no commercial-use clause to
negotiate. The tradeoff is that feed URLs rot — publishers reorganise sections
every year or two — so every feed is fetched independently and a dead feed is
logged and skipped rather than failing the batch. ``feed_health()`` exposes the
per-feed state so a rotted URL is visible instead of silently starving the feed.

We store headline + publisher summary + link only, never scraped article
bodies. That is both the legally clean position and, in practice, enough signal:
the workflow reasons about the EVENT ("Indonesia restricts nickel exports"),
which is fully carried by a headline and a two-sentence standfirst.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

logger = logging.getLogger("news.rss")

# See _parse_entries for why this exists: a dateless entry must not be able to
# outrank a genuinely-dated article that is more recent than this buffer.
_DATELESS_FALLBACK_STALENESS = timedelta(hours=4)

# A self-identifying bot UA is the polite default, but several Indian publisher
# CDNs 403 anything that isn't a mainstream browser string — verified against
# PIB, Livemint and ET, all of which return 403 or time out on a bot UA and 200
# on this one. Requests stay well within RSS-appropriate rates regardless.
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)
_FEED_HEADERS = {
    "User-Agent": _USER_AGENT,
    "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
}
_FEED_TIMEOUT = 25.0


@dataclass(frozen=True)
class FeedSpec:
    """One RSS feed.

    tier feeds the Confidence term of the scorer:
      1 = regulator / exchange / primary wire (RBI, PIB, SEBI) — highest trust
      2 = established financial publication
      3 = aggregator or syndicated republisher

    category is the coarse bucket used to pre-route triage; the workflow refines
    it. ``butterfly_weight`` marks feeds that carry the macro/commodity/global
    events second-order chains actually start from, so ingestion can prioritise
    them when the analysis budget is tight.
    """

    slug: str
    name: str
    url: str
    category: str
    tier: int = 2
    butterfly_weight: float = 0.5
    regions: tuple[str, ...] = ("IN",)


def _google_news(query: str) -> str:
    """Google News RSS search — keyless, and the most reliable way to get global
    commodity/policy coverage that Indian domestic feeds under-serve."""
    from urllib.parse import quote_plus

    return (
        f"https://news.google.com/rss/search?q={quote_plus(query)}"
        "&hl=en-IN&gl=IN&ceid=IN:en"
    )


# ── Feed registry ────────────────────────────────────────────────────────────
# Split deliberately between DOMESTIC MARKET feeds (which mostly produce direct,
# red-alert news) and MACRO/COMMODITY/GLOBAL feeds (which produce the indirect
# events this whole feature exists to catch). A registry weighted only toward
# the first group would make the butterfly workflow structurally unable to find
# anything interesting.
RSS_FEEDS: tuple[FeedSpec, ...] = (
    # ── Indian markets & corporate ──────────────────────────────────────────
    FeedSpec("et_markets", "Economic Times",
             "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms",
             "MARKETS", tier=2, butterfly_weight=0.4),
    FeedSpec("et_economy", "Economic Times",
             "https://economictimes.indiatimes.com/news/economy/rssfeeds/1373380680.cms",
             "MACRO", tier=2, butterfly_weight=0.9),
    FeedSpec("et_industry", "Economic Times",
             "https://economictimes.indiatimes.com/industry/rssfeeds/13352306.cms",
             "SECTOR", tier=2, butterfly_weight=0.85),
    FeedSpec("mint_markets", "Livemint",
             "https://www.livemint.com/rss/markets",
             "MARKETS", tier=2, butterfly_weight=0.4),
    FeedSpec("mint_economy", "Livemint",
             "https://www.livemint.com/rss/economy",
             "MACRO", tier=2, butterfly_weight=0.9),
    FeedSpec("mint_industry", "Livemint",
             "https://www.livemint.com/rss/industry",
             "SECTOR", tier=2, butterfly_weight=0.85),
    FeedSpec("bl_markets", "The Hindu BusinessLine",
             "https://www.thehindubusinessline.com/markets/feeder/default.rss",
             "MARKETS", tier=2, butterfly_weight=0.4),
    FeedSpec("bl_economy", "The Hindu BusinessLine",
             "https://www.thehindubusinessline.com/economy/feeder/default.rss",
             "MACRO", tier=2, butterfly_weight=0.9),
    FeedSpec("hindu_business", "The Hindu",
             "https://www.thehindu.com/business/feeder/default.rss",
             "SECTOR", tier=2, butterfly_weight=0.7),
    FeedSpec("ndtv_profit", "NDTV Profit",
             "https://feeds.feedburner.com/ndtvprofit-latest",
             "MARKETS", tier=2, butterfly_weight=0.5),

    # ── Policy / regulator (tier 1: primary sources) ────────────────────────
    # Verified live: PIB's Lang param is unreliable on its own — a plain
    # Lang=1 request gets redirected server-side to the Hindi feed (Lang=2).
    # The URL below pins the exact `reg=48` region parameter PIB's own
    # redirect resolves to, which serves genuine English content (confirmed by
    # inspecting entries directly). services/news_ingest.py additionally
    # detects language from each title regardless of source, so any regression
    # here still can't put non-English content in front of a user.
    FeedSpec("pib_releases", "Press Information Bureau",
             "https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3&reg=48",
             "POLICY", tier=1, butterfly_weight=0.95),

    # Business Standard, Moneycontrol and ZeeBiz are deliberately absent: all
    # three serve a hard 403 to non-browser clients from their edge (verified),
    # and working around bot protection is not a dependency worth having in an
    # ingestion path. Their coverage overlaps almost entirely with ET, Mint and
    # BusinessLine, which serve RSS willingly.

    # ── Global macro & commodities — where butterfly chains originate ───────
    # Domestic market feeds will not tell you Indonesia restricted nickel or
    # that Brent moved on OPEC quotas, but those are precisely the events that
    # reach an Indian portfolio two or three hops later.
    FeedSpec("g_crude", "Google News",
             _google_news("crude oil price OPEC Brent supply"),
             "COMMODITY", tier=3, butterfly_weight=1.0, regions=("GLOBAL",)),
    FeedSpec("g_metals", "Google News",
             _google_news("nickel copper aluminium steel prices export ban"),
             "COMMODITY", tier=3, butterfly_weight=1.0, regions=("GLOBAL",)),
    FeedSpec("g_fed", "Google News",
             _google_news("US Federal Reserve interest rate decision inflation"),
             "MACRO", tier=3, butterfly_weight=0.95, regions=("US", "GLOBAL")),
    FeedSpec("g_rbi", "Google News",
             _google_news("RBI repo rate monetary policy India inflation"),
             "POLICY", tier=3, butterfly_weight=0.95),
    FeedSpec("g_china", "Google News",
             _google_news("China export curbs manufacturing supply chain"),
             "GLOBAL", tier=3, butterfly_weight=1.0, regions=("CN", "GLOBAL")),
    FeedSpec("g_semis", "Google News",
             _google_news("semiconductor chip shortage supply chain export controls"),
             "GLOBAL", tier=3, butterfly_weight=1.0, regions=("GLOBAL",)),
    FeedSpec("g_energy", "Google News",
             _google_news("natural gas LNG coal power tariff India"),
             "COMMODITY", tier=3, butterfly_weight=0.95),
    FeedSpec("g_agri", "Google News",
             _google_news("monsoon India crop output food inflation sugar palm oil"),
             "COMMODITY", tier=3, butterfly_weight=0.95),
    FeedSpec("g_fx", "Google News",
             _google_news("rupee dollar exchange rate USD INR"),
             "MACRO", tier=3, butterfly_weight=0.9),
    FeedSpec("g_shipping", "Google News",
             _google_news("shipping freight rates Red Sea Suez container logistics"),
             "GLOBAL", tier=3, butterfly_weight=1.0, regions=("GLOBAL",)),
)

FEEDS_BY_SLUG: dict[str, FeedSpec] = {f.slug: f for f in RSS_FEEDS}


# ── Feed health ──────────────────────────────────────────────────────────────
@dataclass
class FeedHealth:
    slug: str
    ok: bool = True
    last_ok_at: datetime | None = None
    last_error: str | None = None
    consecutive_failures: int = 0
    last_entry_count: int = 0


_health: dict[str, FeedHealth] = {}


def feed_health() -> list[dict[str, Any]]:
    """Per-feed state, surfaced by the /news/health endpoint. RSS URLs rot; this
    is what makes that visible instead of a feed quietly going to zero."""
    return [
        {
            "slug": h.slug,
            "ok": h.ok,
            "last_ok_at": h.last_ok_at.isoformat() if h.last_ok_at else None,
            "last_error": h.last_error,
            "consecutive_failures": h.consecutive_failures,
            "last_entry_count": h.last_entry_count,
        }
        for h in sorted(_health.values(), key=lambda x: x.slug)
    ]


def _record(slug: str, *, ok: bool, count: int = 0, error: str | None = None) -> None:
    h = _health.setdefault(slug, FeedHealth(slug=slug))
    h.ok = ok
    if ok:
        h.last_ok_at = datetime.now(timezone.utc)
        h.last_error = None
        h.consecutive_failures = 0
        h.last_entry_count = count
    else:
        h.last_error = error
        h.consecutive_failures += 1


# ── Parsing ──────────────────────────────────────────────────────────────────
def _parse_entries(raw: bytes, spec: FeedSpec) -> list[dict[str, Any]]:
    """feedparser is sync and CPU-bound; callers run this in a worker thread."""
    import feedparser

    parsed = feedparser.parse(raw)
    out: list[dict[str, Any]] = []

    for idx, entry in enumerate(parsed.entries):
        link = (entry.get("link") or "").strip()
        title = (entry.get("title") or "").strip()
        if not link or not title:
            continue

        # feedparser normalises the half-dozen RSS/Atom date spellings into a
        # struct_time. Some publishers omit a date entirely — verified live:
        # PIB's feed carries no <pubDate>/<updated> on any entry, only title
        # and link. Stamping those with "now" (the previous behaviour) is a
        # real accuracy bug, not a harmless approximation: it makes every
        # dateless item permanently outrank genuinely-dated articles from
        # other sources that are only a few hours old but factually more
        # recent — confirmed happening (dateless PIB releases were sorting
        # above a same-day RBI story from a source with a real timestamp).
        # A conservative backdate avoids that while still surfacing these
        # items reasonably promptly; the per-entry stagger preserves the
        # feed's own newest-first ordering instead of tying every entry to
        # the exact same instant.
        published = None
        for key in ("published_parsed", "updated_parsed"):
            tm = entry.get(key)
            if tm:
                published = datetime(*tm[:6], tzinfo=timezone.utc)
                break
        if published is None:
            published = (
                datetime.now(timezone.utc)
                - _DATELESS_FALLBACK_STALENESS
                - timedelta(seconds=idx * 30)
            )

        summary = (entry.get("summary") or entry.get("description") or "").strip()

        out.append({
            "url": link,
            "title": title,
            "summary": summary,
            "author": (entry.get("author") or "").strip() or None,
            "published_at": published,
            "source_name": spec.name,
            "source_slug": spec.slug,
            "source_type": "RSS",
            "source_tier": spec.tier,
            "category": spec.category,
            "regions": list(spec.regions),
            "butterfly_weight": spec.butterfly_weight,
        })

    return out


async def fetch_feed(client: httpx.AsyncClient, spec: FeedSpec) -> list[dict[str, Any]]:
    """Fetch and parse one feed. Never raises — a rotted or rate-limited feed
    must not take down the ingestion batch."""
    try:
        resp = await client.get(
            spec.url,
            headers=_FEED_HEADERS,
            timeout=_FEED_TIMEOUT,
            follow_redirects=True,
        )
        resp.raise_for_status()
        entries = await asyncio.to_thread(_parse_entries, resp.content, spec)
        _record(spec.slug, ok=True, count=len(entries))
        logger.info("[news.rss] %s — %d entries", spec.slug, len(entries))
        return entries
    except Exception as exc:
        _record(spec.slug, ok=False, error=f"{type(exc).__name__}: {exc}")
        logger.warning("[news.rss] %s FAILED — %s: %s", spec.slug, type(exc).__name__, exc)
        return []


async def fetch_all_feeds(
    feeds: tuple[FeedSpec, ...] = RSS_FEEDS,
    *,
    concurrency: int = 6,
) -> list[dict[str, Any]]:
    """Fetch every registered feed concurrently.

    Concurrency is capped so we look like a well-behaved crawler to publisher
    CDNs — several of them throttle or serve 403 on burst traffic from one IP.
    """
    sem = asyncio.Semaphore(concurrency)

    async with httpx.AsyncClient(
        limits=httpx.Limits(max_connections=concurrency * 2)
    ) as client:

        async def _one(spec: FeedSpec) -> list[dict[str, Any]]:
            async with sem:
                return await fetch_feed(client, spec)

        batches = await asyncio.gather(*(_one(f) for f in feeds))

    items = [item for batch in batches for item in batch]
    logger.info("[news.rss] batch complete — %d raw items from %d feeds", len(items), len(feeds))
    return items
