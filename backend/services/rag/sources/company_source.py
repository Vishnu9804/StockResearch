"""services/rag/sources/company_source.py
Two company corpora, from two tables that already exist:

  COMPANY_FUNDAMENTALS  from company_metrics — the numbers (valuation,
                        profitability, leverage, growth, ownership). Available
                        for all ~6700 listed symbols, synced from FinEdge by
                        services/metrics_sync.py.

  COMPANY_PROFILE       from company_exposure_profiles — the qualitative
                        causal surface (what the company buys, sells, where,
                        in which currency, who its peers are). Written by
                        agents/company_profiler/, the multi-agent workflow.

This module reads both tables and cares not at all HOW a row got there. That
matters right now: ENABLE_COMPANY_PROFILER_WORKER is currently false (left off
from earlier testing, back when profiler_agent's Gemini google_search step
needed billing that wasn't in place — it now runs on ZLM instead, see agents/
company_profiler/agents.py), so the three held symbols have hand-seeded rows
standing in for its output (model_version = 'MANUAL_SEED_v1'). Reading the
table rather than the workflow means turning the real workflow back on
requires no change here at all — the same rows appear, with a real
model_version, and get re-indexed automatically because their content hash
moves.

Fundamentals are deliberately rendered as ONE chunk per company rather than
split. A ratio is only interpretable next to the company it belongs to and the
ratios around it: "ROE 14.2%" retrieved on its own is noise, and "ROE 14.2%,
ROCE 16.1%, D/E 0.42, sector Private Sector Bank" is an answer.
"""
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from core.database import async_session_maker
from models.models import CompanyExposureProfile, CompanyMetric
from services.rag.schemas import RagSourceDocument, SourceType

logger = logging.getLogger("services.rag.sources.company")


def _number(value, suffix: str = "", decimals: int = 2) -> str | None:
    if value is None:
        return None
    try:
        return f"{float(value):,.{decimals}f}{suffix}"
    except (TypeError, ValueError):
        return None


def _line(label: str, value) -> str | None:
    if value is None:
        return None
    return f"- {label}: {value}"


def _crore(value) -> str | None:
    """FinEdge reports market cap in rupees. Indian market conversation is in
    crore, and a question asking "what is the market cap" expects that unit —
    keeping both means neither a crore-phrased nor a rupee-phrased question
    misses."""
    if value is None:
        return None
    try:
        rupees = float(value)
    except (TypeError, ValueError):
        return None
    return f"Rs {rupees / 1e7:,.0f} crore (Rs {rupees:,.0f})"


def render_fundamentals(metric: CompanyMetric) -> str:
    """A plain-language fact sheet. Written as labelled prose lines rather than
    a table because both halves of retrieval read text: a markdown table's pipe
    characters add nothing to an embedding and pollute the tsvector."""
    header = [
        f"{metric.name} ({metric.symbol}) — company fundamentals fact sheet.",
        f"Sector: {metric.sector or 'not classified'}. Industry: {metric.industry or 'not classified'}.",
        "",
        "Price and size:",
    ]
    price_lines = [
        _line("Current market price (CMP)", _number(metric.cmp, " INR")),
        _line("Change today", _number(metric.change_pct, "%")),
        _line("Market capitalisation", _crore(metric.market_cap)),
        _line("52-week high", _number(metric.high_52w, " INR")),
        _line("52-week low", _number(metric.low_52w, " INR")),
        _line("Traded volume", _number(metric.volume, "", 0)),
    ]

    valuation_lines = [
        _line("Price to earnings (P/E)", _number(metric.pe)),
        _line("Price to book (P/B)", _number(metric.pb)),
        _line("Earnings per share (EPS)", _number(metric.eps, " INR")),
        _line("Book value per share", _number(metric.book_value, " INR")),
        _line("Dividend yield", _number(metric.dividend_yield, "%")),
    ]

    profitability_lines = [
        _line("Return on equity (ROE)", _number(metric.roe, "%")),
        _line("Return on capital employed (ROCE)", _number(metric.roce, "%")),
        _line("Net profit margin", _number(metric.net_profit_margin, "%")),
        _line("EBITDA margin", _number(metric.ebitda_margin, "%")),
    ]

    balance_sheet_lines = [
        _line("Debt to equity", _number(metric.debt_to_equity)),
        _line("Current ratio", _number(metric.current_ratio)),
        _line("Interest coverage", _number(metric.interest_coverage)),
    ]

    growth_lines = [
        _line("Sales growth (3 year)", _number(metric.sales_growth_3y, "%")),
        _line("Profit growth (3 year)", _number(metric.profit_growth_3y, "%")),
    ]

    ownership_lines = [
        _line("Promoter holding", _number(metric.promoter_holding, "%")),
        _line("FII holding", _number(metric.fii_holding, "%")),
    ]

    sections = [
        ("", price_lines),
        ("Valuation:", valuation_lines),
        ("Profitability and returns:", profitability_lines),
        ("Balance sheet and solvency:", balance_sheet_lines),
        ("Growth:", growth_lines),
        ("Ownership:", ownership_lines),
    ]

    parts = list(header)
    for heading, lines in sections:
        present = [line for line in lines if line]
        if not present:
            continue
        if heading:
            parts.append("")
            parts.append(heading)
        parts.extend(present)

    as_of = metric.fundamentals_synced_at or metric.quote_synced_at
    if as_of:
        parts.append("")
        parts.append(f"Data as of {as_of.strftime('%d %b %Y %H:%M UTC')}, sourced from FinEdge.")

    return "\n".join(parts)


def _exposure_lines(entries: list, heading: str) -> list[str]:
    """Render the signed-exposure jsonb shape agents/company_profiler/ writes.

    The sign convention is spelled out in words on every line on purpose. The
    raw value is meaningless to a language model reading it cold — '-0.34'
    could be anything — whereas 'hurt when this rises' is directly usable in an
    answer and is what the number actually means (see
    agents/company_profiler/schemas.py:ExposureEntry)."""
    if not entries:
        return []
    lines = [heading]
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        key = entry.get("key") or entry.get("label") or entry.get("axis") or "unspecified"
        exposure = entry.get("net_exposure")
        direction = ""
        if isinstance(exposure, (int, float)):
            impact = "helped" if exposure > 0 else "hurt"
            direction = f" (the company is {impact} when this rises; magnitude {abs(exposure):.2f} on a 0-1 scale)"
        hedged = entry.get("hedged_pct")
        if isinstance(hedged, (int, float)) and hedged > 0:
            direction += f", about {hedged * 100:.0f}% of it already hedged"
        rationale = entry.get("rationale") or ""
        lines.append(f"- {key}{direction}. {rationale}".strip())
    return lines if len(lines) > 1 else []


def _share_lines(entries: list, heading: str) -> list[str]:
    if not entries:
        return []
    lines = [heading]
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        label = entry.get("label") or "unspecified"
        share = entry.get("share")
        if isinstance(share, (int, float)):
            lines.append(f"- {label}: about {share * 100:.0f}% of the total")
        else:
            lines.append(f"- {label}")
    return lines if len(lines) > 1 else []


def render_profile(profile: CompanyExposureProfile) -> str:
    parts = [
        f"{profile.company_name or profile.symbol} ({profile.symbol}) — business exposure profile: "
        "what this company actually spends on, what it sells, where, and what it is sensitive to.",
        f"Sector: {profile.sector or 'not classified'}. Industry: {profile.industry or 'not classified'}.",
    ]

    for lines in (
        _share_lines(profile.revenue_mix or [], "\nRevenue mix:"),
        _share_lines(profile.cost_mix or [], "\nCost mix:"),
        _exposure_lines(profile.input_commodities or [], "\nInput commodities the company buys:"),
        _exposure_lines(profile.output_markets or [], "\nEnd markets and outputs the company sells into:"),
        _exposure_lines(profile.geographies or [], "\nGeographic exposure:"),
        _exposure_lines(profile.customer_concentration or [], "\nCustomer concentration:"),
        _exposure_lines(profile.supplier_dependencies or [], "\nSupplier dependencies:"),
        _exposure_lines(profile.regulatory_exposure or [], "\nRegulatory exposure:"),
        _exposure_lines(profile.substitutes or [], "\nSubstitution risk:"),
        _exposure_lines(profile.complements or [], "\nComplementary demand:"),
    ):
        parts.extend(lines)

    fx = profile.fx_exposure or {}
    if isinstance(fx, dict) and fx:
        fx_lines = ["\nCurrency exposure:"]
        for currency, detail in fx.items():
            if isinstance(detail, dict):
                exposure = detail.get("net_exposure")
                rationale = detail.get("rationale", "")
                if isinstance(exposure, (int, float)):
                    impact = "helped" if exposure > 0 else "hurt"
                    fx_lines.append(f"- {currency}: {impact} when this currency strengthens "
                                    f"(magnitude {abs(exposure):.2f}). {rationale}".strip())
                    continue
            fx_lines.append(f"- {currency}: {detail}")
        if len(fx_lines) > 1:
            parts.extend(fx_lines)

    sensitivity = []
    if profile.rate_sensitivity is not None:
        value = float(profile.rate_sensitivity)
        impact = "helped" if value > 0 else "hurt"
        sensitivity.append(f"- Domestic interest rates: {impact} when Indian rates rise "
                           f"(magnitude {abs(value):.2f}).")
    if profile.commodity_beta is not None:
        sensitivity.append(f"- Overall sensitivity to commodity price swings: "
                           f"{float(profile.commodity_beta):.2f} on a 0-1 scale.")
    if profile.export_share is not None:
        sensitivity.append(f"- Share of revenue from exports: about {float(profile.export_share) * 100:.0f}%.")
    if profile.import_share is not None:
        sensitivity.append(f"- Share of costs from imports: about {float(profile.import_share) * 100:.0f}%.")
    if sensitivity:
        parts.append("\nMacro sensitivities:")
        parts.extend(sensitivity)

    peers = [p for p in (profile.peers or []) if isinstance(p, str)]
    if peers:
        parts.append(f"\nClose listed peers: {', '.join(peers)}.")

    if profile.confidence is not None:
        parts.append(
            f"\nConfidence in this profile: {float(profile.confidence):.2f} on a 0-1 scale "
            f"(profile version {profile.profile_version}, built {profile.updated_at.strftime('%d %b %Y')})."
        )

    return "\n".join(parts)


async def build_fundamentals_documents(symbols: list[str]) -> list[RagSourceDocument]:
    if not symbols:
        return []
    upper = [symbol.upper() for symbol in symbols]
    async with async_session_maker() as session:
        rows = (
            await session.execute(select(CompanyMetric).where(CompanyMetric.symbol.in_(upper)))
        ).scalars().all()

    documents: list[RagSourceDocument] = []
    for metric in rows:
        documents.append(
            RagSourceDocument(
                source_type=SourceType.COMPANY_FUNDAMENTALS,
                source_key=metric.symbol,
                title=f"{metric.name} — fundamentals",
                text=render_fundamentals(metric),
                symbol=metric.symbol,
                doc_date=metric.fundamentals_synced_at or metric.quote_synced_at or datetime.now(timezone.utc),
                metadata={"sector": metric.sector, "industry": metric.industry},
                # One chunk: a fact sheet is only meaningful whole. See the
                # module docstring.
                pre_chunked=None,
            )
        )
    return documents


async def build_profile_documents(symbols: list[str] | None = None) -> list[RagSourceDocument]:
    """Every exposure profile that exists, or just the named symbols.

    No symbol filter by default because this table is small (one row per
    company ever profiled) and every row in it is worth retrieving — unlike
    fundamentals, which exist for 6700 symbols and are indexed on demand.
    """
    async with async_session_maker() as session:
        statement = select(CompanyExposureProfile)
        if symbols:
            statement = statement.where(
                CompanyExposureProfile.symbol.in_([symbol.upper() for symbol in symbols])
            )
        rows = (await session.execute(statement)).scalars().all()

    return [
        RagSourceDocument(
            source_type=SourceType.COMPANY_PROFILE,
            source_key=profile.symbol,
            title=f"{profile.company_name or profile.symbol} — business exposure profile",
            text=render_profile(profile),
            symbol=profile.symbol,
            doc_date=profile.updated_at,
            metadata={
                "sector": profile.sector,
                "industry": profile.industry,
                "profileVersion": profile.profile_version,
                "modelVersion": profile.model_version,
            },
        )
        for profile in rows
    ]
