"""
agents/butterfly/verifier.py
Nothing from the Researcher/Extractor step reaches news_thematic_research
unless it passes here. Two independent checks, both deterministic:

  1. Every candidate company, in every sector, must be a REAL, currently
     listed symbol in company_metrics — an unverifiable name is dropped
     outright, never stored with a guessed price. A sector left with zero
     verified companies is dropped entirely — a sector heading with no real
     companies under it is worse than not showing that sector at all.
  2. The thesis must not contain investment-advice language — this workflow
     describes mechanisms, it never recommends. A thesis that fails is
     dropped; the structured fields around it are kept regardless.
"""
import re

from sqlalchemy import select

from core.database import async_session_maker
from models.models import CompanyMetric
from agents.butterfly.schemas import SectorCompany, ThematicExtractorResult

_BANNED_PHRASES = re.compile(
    r"\b(buy|sell|accumulate|target price|strong buy|book profit|"
    r"invest now|recommend(?:ed|ation)?|add to your portfolio|"
    r"upside potential of|price target)\b",
    re.IGNORECASE,
)


_NAME_NOISE = re.compile(
    r"\b(limited|ltd|private|pvt|corporation|corp|company|co|industries|"
    r"enterprises|holdings|india|the|and|of|inc)\b|[^a-z0-9 ]",
    re.IGNORECASE,
)


def _normalise_name(name: str) -> str:
    """'Gujarat Fluorochemicals Ltd.' -> 'gujarat fluorochemicals'. Strips the
    corporate-suffix noise that differs between how a research write-up names a
    company and how the exchange lists it, so the two can be compared."""
    return " ".join(_NAME_NOISE.sub(" ", name or "").lower().split())


async def _verify_companies(candidates: list[SectorCompany]) -> list[dict]:
    """Resolves a flat list of LLM-claimed companies against company_metrics,
    by symbol first and then by normalised name (see module docstring). Every
    dict returned carries the real listed company's own symbol/name/price —
    never the model's guess — and companies that resolve to neither are
    silently dropped."""
    if not candidates:
        return []

    symbols = [c.symbol.strip().upper() for c in candidates]
    async with async_session_maker() as session:
        rows = (
            await session.execute(select(CompanyMetric).where(CompanyMetric.symbol.in_(symbols)))
        ).scalars().all()
    by_symbol = {row.symbol.upper(): row for row in rows}

    # Second chance, by NAME, for candidates whose ticker didn't resolve.
    # The research step reads company names out of web-search prose, where
    # the exchange TICKER usually isn't stated at all — so the model infers
    # one, and a plausible-but-wrong guess ("GFLUORO" for Gujarat
    # Fluorochemicals, listed as FLUOROCHEM) got the whole company thrown
    # away even though the company itself was real, listed, and correctly
    # identified.
    unresolved = [c for c in candidates if c.symbol.strip().upper() not in by_symbol]
    by_name: dict[str, CompanyMetric] = {}
    if unresolved:
        async with async_session_maker() as session:
            all_names = (await session.execute(select(CompanyMetric.symbol, CompanyMetric.name))).all()
        lookup = {_normalise_name(name): symbol for symbol, name in all_names if name}
        wanted: dict[str, str] = {}
        for candidate in unresolved:
            key = _normalise_name(candidate.company_name)
            if key and key in lookup:
                wanted[candidate.symbol.strip().upper()] = lookup[key]
        if wanted:
            async with async_session_maker() as session:
                matched = (
                    await session.execute(
                        select(CompanyMetric).where(CompanyMetric.symbol.in_(list(wanted.values())))
                    )
                ).scalars().all()
            by_real_symbol = {row.symbol: row for row in matched}
            by_name = {
                claimed: by_real_symbol[real]
                for claimed, real in wanted.items()
                if real in by_real_symbol
            }

    seen: set[str] = set()
    verified: list[dict] = []
    for candidate in candidates:
        claimed = candidate.symbol.strip().upper()
        match = by_symbol.get(claimed) or by_name.get(claimed)
        if match is None:
            continue  # unverifiable — dropped, never stored with an invented price
        if match.symbol in seen:
            continue  # two candidate spellings resolved to the same listed company
        seen.add(match.symbol)
        verified.append({
            "symbol": match.symbol,
            "company_name": match.name,
            "relevance_reasoning": candidate.relevance_reasoning,
            "sector": match.sector,
            "industry": match.industry,
            "current_price": float(match.cmp) if match.cmp is not None else None,
            "price_as_of": match.quote_synced_at.isoformat() if match.quote_synced_at else None,
            "verified": True,
        })
    return verified


async def verify_thematic_result(result: ThematicExtractorResult) -> dict:
    verified_sectors: list[dict] = []

    for sector in result.sector_impacts:
        verified_companies = await _verify_companies(sector.companies)
        if not verified_companies:
            # A sector heading with no real, verifiable company under it is
            # worse than not showing that sector — drop it outright rather
            # than displaying an empty or hallucinated-looking group.
            continue
        verified_sectors.append({
            "sector": sector.sector,
            "impact": sector.impact,
            "mechanism": sector.mechanism,
            "companies": verified_companies,
        })

    thesis = result.thesis
    if thesis and _BANNED_PHRASES.search(thesis):
        thesis = None

    return {
        "sector_impacts": verified_sectors,
        "thesis": thesis,
        "confidence": result.confidence,
        "novelty": result.novelty,
        "horizon": result.horizon,
        "evidence": [{"source": e} for e in result.evidence],
    }
