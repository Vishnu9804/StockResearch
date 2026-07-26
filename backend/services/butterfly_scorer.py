"""
services/butterfly_scorer.py
Workflow B: turns one already-written O1 analysis (news_impact_analyses) into
zero or more materialised alerts (user_news_alerts) — one deterministic pass,
NO LLM CALL, for every user who holds a potentially-relevant symbol. This is
what stops "the market is entirely connected" turning into every news item
being YELLOW for everyone: severity here is arithmetic (materiality x
attenuation x confidence x ...), not a second AI opinion, and it runs exactly
once per (user, symbol, news) — never once per user against the LLM.

Three tiers of "does this news even touch this symbol", in descending trust:

  VERIFIED  a company_exposure_profiles row exists for the symbol AND one of
            its exposure entries matches an O1 axis on BOTH mechanism and key
            (e.g. the company's own INPUT_COST:COMMODITY:NICKEL entry against
            the news's INPUT_COST:COMMODITY:NICKEL chain). This is the Phase 2
            (agents/company_profiler) payoff: the profile's signed
            net_exposure tells the scorer exactly how big the effect is and
            which way it cuts for THIS company — magnitude and direction both
            computed from real data, not guessed. Can legitimately reach RED.
  NAMED     the article names the symbol outright (news_items.mentioned_symbols)
            but no profile match was found. Still strong evidence (materiality
            1.0), but direction falls back to the raw factor movement as an
            approximation, since we don't know which side of it this company
            sits on. Can still reach RED — being named is a strong signal on
            its own — but only from real magnitude/confidence, not a fixed
            override.
  SECTOR    the symbol's sector/industry loosely matches the triage step's
            affected_sectors. This tier is a GUESS and is hard-capped at
            YELLOW below — it must never produce a RED or ORANGE alert alone.

Until company_exposure_profiles is populated (see agents/company_profiler/),
VERIFIED simply never fires — that is correct behaviour, not a bug: the
scorer degrades to NAMED/SECTOR only, exactly as documented on those tiers.

Called once per analysed news item from agents/butterfly/pipeline.py, right
after the O1 row commits. Every function below is plain Python/SQL — there is
no agents.* import in this file, on purpose.
"""
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from agents.shared.taxonomy import effective_net_exposure, find_best_matching_entry, iter_profile_exposure_entries
from core.config import settings
from core.database import async_session_maker
from models.models import (
    CompanyExposureProfile,
    CompanyMetric,
    NewsItem,
    Portfolio,
    PortfolioHolding,
    UserNewsAlert,
)

logger = logging.getLogger("services.butterfly_scorer")

# ── Tunables ──────────────────────────────────────────────────────────────
# Calibrated so that under the STRONGEST plausible inputs (magnitude,
# confidence, significance all near 1.0, a large position), each tier's
# ceiling lands where its trust level implies:
#   VERIFIED/NAMED can reach RED.
#   SECTOR can reach just past ORANGE pre-cap — high enough that the explicit
#   YELLOW cap below is doing real work, not guarding against a score it could
#   never produce in the first place.
ATTENUATION_BASE = 0.55  # per extra reasoning hop beyond the first
SOURCE_TIER_WEIGHT = {1: 1.0, 2: 0.85, 3: 0.7}
SECTOR_FALLBACK_DISCOUNT = 0.5  # SECTOR tier materiality multiplier
SECTOR_FALLBACK_DIRECTNESS = 0.6
VERIFIED_DIRECTNESS = 1.0
NAMED_DIRECTNESS = 1.0

_SEVERITY_RANK = {"YELLOW": 0, "ORANGE": 1, "RED": 2}


async def score_analysis_for_users(news: NewsItem, analysis_id, compiled: dict) -> None:
    exposure_axes = compiled["exposure_axes"]
    affected_sectors = compiled["event"].get("affected_sectors") or []

    candidates = await _find_candidate_symbols(news.mentioned_symbols, exposure_axes, affected_sectors)
    if not candidates:
        return

    holdings_by_user = await _holdings_for_symbols(list(candidates.keys()))
    if not holdings_by_user:
        return

    portfolio_values = await _portfolio_values(list(holdings_by_user.keys()))

    rows_by_user: dict = {}
    for user_id, symbol_holdings in holdings_by_user.items():
        total_value = portfolio_values.get(user_id, Decimal(0))
        for symbol, holding in symbol_holdings.items():
            row = _score_one(
                news=news,
                compiled=compiled,
                symbol=symbol,
                candidate=candidates[symbol],
                holding=holding,
                total_portfolio_value=total_value,
            )
            if row is not None:
                rows_by_user.setdefault(user_id, []).append(row)

    if not rows_by_user:
        return

    async with async_session_maker() as session:
        for user_id, rows in rows_by_user.items():
            rows = _apply_flood_cap(rows)
            rows = await _apply_daily_red_cap(session, user_id, rows)
            for row in rows:
                await _upsert_alert(session, user_id, news, analysis_id, row)
        await session.commit()


# ── Candidate discovery ──────────────────────────────────────────────────────
async def _find_candidate_symbols(mentioned_symbols, exposure_axes, affected_sectors) -> dict:
    """{symbol: {"is_named": bool, "profile": CompanyExposureProfile | None,
    "is_sector_fallback": bool}} — one entry per symbol worth scoring."""
    axis_keys = [a["key"] for a in exposure_axes]
    named = set(mentioned_symbols or [])

    candidates: dict = {symbol: {"is_named": True, "profile": None, "is_sector_fallback": False} for symbol in named}

    if axis_keys or named:
        conditions = []
        if axis_keys:
            # Coarse, index-friendly first pass on key alone — the precise
            # (axis, key) match happens in Python once the full row is loaded.
            conditions.append(CompanyExposureProfile.axis_keys.overlap(axis_keys))
        if named:
            conditions.append(CompanyExposureProfile.symbol.in_(named))
        async with async_session_maker() as session:
            profiles = (
                await session.execute(select(CompanyExposureProfile).where(or_(*conditions)))
            ).scalars().all()
        for profile in profiles:
            if profile.symbol in candidates:
                candidates[profile.symbol]["profile"] = profile
            else:
                candidates[profile.symbol] = {"is_named": False, "profile": profile, "is_sector_fallback": False}

    if affected_sectors:
        patterns = [f"%{sector}%" for sector in affected_sectors]
        conditions = []
        for pattern in patterns:
            conditions.append(CompanyMetric.sector.ilike(pattern))
            conditions.append(CompanyMetric.industry.ilike(pattern))
        async with async_session_maker() as session:
            symbols = (
                await session.execute(select(CompanyMetric.symbol).where(or_(*conditions)))
            ).scalars().all()
        for symbol in symbols:
            if symbol not in candidates:
                candidates[symbol] = {"is_named": False, "profile": None, "is_sector_fallback": True}

    return candidates


# ── Holdings + portfolio value lookups ───────────────────────────────────────
async def _holdings_for_symbols(symbols: list[str]) -> dict:
    """{user_id: {symbol: {quantity, price, portfolio_id, company_name}}} —
    quantity summed across every portfolio a user holds that symbol in, since
    user_news_alerts is unique per (user, news, symbol), not per portfolio."""
    async with async_session_maker() as session:
        rows = (
            await session.execute(
                select(
                    Portfolio.user_id,
                    PortfolioHolding.symbol,
                    PortfolioHolding.quantity,
                    PortfolioHolding.avg_buy_price,
                    PortfolioHolding.portfolio_id,
                    PortfolioHolding.company_name,
                    CompanyMetric.cmp,
                )
                .join(Portfolio, Portfolio.id == PortfolioHolding.portfolio_id)
                .outerjoin(CompanyMetric, CompanyMetric.symbol == PortfolioHolding.symbol)
                .where(PortfolioHolding.symbol.in_(symbols))
            )
        ).all()

    result: dict = {}
    for user_id, symbol, quantity, avg_buy_price, portfolio_id, company_name, cmp in rows:
        price = float(cmp) if cmp is not None else float(avg_buy_price or 0)
        row_value = float(quantity) * price
        bucket = result.setdefault(user_id, {})
        if symbol not in bucket:
            bucket[symbol] = {
                "quantity": float(quantity),
                "price": price,
                "portfolio_id": portfolio_id,
                "company_name": company_name,
                "_rep_value": row_value,
            }
        else:
            entry = bucket[symbol]
            entry["quantity"] += float(quantity)
            if row_value > entry["_rep_value"]:
                entry["portfolio_id"] = portfolio_id
                entry["_rep_value"] = row_value
    return result


async def _portfolio_values(user_ids: list) -> dict:
    async with async_session_maker() as session:
        rows = (
            await session.execute(
                select(
                    Portfolio.user_id,
                    func.sum(
                        PortfolioHolding.quantity
                        * func.coalesce(CompanyMetric.cmp, PortfolioHolding.avg_buy_price)
                    ),
                )
                .join(PortfolioHolding, PortfolioHolding.portfolio_id == Portfolio.id)
                .outerjoin(CompanyMetric, CompanyMetric.symbol == PortfolioHolding.symbol)
                .where(Portfolio.user_id.in_(user_ids))
                .group_by(Portfolio.user_id)
            )
        ).all()
    return {user_id: (total or Decimal(0)) for user_id, total in rows}


# ── Scoring ───────────────────────────────────────────────────────────────────
def _strongest_axis(axes: list[dict]) -> dict | None:
    if not axes:
        return None
    return max(axes, key=lambda a: a["magnitude"] * a["confidence"])


def _best_verified_match(entries: list[dict], exposure_axes: list[dict]) -> tuple[dict, dict] | None:
    """The (axis, profile_entry) pair with the strongest combined evidence —
    weighted by how confident/large the news claim is AND how exposed the
    company's own profile says it is. None if no axis+key pair matches."""
    best: tuple[dict, dict] | None = None
    best_weight = -1.0
    for axis in exposure_axes:
        entry = find_best_matching_entry(entries, axis["axis"], axis["key"])
        if entry is None:
            continue
        weight = abs(effective_net_exposure(entry)) * axis["confidence"] * axis["magnitude"]
        if weight > best_weight:
            best_weight = weight
            best = (axis, entry)
    return best


def _severity_for_score(score: float) -> str | None:
    if score >= settings.BUTTERFLY_RED_THRESHOLD:
        return "RED"
    if score >= settings.BUTTERFLY_ORANGE_THRESHOLD:
        return "ORANGE"
    if score >= settings.BUTTERFLY_YELLOW_THRESHOLD:
        return "YELLOW"
    return None


def _build_explanation(compiled: dict, axis: dict | None, tier: str) -> str:
    summary = compiled["event"].get("summary", "")
    if axis is None:
        return summary
    axis_label = axis["axis"].replace("_", " ").lower()
    if tier == "VERIFIED":
        return f"{summary} Your holding has a confirmed {axis_label} exposure to {axis['key']}."
    if tier == "NAMED":
        return f"{summary} This article names your holding directly."
    return f"{summary} Your holding's sector may have a {axis_label} exposure to {axis['key']} (approximate match)."


def _score_one(news: NewsItem, compiled: dict, symbol: str, candidate: dict, holding: dict, total_portfolio_value) -> dict | None:
    exposure_axes = compiled["exposure_axes"]
    profile = candidate.get("profile")
    entries = iter_profile_exposure_entries(profile) if profile is not None else []
    verified_match = _best_verified_match(entries, exposure_axes) if entries else None

    if verified_match is not None:
        axis, entry = verified_match
        net = effective_net_exposure(entry)
        tier = "VERIFIED"
        materiality = abs(net)
        direction = (1 if net > 0 else -1 if net < 0 else 0) * axis["direction"]
        directness = VERIFIED_DIRECTNESS
        hops = max(axis["hops"], 1)
        axis_confidence = axis["confidence"]
    elif candidate.get("is_named"):
        axis = _strongest_axis(exposure_axes)
        tier = "NAMED"
        materiality = 1.0
        direction = axis["direction"] if axis else 0
        directness = NAMED_DIRECTNESS
        # Being named doesn't erase the causal chain's own reasoning depth —
        # directness and hop-attenuation are independent discounts.
        hops = axis["hops"] if axis else 1
        axis_confidence = axis["confidence"] if axis else compiled["confidence"]
    elif candidate.get("is_sector_fallback"):
        axis = _strongest_axis(exposure_axes)
        tier = "SECTOR"
        materiality = (axis["magnitude"] if axis else 0.5) * SECTOR_FALLBACK_DISCOUNT
        direction = axis["direction"] if axis else 0
        directness = SECTOR_FALLBACK_DIRECTNESS
        # No extra hop penalty on top — SECTOR_FALLBACK_DISCOUNT and
        # SECTOR_FALLBACK_DIRECTNESS already price in "this is a coarse
        # categorical guess"; stacking a hop penalty on top of that would
        # double-discount the same uncertainty and make this tier structurally
        # unable to ever clear even YELLOW, defeating the point of having it.
        hops = axis["hops"] if axis else 1
        axis_confidence = axis["confidence"] if axis else compiled["confidence"]
    else:
        # A profile existed (coarse key overlap) but no (axis, key) pair
        # actually matched, and the symbol is neither named nor sector-linked.
        # No real basis for an alert — skip rather than guess.
        return None

    attenuation = ATTENUATION_BASE ** max(hops - 1, 0)
    confidence_term = axis_confidence * SOURCE_TIER_WEIGHT.get(news.source_tier, 0.7)
    # Discount for STALENESS, not for freshness: novelty=1.0 (brand new) must
    # apply NO discount; novelty=0.0 (already priced in) applies the full
    # discount. `1 - novelty` is how stale it is, so that's what scales down.
    novelty = compiled["novelty"] if compiled["novelty"] is not None else 0.5
    novelty_term = 1 - (1 - novelty) * 0.3
    significance_term = compiled["market_significance"] or 0.5

    exposure_value = holding["quantity"] * holding["price"]
    exposure_pct = (exposure_value / float(total_portfolio_value)) if total_portfolio_value else 0.0
    position_weight = min(max(0.5 + exposure_pct * 2, 0.5), 1.5)

    score = (
        materiality * attenuation * directness
        * confidence_term * novelty_term * significance_term * position_weight
    )
    score = min(max(score, 0.0), 1.0)

    severity = _severity_for_score(score)
    if severity is None:
        return None
    if tier == "SECTOR" and _SEVERITY_RANK[severity] > _SEVERITY_RANK["YELLOW"]:
        severity = "YELLOW"  # hard cap: a sector guess never earns RED/ORANGE on its own

    chain_id = axis.get("chain_id") if axis else None

    return {
        "symbol": symbol,
        "company_name": holding.get("company_name"),
        "portfolio_id": holding.get("portfolio_id"),
        "severity": severity,
        "score": round(score, 4),
        "direction": direction,
        "score_components": {
            "tier": tier,
            "materiality": round(materiality, 4),
            "attenuation": round(attenuation, 4),
            "directness": directness,
            "confidence_term": round(confidence_term, 4),
            "novelty_term": round(novelty_term, 4),
            "significance_term": round(significance_term, 4),
            "position_weight": round(position_weight, 4),
        },
        "chain": [a for a in exposure_axes if chain_id and a.get("chain_id") == chain_id],
        "explanation": _build_explanation(compiled, axis, tier),
        "hops": hops,
        "exposure_value": exposure_value,
        "exposure_pct": exposure_pct,
    }


# ── Flood control ────────────────────────────────────────────────────────────
def _apply_flood_cap(rows: list[dict]) -> list[dict]:
    rows = sorted(rows, key=lambda r: r["score"], reverse=True)[: settings.BUTTERFLY_MAX_ALERTS_PER_NEWS_PER_USER]
    seen_red = False
    for row in rows:
        if row["severity"] == "RED":
            if seen_red:
                row["severity"] = "ORANGE"
            else:
                seen_red = True
    return rows


async def _apply_daily_red_cap(session, user_id, rows: list[dict]) -> list[dict]:
    red_rows = [r for r in rows if r["severity"] == "RED"]
    if not red_rows:
        return rows

    since = datetime.now(timezone.utc) - timedelta(days=1)
    count = (
        await session.execute(
            select(func.count()).select_from(UserNewsAlert).where(
                UserNewsAlert.user_id == user_id,
                UserNewsAlert.severity == "RED",
                UserNewsAlert.created_at >= since,
            )
        )
    ).scalar_one()

    remaining = max(settings.BUTTERFLY_MAX_RED_PER_USER_PER_DAY - count, 0)
    for row in red_rows[remaining:]:
        row["severity"] = "ORANGE"
    return rows


async def _upsert_alert(session, user_id, news: NewsItem, analysis_id, row: dict) -> None:
    values = dict(
        user_id=user_id,
        portfolio_id=row.get("portfolio_id"),
        news_id=news.id,
        analysis_id=analysis_id,
        symbol=row["symbol"],
        company_name=row.get("company_name"),
        severity=row["severity"],
        score=row["score"],
        direction=row["direction"],
        score_components=row["score_components"],
        chain=row["chain"],
        explanation=row["explanation"],
        hops=row["hops"],
        exposure_value=row["exposure_value"],
        exposure_pct=row["exposure_pct"],
    )
    stmt = pg_insert(UserNewsAlert).values(**values)
    update_cols = {k: stmt.excluded[k] for k in values if k not in ("user_id", "news_id", "symbol")}
    stmt = stmt.on_conflict_do_update(
        index_elements=["user_id", "news_id", "symbol"],
        set_=update_cols,
    )
    await session.execute(stmt)
