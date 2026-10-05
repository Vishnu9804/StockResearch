"""
services/news_sources/gta_client.py
Global Trade Alert (GTA) — the sole news provider for the Butterfly Effect
workflow.

GTA (globaltradealert.org, St. Gallen Endowment) is a curated database of
government trade-policy interventions: tariffs, export bans, anti-dumping
duties, safeguards, subsidies, FDI rules, procurement localisation and so on,
each documented by analysts from official sources and tagged with the
implementing country, every trading partner affected, the HS product lines and
CPC sectors touched, and an evaluation of whether it harms or liberalises
foreign commercial interests. That is exactly the kind of foreign policy event
at the head of a butterfly chain ("EU puts a safeguard on silicon-electrical
steel" -> Indian exporters of that product lose a market), which is why it
replaced marketaux (see git history for that client).

API (verified live, Sep 2026 — docs: github.com/global-trade-alert/docs):
    POST https://api.globaltradealert.org/api/v1/data/
    Authorization: APIKey <key>
    body {"limit", "offset", "sorting", "request_data": {filters}}
  * Returns a bare JSON list, one object per INTERVENTION. One government
    decision (a "state act") often carries several interventions — e.g. one
    customs regulation that raises some tariffs and cuts others. They share
    state_act_id/title/date_published, so this client groups them into ONE
    news item per state act: the analysis workflow should see one event once,
    not run (and alert) once per facet of it.
  * The basic access tier returns no prose description — only structured
    fields, with products/sectors as bare HS/CPC codes. The summary/body below
    are therefore rendered from those fields, with HS chapters and CPC
    divisions translated to names so the LLM agents reason over "Iron and
    steel", not "720851". If the key is upgraded to full access,
    ``intervention_description`` is picked up automatically.
  * HARD QUOTA: at most 1,000 entries returned per rolling 24h per key
    (a 429 "Rate limit reached" otherwise, with no Retry-After). Everything
    about how this client fetches is shaped by that — see fetch_gta().
  * GTA publishes in weekday batches (0-36 entries a day, with multi-week
    gaps seen), and the median lag between a government announcing a measure
    and GTA publishing it is ~9 months. date_published is used as the item's
    published_at — it is when the event reaches this pipeline — while the real
    announcement/implementation dates are spelled out in the body so the
    agents can judge novelty ("already priced in") honestly.
"""

import asyncio
import logging
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

import httpx
from sqlalchemy import func, select

from core.config import settings
from core.database import async_session_maker
from models.models import NewsItem

logger = logging.getLogger("news.gta")

_BASE_URL = "https://api.globaltradealert.org/api/v1/data/"
# Large result sets are slow to serialise server-side; generous on purpose.
_TIMEOUT = 90.0

SOURCE_TYPE = "GTA"
SOURCE_NAME = "Global Trade Alert"
SOURCE_SLUG = "global_trade_alert"
# Tier 2 ("established publication"): GTA is a curated research database that
# documents official sources, not the regulator itself — so it is never
# scored as authoritative as an exchange/regulator filing (tier 1).
SOURCE_TIER = 2

# UN M49 codes, as GTA uses them.
INDIA_ID = 699
# Implementers whose trade policy moves global prices/flows enough to matter
# to Indian listed companies even when India isn't named as affected.
_MAJOR_ECONOMY_IDS = {
    840,  # United States of America
    156,  # China
    392,  # Japan
    410,  # Republic of Korea
    826,  # United Kingdom
    276,  # Germany
    251,  # France
    381,  # Italy
    643,  # Russia
    360,  # Indonesia
    76,   # Brazil
    682,  # Saudi Arabia
    784,  # United Arab Emirates
    36,   # Australia
    124,  # Canada
}
_MAJOR_GROUP_KEYWORDS = ("european union",)


@dataclass(frozen=True)
class QuerySpec:
    """One registered GTA query. Kept as a registry (of one) so /api/news/
    health reports per-query state the same way it always has."""

    slug: str
    request_data: dict[str, Any]


# One query, no jurisdiction filter: a foreign measure that never names India
# (an EU steel safeguard, a Chinese rare-earth export control) is precisely
# the butterfly input this feature exists for. India relevance is expressed
# per item in butterfly_weight instead of by filtering the fetch. The date
# window (submission_period) is added per cycle by fetch_gta().
QUERIES: tuple[QuerySpec, ...] = (
    QuerySpec("gta_interventions", {}),
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


# ── Time window ──────────────────────────────────────────────────────────────
def lookback_days() -> int:
    """GTA_LOOKBACK_DAYS, but always strictly inside NEWS_RETENTION_DAYS.

    Load-bearing: if the fetch window ever reached past the retention window,
    the daily cleanup would delete a row and the next poll would re-insert it
    as a brand-new row — re-running (and re-paying for) the whole agent
    workflow and re-alerting users on it, every day.
    """
    return max(1, min(settings.GTA_LOOKBACK_DAYS, settings.NEWS_RETENTION_DAYS - 2))


def lookback_floor(now: datetime | None = None) -> datetime:
    """Oldest published_at (midnight UTC) accepted from GTA. The ingest
    pipeline's age filter uses this same value, so nothing fetched inside the
    window is then dropped for being "too old"."""
    now = now or datetime.now(timezone.utc)
    return datetime.combine((now - timedelta(days=lookback_days())).date(), time.min, tzinfo=timezone.utc)


async def _window_start(floor: datetime) -> date:
    """First date_published to request this cycle.

    Incremental, because of the 1,000-entries/24h quota: re-downloading the
    whole lookback window every poll would exhaust it within a day. Starts one
    day BEFORE the newest GTA item already stored — GTA publishes in dated
    batches, so the newest day may still be receiving entries, and the extra
    day guards against an entry appearing late with a slightly earlier date.
    Anything already stored is a free no-op on insert (ON CONFLICT on
    url_hash). With nothing stored yet (fresh deploy, or a quiet stretch
    longer than retention), the full lookback window is used.
    """
    try:
        async with async_session_maker() as session:
            newest = await session.scalar(
                select(func.max(NewsItem.published_at)).where(NewsItem.source_type == SOURCE_TYPE)
            )
    except Exception as exc:
        logger.warning("[news.gta] could not read the newest stored GTA item (%s) — using full lookback", exc)
        newest = None

    if newest is None:
        return floor.date()
    return max(floor.date(), newest.date() - timedelta(days=1))


# ── Code → name tables ───────────────────────────────────────────────────────
# HS (Harmonized System) chapters: the first two digits of GTA's 6-digit
# product codes. Chapter level is deliberately coarse — it is what the agents
# need to name a factor (COMMODITY:STEEL, SECTOR:ORGANIC_CHEMICALS) and is
# stable across HS revisions, unlike 6-digit descriptions.
HS_CHAPTERS: dict[str, str] = {
    "01": "Live animals", "02": "Meat and edible offal", "03": "Fish and seafood",
    "04": "Dairy produce, eggs and honey", "05": "Other products of animal origin",
    "06": "Live plants and cut flowers", "07": "Edible vegetables", "08": "Edible fruit and nuts",
    "09": "Coffee, tea and spices", "10": "Cereals", "11": "Milling products, malt and starches",
    "12": "Oil seeds and oleaginous fruits", "13": "Lac, gums and resins",
    "14": "Vegetable plaiting materials", "15": "Animal or vegetable fats and oils",
    "16": "Preparations of meat or fish", "17": "Sugars and sugar confectionery",
    "18": "Cocoa and cocoa preparations", "19": "Preparations of cereals, flour or milk",
    "20": "Preparations of vegetables, fruit or nuts", "21": "Miscellaneous edible preparations",
    "22": "Beverages, spirits and vinegar", "23": "Food industry residues and animal feed",
    "24": "Tobacco", "25": "Salt, sulphur, stone, lime and cement", "26": "Ores, slag and ash",
    "27": "Mineral fuels and oils (crude oil, coal, natural gas)", "28": "Inorganic chemicals",
    "29": "Organic chemicals", "30": "Pharmaceutical products", "31": "Fertilisers",
    "32": "Dyes, pigments and paints", "33": "Essential oils, perfumery and cosmetics",
    "34": "Soaps, washing preparations and lubricants", "35": "Glues, starches and enzymes",
    "36": "Explosives and pyrotechnics", "37": "Photographic goods",
    "38": "Miscellaneous chemical products", "39": "Plastics", "40": "Rubber",
    "41": "Raw hides, skins and leather", "42": "Leather goods and travel goods",
    "43": "Furskins", "44": "Wood and wood articles", "45": "Cork", "46": "Basketware",
    "47": "Wood pulp", "48": "Paper and paperboard", "49": "Printed matter", "50": "Silk",
    "51": "Wool and animal hair", "52": "Cotton", "53": "Other vegetable textile fibres (jute etc.)",
    "54": "Man-made filaments", "55": "Man-made staple fibres", "56": "Nonwovens, twine and ropes",
    "57": "Carpets", "58": "Special woven fabrics", "59": "Coated or laminated textile fabrics",
    "60": "Knitted fabrics", "61": "Knitted apparel", "62": "Non-knitted apparel",
    "63": "Other made-up textile articles", "64": "Footwear", "65": "Headgear",
    "66": "Umbrellas and walking sticks", "67": "Feathers and artificial flowers",
    "68": "Articles of stone, plaster and cement", "69": "Ceramic products", "70": "Glass and glassware",
    "71": "Precious metals, stones and jewellery", "72": "Iron and steel",
    "73": "Articles of iron or steel", "74": "Copper", "75": "Nickel", "76": "Aluminium",
    "78": "Lead", "79": "Zinc", "80": "Tin", "81": "Other base metals",
    "82": "Tools and cutlery of base metal", "83": "Miscellaneous articles of base metal",
    "84": "Machinery and mechanical appliances", "85": "Electrical machinery and electronics",
    "86": "Railway equipment", "87": "Vehicles and auto parts", "88": "Aircraft and spacecraft",
    "89": "Ships and boats", "90": "Optical, medical and precision instruments",
    "91": "Clocks and watches", "92": "Musical instruments", "93": "Arms and ammunition",
    "94": "Furniture, bedding and lighting", "95": "Toys, games and sports equipment",
    "96": "Miscellaneous manufactured articles", "97": "Works of art and antiques",
}

# Raw-material chapters. A measure whose product lines are mostly in these is
# a commodity event for the feed's category, not a general policy one.
_COMMODITY_CHAPTERS = {
    "09", "10", "12", "15", "17", "25", "26", "27", "31", "52",
    "71", "72", "74", "75", "76", "78", "79", "80", "81",
}

# CPC (UN Central Product Classification, v2.1) divisions: the first two
# digits of GTA's 3-digit sector codes.
CPC_DIVISIONS: dict[str, str] = {
    "01": "Agriculture and horticulture products", "02": "Live animals and animal products",
    "03": "Forestry and logging products", "04": "Fish and fishing products",
    "11": "Coal and lignite", "12": "Crude petroleum and natural gas", "13": "Uranium and thorium ores",
    "14": "Metal ores", "15": "Stone, sand and clay", "16": "Other minerals",
    "17": "Electricity, town gas and steam", "18": "Natural water",
    "21": "Meat, fish, fruit, vegetables, oils and fats", "22": "Dairy products",
    "23": "Grain mill and other food products", "24": "Beverages", "25": "Tobacco products",
    "26": "Yarn, thread and woven fabrics", "27": "Textile articles other than apparel",
    "28": "Knitted fabrics and apparel", "29": "Leather and footwear", "31": "Wood products",
    "32": "Pulp, paper and printed matter", "33": "Coke and refined petroleum products",
    "34": "Basic chemicals", "35": "Other chemical products and man-made fibres",
    "36": "Rubber and plastics products", "37": "Glass and non-metallic mineral products",
    "38": "Furniture and other manufactured goods", "39": "Wastes and scrap", "41": "Basic metals",
    "42": "Fabricated metal products", "43": "General-purpose machinery",
    "44": "Special-purpose machinery", "45": "Office and computing machinery",
    "46": "Electrical machinery and apparatus", "47": "Radio, TV and communication equipment",
    "48": "Medical, precision and optical instruments", "49": "Transport equipment",
    "53": "Constructions", "54": "Construction services", "61": "Wholesale trade services",
    "62": "Retail trade services", "63": "Accommodation and food services",
    "64": "Passenger transport services", "65": "Freight transport services",
    "66": "Rental of transport vehicles with operators", "67": "Supporting transport services",
    "68": "Postal and courier services", "69": "Electricity, gas and water distribution",
    "71": "Financial services", "72": "Real estate services", "73": "Leasing and rental services",
    "81": "Research and development services", "82": "Legal and accounting services",
    "83": "Professional, technical and business services",
    "84": "Telecommunications and information services", "85": "Business support services",
    "86": "Services to agriculture, mining and manufacturing", "87": "Maintenance and repair services",
    "88": "Contract manufacturing services", "89": "Other manufacturing services",
    "91": "Public administration services", "92": "Education services", "93": "Health and social care services",
    "94": "Sewage and waste services", "95": "Membership organisation services",
    "96": "Recreational, cultural and sporting services", "97": "Other services",
    "98": "Domestic services", "99": "Extraterritorial organisation services",
}

EVALUATION_MEANING: dict[str, str] = {
    "Red": "almost certainly discriminates against foreign commercial interests",
    "Amber": "likely discriminates against foreign commercial interests",
    "Green": "liberalising / non-discriminatory",
    "Harmful": "discriminates against foreign commercial interests",
    "Liberalising": "liberalising / non-discriminatory",
}

# Intervention-type weights for butterfly_weight — how likely a measure is to
# move prices, supply or trade flows enough to start a causal chain. Matched
# as lowercase substrings, highest band first ("import tariff quota" must hit
# the 1.0 band before "import tariff" hits 0.75).
_TYPE_WEIGHT_BANDS: tuple[tuple[float, tuple[str, ...]], ...] = (
    (1.0, (
        "export ban", "export tax", "export quota", "export tariff quota", "export licensing",
        "import ban", "import quota", "import tariff quota", "anti-dumping", "safeguard",
        "anti-subsidy", "anti-circumvention", "minimum import price", "export-restraint",
        "export-price restraint", "export price benchmark", "local supply requirement for exports",
        "competitive devaluation",
    )),
    (0.75, (
        "import tariff", "import licensing", "internal taxation of imports", "other import charges",
        "price stabilisation", "controls on commercial transactions", "controls on credit",
        "repatriation", "trade payment", "trade balancing", "local content requirement",
        "local value added requirement", "fdi: entry", "technical barrier", "sanitary",
        "import monitoring", "export subsidy", "export incentive", "production subsidy",
        "import-related non-tariff", "export-related non-tariff",
    )),
    (0.3, (
        "grant", "loan", "guarantee", "capital injection", "equity stake", "lending",
        "financial investment", "interest payment", "state aid", "labour", "migration",
    )),
)
_DEFAULT_TYPE_WEIGHT = 0.5


# ── Parsing helpers ──────────────────────────────────────────────────────────
def _parse_date(value: Any) -> date | None:
    if not value or not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def _fmt_date(value: date | None) -> str:
    return value.strftime("%d %b %Y") if value else "not specified"


def _clean(value: Any) -> str:
    return " ".join(str(value or "").split())


def _product_code(product: Any) -> str | None:
    """Basic access returns bare ints; full access returns
    {"product_id": ..., "prior_level": ..., ...}. Codes lose their leading
    zero as ints (010121 -> 10121), hence the zfill."""
    raw = product.get("product_id") if isinstance(product, dict) else product
    if raw is None:
        return None
    code = str(raw).strip()
    return code.zfill(6) if code.isdigit() else None


def _sector_code(sector: Any) -> str | None:
    code = str(sector).strip() if sector is not None else ""
    return code.zfill(3) if code.isdigit() else None


def _jurisdictions(items: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    """Unique jurisdictions across a state act's interventions, first-seen order."""
    seen: dict[Any, dict[str, Any]] = {}
    for item in items:
        for j in item.get(key) or []:
            if isinstance(j, dict) and j.get("id") not in seen:
                seen[j.get("id")] = j
    return list(seen.values())


def _name_list(juris: list[dict[str, Any]], cap: int) -> str:
    names = [_clean(j.get("name")) for j in juris if j.get("name")]
    if len(names) <= cap:
        return ", ".join(names)
    return f"{', '.join(names[:cap])} and {len(names) - cap} more"


def _implementer_text(implementers: list[dict[str, Any]], interventions: list[dict[str, Any]], cap: int) -> str:
    """'European Union (27 member states)' rather than 27 country names, when
    GTA tags the act with a bloc. 'Single EU member' is a flag, not a bloc."""
    groups = list(dict.fromkeys(
        _clean(g.get("name")) for i in interventions for g in (i.get("implementing_jurisdiction_groups") or [])
        if isinstance(g, dict) and g.get("name") and _clean(g.get("name")) != "Single EU member"
    ))
    if len(implementers) > cap and groups:
        return f"{', '.join(groups)} ({len(implementers)} member states)"
    return _name_list(implementers, cap)


def _type_weight(intervention_type: str) -> float:
    t = intervention_type.lower()
    for weight, needles in _TYPE_WEIGHT_BANDS:
        if any(n in t for n in needles):
            return weight
    return _DEFAULT_TYPE_WEIGHT


def _butterfly_weight(
    interventions: list[dict[str, Any]],
    implementers: list[dict[str, Any]],
    india_affected: bool,
    firm_specific: bool,
    expired: bool,
) -> float:
    """0..1 prior on how likely this measure is to start a causal chain that
    reaches Indian listed companies. Feeds news_ingest._score_relevance, which
    decides analysis-queue priority and whether the item is queued at all."""
    impl_ids = {j.get("id") for j in implementers}
    groups = " ".join(
        _clean(g.get("name")).lower()
        for i in interventions for g in (i.get("implementing_jurisdiction_groups") or [])
        if isinstance(g, dict)
    )

    weight = max(_type_weight(_clean(i.get("intervention_type"))) for i in interventions)
    major = bool(impl_ids & _MAJOR_ECONOMY_IDS) or any(k in groups for k in _MAJOR_GROUP_KEYWORDS)
    if INDIA_ID in impl_ids:
        weight += 0.25
    elif india_affected:
        weight += 0.15
    elif not major:
        # A smaller economy's measure that doesn't even list India as
        # affected rarely reaches an Indian listed company.
        weight -= 0.25
    if major:
        weight += 0.10
    if expired:
        # Already lifted before it reached this pipeline — a record, not a
        # live shock. Still stored and shown; just queued behind live ones.
        weight -= 0.30
    if firm_specific and INDIA_ID not in impl_ids:
        # Money for one named foreign firm rarely moves a market on its own.
        weight -= 0.15
    if all(_clean(i.get("implementation_level")) == "Subnational" for i in interventions):
        weight -= 0.10
    return round(max(0.0, min(1.0, weight)), 3)


def _status_phrase(announced: date | None, implemented: date | None, removed: date | None,
                   in_force: bool, today: date) -> str:
    if removed and removed <= today:
        return f"Announced {_fmt_date(announced)}; removed {_fmt_date(removed)}."
    if implemented and implemented > today:
        return f"Announced {_fmt_date(announced)}; scheduled to take effect {_fmt_date(implemented)}."
    if implemented and in_force:
        return f"Announced {_fmt_date(announced)}; in force since {_fmt_date(implemented)}."
    if implemented:
        return f"Announced {_fmt_date(announced)}; implemented {_fmt_date(implemented)}."
    return f"Announced {_fmt_date(announced)}; implementation date not yet set."


# ── Transform: one state act -> one raw news item ────────────────────────────
def state_act_to_raw_item(interventions: list[dict[str, Any]], *, today: date | None = None) -> dict[str, Any] | None:
    """Render a state act (all its interventions) into the provider-neutral raw
    item shape services/news_ingest.py normalises. Pure — no I/O."""
    if not interventions:
        return None
    today = today or datetime.now(timezone.utc).date()
    first = interventions[0]

    title = _clean(first.get("state_act_title"))
    act_id = first.get("state_act_id")
    url = _clean(first.get("state_act_url")) or (
        f"https://www.globaltradealert.org/state-act/{act_id}" if act_id else ""
    )
    if not title or not url:
        return None

    published = _parse_date(first.get("date_published"))
    if published is None:
        return None
    published_at = datetime.combine(published, time.min, tzinfo=timezone.utc)

    implementers = _jurisdictions(interventions, "implementing_jurisdictions")
    affected = _jurisdictions(interventions, "affected_jurisdictions")
    impl_ids = {j.get("id") for j in implementers}
    india_affected = any(j.get("id") == INDIA_ID for j in affected)
    firm_specific = all(_clean(i.get("eligible_firm")) == "firm-specific" for i in interventions)

    announced = min((d for i in interventions if (d := _parse_date(i.get("date_announced")))), default=None)
    implemented = min((d for i in interventions if (d := _parse_date(i.get("date_implemented")))), default=None)
    removed_dates = [_parse_date(i.get("date_removed")) for i in interventions]
    # Only "removed" when EVERY intervention of the act has a removal date.
    # GTA also stores SCHEDULED expiries here, so a removal date can be in
    # the future — "expired" is only true once it has actually passed.
    removed = max(removed_dates) if removed_dates and all(removed_dates) else None
    expired = removed is not None and removed <= today
    in_force = any(i.get("is_in_force") in (1, True, "1") for i in interventions)

    types = list(dict.fromkeys(_clean(i.get("intervention_type")) for i in interventions if i.get("intervention_type")))
    evaluations = list(dict.fromkeys(_clean(i.get("gta_evaluation")) for i in interventions if i.get("gta_evaluation")))

    hs_counter: Counter[str] = Counter()
    cpc_counter: Counter[str] = Counter()
    product_codes: set[str] = set()
    for i in interventions:
        for p in i.get("affected_products") or []:
            code = _product_code(p)
            if code and code not in product_codes:
                product_codes.add(code)
                hs_counter[code[:2]] += 1
        for s in set(i.get("affected_sectors") or []):
            code = _sector_code(s)
            if code:
                cpc_counter[code[:2]] += 1
    top_chapters = [(c, n) for c, n in hs_counter.most_common(6) if c in HS_CHAPTERS]
    top_divisions = [c for c, _ in cpc_counter.most_common(6) if c in CPC_DIVISIONS]

    if firm_specific:
        category = "CORPORATE"
    elif product_codes and sum(n for c, n in hs_counter.items() if c in _COMMODITY_CHAPTERS) / len(product_codes) > 0.5:
        category = "COMMODITY"
    else:
        category = "POLICY"

    # ── Summary (feed card + symbol tagging + relevance heuristics) ─────────
    # Deliberately free of product/sector names: news_ingest tags NSE symbols
    # on title+summary, and a generic name like "Cotton" or "Glass" could
    # false-match a company alias and become a RED alert. Those details live
    # in the body, which the agents read but the tagger doesn't.
    impl_text = _implementer_text(implementers, interventions, 4) or "Unspecified jurisdiction"
    eval_text = "; ".join(f"GTA {e}: {EVALUATION_MEANING.get(e, e)}" for e in evaluations)
    summary_parts = [f"{impl_text} — {', '.join(types) or 'Trade measure'}"
                     + (f" ({eval_text})." if eval_text else ".")]
    summary_parts.append(_status_phrase(announced, implemented, removed, in_force, today))
    if affected:
        summary_parts.append(
            f"Affected trading partners: {len(affected)}" + (", including India." if india_affected else ".")
        )
    elif INDIA_ID not in impl_ids:
        summary_parts.append("No specific affected trading partners listed.")
    summary = " ".join(summary_parts)

    # ── Body (what the agents and the RAG index read) ───────────────────────
    lines = [
        f"Global Trade Alert record of a government trade-policy measure (state act {act_id}).",
        f"Implementing jurisdiction(s): {_implementer_text(implementers, interventions, 12) or 'not specified'}.",
    ]
    levels = sorted({_clean(i.get("implementation_level")) for i in interventions if i.get("implementation_level")})
    eligible = sorted({_clean(i.get("eligible_firm")) for i in interventions if i.get("eligible_firm")})
    if levels:
        lines.append(f"Implementation level: {', '.join(levels)}. Eligible firms: {', '.join(eligible) or 'not specified'}.")
    lines.append(
        f"Timeline: announced by the government on {_fmt_date(announced)}; "
        f"implemented {_fmt_date(implemented)}; "
        + (f"removed {_fmt_date(removed)}; " if expired
           else f"scheduled to lapse {_fmt_date(removed)}; " if removed
           else "not revoked; ")
        + f"currently in force: {'yes' if in_force else 'no'}. "
        f"GTA recorded it on {_fmt_date(published)} (the PUBLISHED date above) — "
        f"the announcement date is when the news actually broke."
    )
    lines.append("Measures:")
    for n, i in enumerate(interventions, 1):
        ev = _clean(i.get("gta_evaluation"))
        lines.append(
            f"{n}. {_clean(i.get('intervention_type')) or 'Unspecified measure'}"
            + (f" — GTA evaluation {ev} ({EVALUATION_MEANING.get(ev, ev)})" if ev else "")
            + (f"; MAST chapter: {_clean(i.get('mast_chapter')).rstrip('.')}" if i.get("mast_chapter") else "")
            + "."
        )
    if product_codes:
        chapters = "; ".join(f"{HS_CHAPTERS[c]} (HS {c}, {n} line{'s' if n != 1 else ''})" for c, n in top_chapters)
        noun = "product lines" if len(product_codes) != 1 else "product line"
        lines.append(f"Affected products: {len(product_codes)} HS {noun}, mainly {chapters or 'unclassified'}.")
    if top_divisions:
        lines.append("Affected sectors: " + "; ".join(f"{CPC_DIVISIONS[c]} (CPC {c})" for c in top_divisions) + ".")
    if affected:
        lines.append(
            f"Affected trading partners ({len(affected)}): {_name_list(affected, 15)}."
            + (" India is among them." if india_affected else " India is not listed among them.")
        )
    descriptions = [_clean(i.get("intervention_description")) for i in interventions if i.get("intervention_description")]
    if descriptions:
        lines.append("Description: " + " ".join(dict.fromkeys(descriptions)))
    body = "\n".join(lines)

    entities = [
        {
            "source": "GTA",
            "intervention_id": i.get("intervention_id"),
            "state_act_id": act_id,
            "intervention_type": _clean(i.get("intervention_type")) or None,
            "gta_evaluation": _clean(i.get("gta_evaluation")) or None,
            "mast_chapter": _clean(i.get("mast_chapter")) or None,
            "implementing": [j.get("iso") for j in (i.get("implementing_jurisdictions") or []) if isinstance(j, dict)],
            "affected_count": len(i.get("affected_jurisdictions") or []),
            "india_affected": any(
                isinstance(j, dict) and j.get("id") == INDIA_ID for j in (i.get("affected_jurisdictions") or [])
            ),
            "date_announced": i.get("date_announced"),
            "date_implemented": i.get("date_implemented"),
            "date_removed": i.get("date_removed"),
            "is_in_force": i.get("is_in_force"),
            "url": i.get("intervention_url"),
        }
        for i in interventions
    ]

    regions = list(dict.fromkeys(j.get("iso") for j in implementers if j.get("iso")))
    if len(regions) > 8:
        blocs = _implementer_text(implementers, interventions, 8)
        regions = [blocs.split(" (")[0]] if " member states)" in blocs else regions[:8]

    return {
        "url": url,
        "title": title,
        "summary": summary,
        "body": body,
        "image_url": None,
        "author": None,
        "published_at": published_at,
        "source_name": SOURCE_NAME,
        "source_slug": SOURCE_SLUG,
        "source_type": SOURCE_TYPE,
        "source_tier": SOURCE_TIER,
        "category": category,
        "regions": regions,
        "butterfly_weight": _butterfly_weight(interventions, implementers, india_affected, firm_specific, expired),
        # A curated government-policy database carries no celebrity/sports/
        # entertainment content, so news_ingest's noise-term filter (built for
        # general news) must not run on it — it zeroed a real US anti-dumping
        # measure on "van-type trailers" in testing ("trailer" is a noise term).
        "curated": True,
        "entities": entities,
    }


def group_by_state_act(records: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    groups: dict[Any, list[dict[str, Any]]] = defaultdict(list)
    for r in records:
        if isinstance(r, dict):
            # Fall back to the intervention id so an entry without a state act
            # still becomes its own item instead of merging with others.
            groups[r.get("state_act_id") or f"i{r.get('intervention_id')}"].append(r)
    return list(groups.values())


# ── Fetch ────────────────────────────────────────────────────────────────────
async def _fetch_one(client: httpx.AsyncClient, spec: QuerySpec, start: date) -> list[dict[str, Any]]:
    """Run one query for everything GTA published on/after ``start``. Never
    raises — a failed poll must not take down the ingestion cycle."""
    cap = max(1, min(settings.GTA_MAX_ENTRIES_PER_CYCLE, 1000))
    body = {
        "limit": cap,
        "offset": 0,
        # Oldest first: if the window holds more than `cap` entries, it's the
        # NEWEST that get cut — and since the next cycle's window starts from
        # the newest date actually stored, they are picked up then. Newest
        # first would instead cut the oldest, which no later window revisits.
        "sorting": "date_published",
        "request_data": {**spec.request_data, "submission_period": [start.isoformat(), None]},
    }
    headers = {"Authorization": f"APIKey {settings.GTA_API_KEY}", "Content-Type": "application/json"}

    try:
        resp = await client.post(_BASE_URL, json=body, headers=headers, timeout=_TIMEOUT)

        if resp.status_code == 429:
            # A per-key rolling 24h entry quota, not a burst limit — retrying
            # now can't succeed and would only spam the API. The next cycle
            # simply tries again.
            raise RuntimeError(f"GTA quota reached (1,000 entries/24h per key): {resp.text[:200]}")
        if resp.status_code in (401, 403):
            raise RuntimeError(f"GTA rejected the API key (HTTP {resp.status_code}): {resp.text[:200]}")
        resp.raise_for_status()

        payload = resp.json()
        if not isinstance(payload, list):
            # Errors come back as {"detail": "..."}; data is always a bare list.
            raise ValueError(f"unexpected GTA response: {str(payload)[:200]}")

        records = [r for r in payload if isinstance(r, dict)]
        if len(records) >= cap:
            # Drop the newest date's entries so a state act split across the
            # cap boundary is never stored half-complete — the next cycle's
            # window starts before that date and fetches it whole. Only when
            # older dates exist too, or a single huge day would never advance.
            last_day = records[-1].get("date_published")
            trimmed = [r for r in records if r.get("date_published") != last_day]
            if trimmed:
                records = trimmed
            logger.warning(
                "[news.gta] %s hit the per-cycle cap of %d entries — the remainder is fetched next cycle",
                spec.slug, cap,
            )

        items = [
            item for group in group_by_state_act(records)
            if (item := state_act_to_raw_item(group)) is not None
        ]
        _record(spec.slug, ok=True, count=len(items))
        logger.info(
            "[news.gta] %s — %d interventions -> %d state acts (published since %s)",
            spec.slug, len(records), len(items), start.isoformat(),
        )
        return items

    except Exception as exc:
        _record(spec.slug, ok=False, error=f"{type(exc).__name__}: {exc}")
        logger.warning("[news.gta] %s FAILED — %s: %s", spec.slug, type(exc).__name__, exc)
        return []


async def fetch_gta() -> list[dict[str, Any]]:
    """Fetch every registered query's new state acts as raw news items."""
    if not settings.GTA_API_KEY:
        logger.warning(
            "[news.gta] GTA_API_KEY is not set — idling without fetching anything "
            "until a key is configured in .env"
        )
        return []

    start = await _window_start(lookback_floor())

    async with httpx.AsyncClient() as client:
        batches = await asyncio.gather(*(_fetch_one(client, q, start) for q in QUERIES))

    items = [item for batch in batches for item in batch]
    logger.info("[news.gta] batch complete — %d raw items from %d queries", len(items), len(QUERIES))
    return items
