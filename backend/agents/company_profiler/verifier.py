"""
agents/company_profiler/verifier.py
Nothing from the Extractor step reaches company_exposure_profiles unless it
passes here. Two independent checks, both deterministic:

  1. Every axis-matchable exposure entry must validate against the shared
     closed taxonomy (agents/shared/taxonomy.py) — an entry that doesn't
     parse is dropped outright, because services/butterfly_scorer.py could
     never join on it anyway.
  2. Every peer must be a REAL, currently listed symbol in company_metrics —
     same rule as agents/butterfly/verifier.py applies to candidate companies.

Also routes each extracted field to the exact company_exposure_profiles
column it belongs in, and computes axis_keys — the flat index column
services/butterfly_scorer.py's first-pass SQL query overlaps against.
"""
from sqlalchemy import select

from agents.company_profiler.schemas import ExposureEntry, ProfileExtractionResult
from agents.shared.taxonomy import is_valid_axis_key
from core.database import async_session_maker
from models.models import CompanyMetric


def _clean_entries(entries: list[ExposureEntry]) -> list[dict]:
    cleaned = []
    for entry in entries:
        if not is_valid_axis_key(entry.axis, entry.key):
            continue
        cleaned.append({
            "axis": entry.axis,
            "key": entry.key,
            "net_exposure": entry.net_exposure,
            "hedged_pct": entry.hedged_pct,
            "rationale": entry.rationale,
        })
    return cleaned


async def verify_and_shape(symbol: str, extraction: ProfileExtractionResult) -> dict:
    input_commodities = _clean_entries(extraction.input_commodity_exposures)
    output_markets = _clean_entries(extraction.output_market_exposures)
    geographies = _clean_entries(extraction.geography_exposures)
    customer_concentration = _clean_entries(extraction.customer_concentration_exposures)
    supplier_dependencies = _clean_entries(extraction.supplier_dependency_exposures)
    regulatory_exposure = _clean_entries(extraction.regulatory_exposures)
    substitutes = _clean_entries(extraction.substitution_exposures)
    complements = _clean_entries(extraction.complement_exposures)

    fx_exposure: dict = {}
    fx_keys: list[str] = []
    for fx in extraction.fx_exposures:
        key = f"FX:{fx.currency.strip().upper()}"
        if not is_valid_axis_key("FX", key):
            continue
        fx_exposure[fx.currency.strip().upper()] = {
            "net_exposure": fx.net_exposure,
            "hedged_pct": 0.0,
            "rationale": fx.rationale,
        }
        fx_keys.append(key)

    axis_keys = sorted({
        *(e["key"] for e in (
            input_commodities + output_markets + geographies
            + customer_concentration + supplier_dependencies
            + regulatory_exposure + substitutes + complements
        )),
        *fx_keys,
    })

    verified_peers = await _verify_peers(symbol, extraction.peers)

    return {
        "revenue_mix": [s.model_dump() for s in extraction.revenue_segments],
        "cost_mix": [s.model_dump() for s in extraction.cost_segments],
        "input_commodities": input_commodities,
        "output_markets": output_markets,
        "geographies": geographies,
        "fx_exposure": fx_exposure,
        "customer_concentration": customer_concentration,
        "supplier_dependencies": supplier_dependencies,
        "regulatory_exposure": regulatory_exposure,
        "substitutes": substitutes,
        "complements": complements,
        "peers": verified_peers,
        "rate_sensitivity": extraction.rate_sensitivity,
        "commodity_beta": extraction.commodity_beta,
        "export_share": extraction.export_share,
        "import_share": extraction.import_share,
        "axis_keys": axis_keys,
        "evidence_refs": [{"source": e} for e in extraction.evidence],
        "confidence": extraction.confidence,
    }


async def _verify_peers(own_symbol: str, peer_symbols: list[str]) -> list[dict]:
    if not peer_symbols:
        return []
    symbols = [s.strip().upper() for s in peer_symbols if s.strip().upper() != own_symbol.upper()]
    if not symbols:
        return []

    async with async_session_maker() as session:
        rows = (
            await session.execute(select(CompanyMetric).where(CompanyMetric.symbol.in_(symbols)))
        ).scalars().all()

    return [{"symbol": row.symbol, "company_name": row.name} for row in rows]
