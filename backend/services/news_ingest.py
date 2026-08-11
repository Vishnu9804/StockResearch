"""
services/news_ingest.py
Ingestion pipeline: marketaux -> normalise -> dedupe -> tag -> persist.

Everything here is deterministic Python. No LLM is involved at ingestion time,
on purpose: the expensive multi-agent analysis runs against a clean, deduped,
pre-scored queue, so tokens are never spent on a story we already have or on an
item that was never market-relevant to begin with.

Stages
  1. collect    fan out marketaux's themed queries concurrently
  2. normalise  clean HTML, clamp lengths, coerce timezone-aware timestamps
  3. dedupe     url_hash (hard) then title_hash (soft, cross-publisher)
  4. tag        match NSE symbols/company names via the company_metrics universe
  5. score      heuristic market_relevance gate for the analysis queue
  6. persist    ON CONFLICT DO NOTHING insert, so re-polling is free

Note on symbol tagging (stage 4): marketaux already returns its own tagged
entities per article (industry, exchange, a match/sentiment score), stored
verbatim in NewsItem.mentioned_entities. mentioned_symbols is deliberately
NOT derived from those — marketaux's entity symbols don't reliably match this
app's NSE-symbol convention, and this column feeds user-visible RED alerts
directly, so it keeps using the alias index below, matched only against the
company_metrics universe this app already trusts.
"""

import hashlib
import html
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Iterable

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from core.config import settings
from core.database import async_session_maker
from models.models import CompanyMetric, NewsItem, UserNewsAlert
from services.news_sources import fetch_marketaux

logger = logging.getLogger("news.ingest")

MAX_TITLE_LEN = 500
MAX_SUMMARY_LEN = 2000

# Items older than this are dropped at ingestion — a butterfly alert on a
# three-week-old story is noise, and GDELT backfills can reach far back.
MAX_AGE_DAYS = 5

# Below this heuristic score an item is stored (it still belongs in the general
# feed) but never enters the analysis queue. This is the first and cheapest of
# the three filters that keep YELLOW from swallowing everything.
ANALYSIS_RELEVANCE_FLOOR = 0.35


# ── 2. Normalisation ─────────────────────────────────────────────────────────
_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")
_PUNCT_RE = re.compile(r"[^\w\s]")


# Verified live: PIB's RSS endpoint silently redirects an English-requested
# URL (Lang=1) to its Hindi variant (Lang=2) server-side — the query param is
# ignored and there is no URL that reliably forces English. Trusting a feed's
# declared/assumed language is therefore not safe; every title is checked
# directly regardless of source. Devanagari is the concrete case found, but the
# range check generalises to any non-Latin script a future feed might add.
_NON_LATIN_RE = re.compile(
    r"[ऀ-ॿঀ-৿਀-੿଀-୿ఀ-౿"
    r"ഀ-ൿ؀-ۿ一-鿿぀-ヿ가-힯]"
)


def _detect_language(title: str) -> str:
    """Best-effort: 'en' unless a meaningful share of the title is non-Latin
    script. Deliberately coarse (a script check, not a real language model) —
    it only needs to catch the case a feed's own language label lied about."""
    letters = [c for c in title if c.isalpha()]
    if not letters:
        return "en"
    non_latin = len(_NON_LATIN_RE.findall(title))
    return "en" if (non_latin / len(letters)) < 0.15 else "other"


def _clean_text(value: str | None, limit: int) -> str | None:
    """Publisher summaries routinely carry markup, tracking pixels and entities."""
    if not value:
        return None
    text = _TAG_RE.sub(" ", value)
    text = html.unescape(text)
    text = _WS_RE.sub(" ", text).strip()
    if not text:
        return None
    return text[:limit]


def _sha(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="ignore")).hexdigest()


def _url_hash(url: str) -> str:
    """Hash the URL with tracking parameters stripped, so the same article
    arriving via a feed and via a Google News redirect collapses to one row."""
    from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

    try:
        parts = urlsplit(url.strip())
        keep = [
            (k, v) for k, v in parse_qsl(parts.query)
            if not k.lower().startswith(("utm_", "oc", "ref", "cmp", "fbclid", "gclid"))
        ]
        netloc = parts.netloc.lower().removeprefix("www.")
        path = parts.path.rstrip("/")
        canonical = urlunsplit((parts.scheme.lower(), netloc, path, urlencode(keep), ""))
    except Exception:
        canonical = url.strip().lower()
    return _sha(canonical)


def _title_hash(title: str) -> str:
    """Soft dedup key. Lowercased, punctuation-stripped, whitespace-collapsed —
    catches the same wire story republished verbatim under several mastheads."""
    normalised = _WS_RE.sub(" ", _PUNCT_RE.sub(" ", title.lower())).strip()
    return _sha(normalised)


def _normalise(raw: dict[str, Any]) -> dict[str, Any] | None:
    title = _clean_text(raw.get("title"), MAX_TITLE_LEN)
    url = (raw.get("url") or "").strip()
    if not title or not url:
        return None

    published = raw.get("published_at")
    if not isinstance(published, datetime):
        published = datetime.now(timezone.utc)
    if published.tzinfo is None:
        published = published.replace(tzinfo=timezone.utc)

    # Publisher clock skew regularly produces timestamps a few hours in the
    # future; clamp rather than drop, or the feed develops holes.
    now = datetime.now(timezone.utc)
    if published > now + timedelta(hours=6):
        published = now

    # Detected from the actual title, never trusted from the source label — see
    # _detect_language's docstring for why (a real feed was found lying about
    # this: PIB serves Hindi while claiming Lang=1/English).
    detected_language = _detect_language(title)

    return {
        "url": url,
        "url_hash": _url_hash(url),
        "title_hash": _title_hash(title),
        "title": title,
        "summary": _clean_text(raw.get("summary"), MAX_SUMMARY_LEN),
        "image_url": raw.get("image_url"),
        "language": detected_language,
        "source_name": raw.get("source_name") or "Unknown",
        "source_slug": raw.get("source_slug") or "unknown",
        "source_type": raw.get("source_type") or "MARKETAUX",
        "source_tier": int(raw.get("source_tier") or 3),
        "author": raw.get("author"),
        "published_at": published,
        "category": raw.get("category"),
        "regions": raw.get("regions") or [],
        # marketaux's own tagged entities (symbol/industry/sentiment/match
        # score), passed straight through — see the module docstring for why
        # this is kept separate from mentioned_symbols.
        "mentioned_entities": raw.get("entities") or [],
        "_butterfly_weight": float(raw.get("butterfly_weight") or 0.5),
    }


# ── 4. Symbol tagging ────────────────────────────────────────────────────────
# Cached alias index built from company_metrics — the same universe the screener
# filters against, so tagging can never reference a symbol the app doesn't know.
_alias_index: dict[str, str] | None = None
_alias_built_at: datetime | None = None
_ALIAS_TTL = timedelta(hours=6)

# Corporate suffixes carry no identifying signal and cause cross-matches.
_SUFFIX_RE = re.compile(
    r"\b(limited|ltd|private|pvt|corporation|corp|company|co|inc|plc|"
    r"industries|enterprises|holdings|india)\b",
    re.IGNORECASE,
)

# Names that are ordinary English words or too generic to match safely.
_ALIAS_STOPLIST = {
    "in", "on", "at", "it", "is", "as", "the", "and", "for", "one", "may",
    "can", "will", "new", "best", "first", "gold", "power", "bank", "india",
    "steel", "cement", "motors", "finance", "capital", "energy", "oil", "gas",
    "sun", "force", "orient", "century", "eagle", "tide", "trent", "page",
}


async def _build_alias_index() -> dict[str, str]:
    """alias (lowercased) -> symbol.

    Two aliases per company: the ticker itself, and the trading name with
    corporate suffixes stripped. Anything shorter than four characters or on the
    stoplist is skipped — 'SUN' or 'BANK' appearing in a headline says nothing
    about Sun Pharma, and a false symbol tag propagates all the way to a
    user-visible red alert.
    """
    index: dict[str, str] = {}

    async with async_session_maker() as session:
        rows = (await session.execute(select(CompanyMetric.symbol, CompanyMetric.name))).all()

    for symbol, name in rows:
        if not symbol:
            continue
        sym = symbol.strip().upper()

        if len(sym) >= 4 and sym.lower() not in _ALIAS_STOPLIST:
            index[sym.lower()] = sym

        if name:
            base = _SUFFIX_RE.sub(" ", name)
            base = _WS_RE.sub(" ", _PUNCT_RE.sub(" ", base)).strip().lower()
            if len(base) >= 4 and base not in _ALIAS_STOPLIST:
                index.setdefault(base, sym)

    logger.info("[news.ingest] alias index built — %d aliases over %d companies",
                len(index), len(rows))
    return index


async def _get_alias_index() -> dict[str, str]:
    global _alias_index, _alias_built_at
    now = datetime.now(timezone.utc)
    if _alias_index is None or _alias_built_at is None or now - _alias_built_at > _ALIAS_TTL:
        try:
            _alias_index = await _build_alias_index()
            _alias_built_at = now
        except Exception as exc:
            logger.warning("[news.ingest] alias index build failed — %s", exc)
            _alias_index = _alias_index or {}
    return _alias_index


def _tag_symbols(text: str, aliases: dict[str, str]) -> list[str]:
    """Word-boundary alias match. Substring matching is not an option here:
    'ITC' inside 'switch' or 'TATA' inside a URL slug would both produce
    confident nonsense."""
    haystack = _WS_RE.sub(" ", _PUNCT_RE.sub(" ", text.lower()))
    padded = f" {haystack} "
    found: set[str] = set()
    for alias, symbol in aliases.items():
        if f" {alias} " in padded:
            found.add(symbol)
    return sorted(found)


# ── 5. Heuristic relevance gate ──────────────────────────────────────────────
# Terms that indicate a transmission mechanism rather than a company mention.
# An item scoring on these is a butterfly candidate even when it names no
# listed company at all — which is the entire point.
_MECHANISM_TERMS = (
    "price", "prices", "tariff", "export", "import", "ban", "quota", "sanction",
    "supply", "shortage", "surplus", "output", "production", "capacity",
    "inflation", "rate", "rates", "repo", "policy", "regulation", "gst", "duty",
    "subsidy", "rupee", "dollar", "crude", "oil", "gas", "coal", "metal",
    "demand", "strike", "disruption", "freight", "shipping", "monsoon",
    "harvest", "chip", "semiconductor", "stimulus", "budget", "deficit",
)

_NOISE_TERMS = (
    "horoscope", "cricket", "bollywood", "recipe", "movie review", "box office",
    "wedding", "trailer", "obituary", "quiz", "puzzle", "viral video",
)


def _score_relevance(item: dict[str, Any], symbols: list[str]) -> float:
    """Cheap 0..1 gate deciding whether an item is worth LLM time.

    Intentionally generous toward macro/commodity items with no symbol match:
    those are the highest-value inputs to this workflow, and under-collecting
    them is a far worse failure than over-collecting them, since the Skeptic
    stage downstream is what actually enforces precision.
    """
    text = f"{item['title']} {item.get('summary') or ''}".lower()

    if any(term in text for term in _NOISE_TERMS):
        return 0.0

    score = 0.15
    score += 0.35 * item["_butterfly_weight"]

    hits = sum(1 for term in _MECHANISM_TERMS if term in text)
    score += min(hits, 5) * 0.07

    if symbols:
        score += 0.20

    if item["source_tier"] == 1:
        score += 0.12
    elif item["source_tier"] == 2:
        score += 0.06

    if item.get("category") in ("MACRO", "COMMODITY", "POLICY", "GLOBAL", "SECTOR"):
        score += 0.10

    # A title-only item with no standfirst gives the extractor much less to work
    # with, so it needs a stronger signal elsewhere to earn analysis.
    if not item.get("summary"):
        score -= 0.08

    return round(max(0.0, min(1.0, score)), 3)


# ── 6. Persistence ───────────────────────────────────────────────────────────
async def _persist(items: list[dict[str, Any]]) -> int:
    """Insert with ON CONFLICT DO NOTHING on url_hash.

    Re-polling a feed every 15 minutes re-delivers the same 40 entries; making
    the insert idempotent at the database level is cheaper and far more reliable
    than a read-then-write check, which would race across workers.
    """
    if not items:
        return 0

    rows = []
    for item in items:
        row = {k: v for k, v in item.items() if not k.startswith("_")}
        rows.append(row)

    inserted = 0
    async with async_session_maker() as session:
        # Chunked so one oversized batch can't blow the statement limit.
        for start in range(0, len(rows), 200):
            chunk = rows[start:start + 200]
            stmt = (
                pg_insert(NewsItem)
                .values(chunk)
                .on_conflict_do_nothing(index_elements=["url_hash"])
                .returning(NewsItem.id)
            )
            result = await session.execute(stmt)
            inserted += len(result.fetchall())
        await session.commit()

    return inserted


def _dedupe_in_batch(items: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    """Collapse duplicates inside one batch before touching the database.

    Two passes: exact URL, then normalised title across publishers. When the
    same story arrives from several sources the most authoritative one wins, so
    the surviving row carries the best source_tier for the confidence term.
    """
    by_url: dict[str, dict[str, Any]] = {}
    for item in items:
        existing = by_url.get(item["url_hash"])
        if existing is None or item["source_tier"] < existing["source_tier"]:
            by_url[item["url_hash"]] = item

    by_title: dict[str, dict[str, Any]] = {}
    for item in by_url.values():
        existing = by_title.get(item["title_hash"])
        if existing is None or item["source_tier"] < existing["source_tier"]:
            by_title[item["title_hash"]] = item

    return list(by_title.values())


# ── Orchestration ────────────────────────────────────────────────────────────
async def ingest_news() -> dict[str, Any]:
    """Run one full ingestion cycle. Returns a summary for logs and /news/health."""
    started = datetime.now(timezone.utc)

    try:
        raw = await fetch_marketaux()
    except Exception as exc:
        # fetch_marketaux already isolates failures per query; this guards
        # only against something unexpected breaking the whole batch.
        logger.warning("[news.ingest] marketaux fetch failed — %s", exc)
        raw = []

    cutoff = started - timedelta(days=MAX_AGE_DAYS)
    normalised = []
    for entry in raw:
        item = _normalise(entry)
        if item and item["published_at"] >= cutoff:
            normalised.append(item)

    deduped = _dedupe_in_batch(normalised)

    aliases = await _get_alias_index()
    for item in deduped:
        text = f"{item['title']} {item.get('summary') or ''}"
        symbols = _tag_symbols(text, aliases) if aliases else []
        item["mentioned_symbols"] = symbols
        item["market_relevance"] = _score_relevance(item, symbols)
        # Non-English items are stored (for completeness/audit) but never
        # queued for analysis — the downstream agent prompts are English, and
        # a mistranslated or misread non-English item is exactly the kind of
        # silent-inaccuracy risk this pipeline exists to avoid.
        item["analysis_status"] = (
            "PENDING"
            if item["language"] == "en" and item["market_relevance"] >= ANALYSIS_RELEVANCE_FLOOR
            else "SKIPPED"
        )

    inserted = await _persist(deduped)

    summary = {
        "started_at": started.isoformat(),
        "duration_ms": int((datetime.now(timezone.utc) - started).total_seconds() * 1000),
        "raw_fetched": len(raw),
        "after_normalise": len(normalised),
        "after_dedupe": len(deduped),
        "inserted": inserted,
        "queued_for_analysis": sum(1 for i in deduped if i["analysis_status"] == "PENDING"),
    }
    logger.info("[news.ingest] cycle complete — %s", summary)
    return summary


# ── Retention ─────────────────────────────────────────────────────────────────
async def cleanup_stale_news(retention_days: int | None = None) -> dict[str, Any]:
    """Delete news strictly older than the retention window.

    Time-based ONLY — never row-count-based. A count cap (e.g. "keep the
    newest N rows") lets one unusually heavy news day evict entries from a day
    that would otherwise still be well inside the retention window; a fixed
    time cutoff can't do that, because "how old" never depends on how many
    articles arrived on any given day.

    A row with an unread/undismissed alert is kept past the cutoff — deleting
    it would cascade-delete the alert via user_news_alerts.news_id and silently
    vanish something from a user's inbox they haven't seen yet. Once every
    alert on a row is read or dismissed, the row is eligible for deletion.
    """
    days = retention_days if retention_days is not None else settings.NEWS_RETENTION_DAYS
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    async with async_session_maker() as session:
        protected_ids = (
            await session.execute(
                select(UserNewsAlert.news_id).where(
                    UserNewsAlert.read_at.is_(None),
                    UserNewsAlert.dismissed_at.is_(None),
                ).distinct()
            )
        ).scalars().all()

        result = await session.execute(
            delete(NewsItem)
            .where(
                NewsItem.published_at < cutoff,
                NewsItem.id.notin_(protected_ids) if protected_ids else True,
            )
            .returning(NewsItem.id)
        )
        deleted_ids = result.fetchall()
        await session.commit()

    summary = {
        "retention_days": days,
        "cutoff": cutoff.isoformat(),
        "deleted": len(deleted_ids),
        "protected_by_unread_alert": len(protected_ids),
    }
    logger.info("[news.ingest] cleanup — %s", summary)
    return summary
