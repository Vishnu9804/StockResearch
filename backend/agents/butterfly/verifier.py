"""
agents/butterfly/verifier.py
Nothing from the Researcher/Extractor step reaches news_thematic_research
unless it passes here. Two independent checks, both deterministic:

  1. Every candidate company must be a REAL, currently listed symbol in
     company_metrics — an unverifiable name is dropped outright, never stored
     with a guessed price (see the candidate_companies column comment).
  2. The thesis must not contain investment-advice language — this workflow
     describes mechanisms, it never recommends. A thesis that fails is
     dropped; the structured fields around it are kept regardless.
"""
import re

from sqlalchemy import select

from core.database import async_session_maker
from models.models import CompanyMetric
from agents.butterfly.schemas import ThematicExtractorResult

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


async def verify_thematic_result(result: ThematicExtractorResult) -> dict:
    verified_companies: list[dict] = []

    if result.candidate_companies:
        symbols = [c.symbol.strip().upper() for c in result.candidate_companies]
        async with async_session_maker() as session:
            rows = (
                await session.execute(
                    select(CompanyMetric).where(CompanyMetric.symbol.in_(symbols))
                )
            ).scalars().all()
        by_symbol = {row.symbol.upper(): row for row in rows}

        # Second chance, by NAME, for candidates whose ticker didn't resolve.
        # The research step reads company names out of web-search prose, where
        # the exchange TICKER usually isn't stated at all — so the model infers
        # one, and a plausible-but-wrong guess ("GFLUORO" for Gujarat
        # Fluorochemicals, listed as FLUOROCHEM) got the whole company thrown
        # away even though the company itself was real, listed, and correctly
        # identified. Matching the name against company_metrics recovers those
        # WITHOUT weakening the guarantee that matters: the row written to
        # news_thematic_research still carries the real listed company's own
        # symbol/name/price straight from company_metrics, never the model's
        # guess. A candidate that matches neither symbol nor name is still
        # dropped outright, exactly as before.
        unresolved = [c for c in result.candidate_companies if c.symbol.strip().upper() not in by_symbol]
        by_name: dict[str, CompanyMetric] = {}
        if unresolved:
            async with async_session_maker() as session:
                all_names = (
                    await session.execute(select(CompanyMetric.symbol, CompanyMetric.name))
                ).all()
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
        for candidate in result.candidate_companies:
            claimed = candidate.symbol.strip().upper()
            match = by_symbol.get(claimed) or by_name.get(claimed)
            if match is None:
                continue  # unverifiable — dropped, never stored with an invented price
            if match.symbol in seen:
                continue  # two candidate spellings resolved to the same listed company
            seen.add(match.symbol)
            verified_companies.append({
                "symbol": match.symbol,
                "company_name": match.name,
                "relevance_reasoning": candidate.relevance_reasoning,
                "current_price": float(match.cmp) if match.cmp is not None else None,
                "price_as_of": match.quote_synced_at.isoformat() if match.quote_synced_at else None,
                "verified": True,
            })

    thesis = result.thesis
    if thesis and _BANNED_PHRASES.search(thesis):
        thesis = None

    return {
        "candidate_companies": verified_companies,
        "thesis": thesis,
        "confidence": result.confidence,
        "novelty": result.novelty,
        "horizon": result.horizon,
        "evidence": [{"source": e} for e in result.evidence],
    }
