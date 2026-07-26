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

        for candidate in result.candidate_companies:
            match = by_symbol.get(candidate.symbol.strip().upper())
            if match is None:
                continue  # unverifiable — dropped, never stored with an invented price
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
