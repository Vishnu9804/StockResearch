"""
agents/company_profiler/schemas.py
Structured output contract for the Company Profiler's Extractor step. Every
list field here maps onto exactly one company_exposure_profiles jsonb column
— see agents/company_profiler/verifier.py for the routing — using the SAME
signed net_exposure convention as agents.shared.taxonomy.ExposureEntry, so
services/butterfly_scorer.py can read a profile built by this workflow with
zero special-casing.
"""
from pydantic import BaseModel, Field

from agents.shared.taxonomy import MECHANISM


class SegmentShare(BaseModel):
    """A descriptive-only business/cost segment share — NOT axis-matchable.
    Maps to revenue_mix / cost_mix, which exist for human-readable context,
    not for the scorer to join on."""
    label: str = Field(description="e.g. 'Consumer Electronics', 'Raw Materials'.")
    share: float = Field(ge=0, le=1)


class ExposureEntry(BaseModel):
    """One axis-matchable exposure fact. `net_exposure` is SIGNED: negative
    means the company is HURT when the factor rises (a net payer/consumer of
    it — e.g. an input commodity), positive means it's HELPED when the factor
    rises (a net earner/producer of it). Magnitude = how big the effect is,
    independent of sign."""
    axis: MECHANISM
    key: str = Field(description="PREFIX:IDENTIFIER, e.g. 'COMMODITY:NICKEL', 'RATE:INDIA'. "
                      "Allowed prefixes: COMMODITY, FX, RATE, REGION, REGULATORY, SECTOR, CUSTOMER, SUPPLIER.")
    net_exposure: float = Field(
        ge=-1, le=1,
        description="Signed effect per unit the factor moves. Negative = hurt when factor rises "
        "(net cost/consumption side). Positive = helped when factor rises (net revenue/production side)."
    )
    hedged_pct: float = Field(ge=0, le=1, default=0.0, description="Share of this exposure already hedged away.")
    rationale: str = Field(description="One sentence, ideally citing what you found via search.")


class FxExposureEntry(BaseModel):
    currency: str = Field(description="ISO currency code, e.g. 'USD'.")
    net_exposure: float = Field(ge=-1, le=1, description="Same signed convention as ExposureEntry.net_exposure.")
    rationale: str


class ProfileExtractionResult(BaseModel):
    revenue_segments: list[SegmentShare] = Field(default_factory=list, max_length=6)
    cost_segments: list[SegmentShare] = Field(default_factory=list, max_length=6)

    # Axis-matchable exposures, routed to their target column by the caller:
    input_commodity_exposures: list[ExposureEntry] = Field(
        default_factory=list, max_length=6,
        description="Things this company BUYS/consumes that move its costs (net_exposure typically negative).",
    )
    output_market_exposures: list[ExposureEntry] = Field(
        default_factory=list, max_length=6,
        description="Things this company SELLS or end-markets it depends on (net_exposure typically positive).",
    )
    geography_exposures: list[ExposureEntry] = Field(default_factory=list, max_length=6)
    fx_exposures: list[FxExposureEntry] = Field(default_factory=list, max_length=6)
    customer_concentration_exposures: list[ExposureEntry] = Field(default_factory=list, max_length=4)
    supplier_dependency_exposures: list[ExposureEntry] = Field(default_factory=list, max_length=4)
    regulatory_exposures: list[ExposureEntry] = Field(default_factory=list, max_length=4)
    substitution_exposures: list[ExposureEntry] = Field(
        default_factory=list, max_length=4,
        description="Where this company sits relative to a substitution risk — sign captures whether "
        "being substituted away from hurts (-) or a shift towards them helps (+).",
    )
    complement_exposures: list[ExposureEntry] = Field(default_factory=list, max_length=4)

    peers: list[str] = Field(default_factory=list, max_length=6, description="NSE symbols of close competitors.")

    rate_sensitivity: float = Field(ge=-1, le=1, description="Sensitivity to DOMESTIC (India) interest rates. "
                                     "Negative = hurt by rising rates (typically debt-heavy), positive = helped.")
    commodity_beta: float = Field(ge=0, le=1, description="Overall sensitivity to commodity price swings in general.")
    export_share: float = Field(ge=0, le=1, description="Share of revenue from exports.")
    import_share: float = Field(ge=0, le=1, description="Share of costs from imports.")

    confidence: float = Field(ge=0, le=1, description="Overall confidence in this profile, given the evidence found.")
    evidence: list[str] = Field(default_factory=list, max_length=8, description="URLs or named sources cited.")
