"""
agents/butterfly/schemas.py
Structured output contracts for every LLM step in the Butterfly workflow.
Each schema is deliberately narrow — the model is never asked for prose it
doesn't need, and every numeric field the scorer depends on (magnitude,
confidence, direction) is a required field here, not optional prose the
compiler would have to re-interpret.

`direction` on a causal hop/chain describes the underlying FACTOR's own
movement (its price/value/demand going up or down) — never "good or bad for
some company", because at this point in the pipeline no company has been
identified yet. Whether a given factor movement helps or hurts a specific
held company depends on which side of that factor the company sits on (does
it pay for nickel, or sell it?) — that is resolved deterministically in
services/butterfly_scorer.py using agents.shared.taxonomy's signed
net_exposure convention, once a company_exposure_profiles row exists for it
(see agents/company_profiler/). Until then the scorer falls back to treating
the factor's own direction as a rough proxy, capped well below RED.
"""
from typing import Literal

from pydantic import BaseModel, Field

from agents.shared.taxonomy import HORIZON, MECHANISM

# Gemini's structured-output schema (the google.genai.types.Schema the ADK
# builds from a Pydantic model's `output_schema`) only accepts STRING enum
# members. A field typed `Literal[-1, 0, 1]` (ints) makes ADK's own schema
# object fail Pydantic validation with a cryptic "6 validation errors for
# Schema ... Input should be a valid string" the moment the agent is built —
# before any request ever reaches the network, and identically on every
# model/API key. Every directional field is therefore a string label at the
# LLM boundary, converted back to the -1/0/1 convention the rest of the
# codebase (compiler.py, services/butterfly_scorer.py) does arithmetic on via
# DIRECTION_TO_INT immediately after parsing.
DIRECTION_LABEL = Literal["UP", "FLAT", "DOWN"]
DIRECTION_TO_INT: dict[str, int] = {"UP": 1, "FLAT": 0, "DOWN": -1}


# ── 1. Triage ────────────────────────────────────────────────────────────────
class TriageResult(BaseModel):
    is_market_relevant: bool = Field(
        description="False for anything that is not a real economic/market event — "
        "celebrity news, sports, opinion pieces, listicles, etc."
    )
    significance: float = Field(ge=0, le=1, description="How much this matters at all, market-wide.")
    event_summary: str = Field(description="1-2 plain sentences: what actually happened, no opinion.")
    primary_driver: str = Field(description="Short phrase naming the root cause, e.g. 'OPEC+ supply cut'.")
    event_type: str = Field(description="Short free-text label, e.g. 'COMMODITY_SUPPLY_SHOCK'.")
    affected_sectors: list[str] = Field(
        default_factory=list,
        description="Broad, plain-English sector/industry names plausibly affected, e.g. "
        "['Metals & Mining', 'Automobile']. Empty list if nothing stands out — that is normal.",
    )
    novelty: float = Field(ge=0, le=1, description="1.0 = brand new information, 0.0 = already widely known/priced in.")
    horizon: HORIZON


# ── 2. Causal Analyst ─────────────────────────────────────────────────────────
class CausalHop(BaseModel):
    mechanism: MECHANISM
    description: str = Field(description="One sentence. Must never name a specific company or ticker.")
    direction: DIRECTION_LABEL = Field(
        description="The FACTOR's own movement: UP = rising/strengthening (price up, demand up, "
        "currency stronger), DOWN = falling/weakening, FLAT = unclear or roughly flat. This is NOT "
        "'good or bad for a company' — no company is known yet at this step."
    )
    magnitude: float = Field(ge=0, le=1, description="How big this single hop's effect is, on its own.")
    lag: HORIZON


class CausalChain(BaseModel):
    chain_id: str = Field(description="Short id local to this analysis, e.g. 'c1'.")
    axis: MECHANISM
    key: str = Field(description="PREFIX:IDENTIFIER, e.g. 'COMMODITY:NICKEL', 'FX:USD', 'RATE:INDIA'. "
                      "Allowed prefixes: COMMODITY, FX, RATE, REGION, REGULATORY, SECTOR, CUSTOMER, SUPPLIER.")
    hops: list[CausalHop] = Field(min_length=1, max_length=4)
    net_direction: DIRECTION_LABEL = Field(
        description="The overall FACTOR movement this chain describes (see CausalHop.direction) — "
        "still not 'good or bad for a company'."
    )
    net_magnitude: float = Field(ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
    rationale: str = Field(description="Why this chain holds, in one or two sentences. Still no company names.")


class CausalAnalysisResult(BaseModel):
    chains: list[CausalChain] = Field(default_factory=list, max_length=4)


# ── 3. Skeptic ────────────────────────────────────────────────────────────────
SKEPTIC_REASON = Literal[
    "VALID", "ALREADY_PRICED_IN", "TOO_GENERIC", "MAGNITUDE_TOO_SMALL",
    "HEDGED_AWAY", "SPECULATIVE_LEAP", "WRONG_DIRECTION",
]


class ChainVerdict(BaseModel):
    chain_id: str
    verdict: Literal["KEEP", "WEAKEN", "KILL"]
    reason: SKEPTIC_REASON
    adjusted_confidence: float = Field(
        ge=0, le=1, description="Confidence AFTER skepticism. Must be lower than the analyst's original for WEAKEN."
    )
    note: str = Field(description="One sentence explaining the verdict.")


class SkepticResult(BaseModel):
    verdicts: list[ChainVerdict] = Field(description="Exactly one verdict per chain_id received, no new chains.")


# ── 4. Thematic Trigger ───────────────────────────────────────────────────────
NEED_TYPE = Literal[
    "RAW_MATERIAL", "CHEMICAL", "COMPONENT", "EQUIPMENT", "SERVICE",
    "INFRASTRUCTURE", "TECHNOLOGY", "LABOR", "LOGISTICS_CAPACITY", "NONE",
]


class SectorHint(BaseModel):
    sector: str = Field(
        description="A SPECIFIC, plain-English sector/industry name that genuinely, "
        "non-obviously depends on the derived need — e.g. 'Pharmaceuticals (API "
        "manufacturers)' or 'Textiles (synthetic/polyester yarn)'. Never a generic "
        "catch-all like 'all sectors', 'the economy', or the event's own obvious subject."
    )
    reason: str = Field(
        description="One sentence naming the concrete, specific mechanism linking this "
        "sector to the derived need, e.g. 'uses petroleum-derived solvents and "
        "intermediates as a key raw material in API synthesis'."
    )


class ThematicTriggerResult(BaseModel):
    has_thematic_opportunity: bool = Field(
        description="True only if this event creates a NEW, non-obvious real-world demand or "
        "dependency that is NOT the story's own obvious subject. False is the normal, expected "
        "answer for almost all news — do not force a connection that isn't really there."
    )
    trigger_reasoning: str = Field(description="Why yes or no. Always filled in, even when False.")
    need_type: NEED_TYPE = "NONE"
    need_key: str | None = Field(default=None, description="PREFIX:IDENTIFIER, e.g. 'CHEMICAL:ISOBUTANE'.")
    need_description: str | None = None
    demand_direction: DIRECTION_LABEL = "FLAT"
    affected_sector_hints: list[SectorHint] = Field(
        default_factory=list, max_length=4,
        description="2-4 specific, non-obvious sectors that plausibly depend on this derived "
        "need, each genuinely distinct from the others. Leave empty only when "
        "has_thematic_opportunity is False.",
    )
    search_queries: list[str] = Field(
        default_factory=list, max_length=6,
        description="Concrete web search queries the researcher should run to verify this and "
        "find real companies — cover the underlying need itself AND each named sector hint, so "
        "the researcher has enough to find companies in every sector, not just one.",
    )


# ── 5/6. Researcher (free text, no schema) → Extractor ──────────────────────
SECTOR_IMPACT = Literal["POSITIVE", "NEGATIVE", "MIXED"]


class SectorCompany(BaseModel):
    symbol: str = Field(description="NSE trading symbol, e.g. 'RELIANCE'. Must be a real, currently listed company.")
    company_name: str
    relevance_reasoning: str = Field(
        description="Why this specific company, in this specific sector, sits on the derived need."
    )


class SectorImpact(BaseModel):
    sector: str = Field(
        description="Specific, plain-English sector/industry name — never a generic catch-all "
        "and never the event's own obvious subject sector."
    )
    impact: SECTOR_IMPACT = Field(
        description="Whether the derived need is, on balance, a headwind (NEGATIVE — e.g. higher "
        "input costs), a tailwind (POSITIVE — e.g. new demand for what these companies supply), or "
        "genuinely MIXED for companies in this sector. Descriptive of the mechanism only, never a "
        "recommendation."
    )
    mechanism: str = Field(
        description="One or two plain-language sentences on WHY this specific sector is exposed — "
        "the concrete, non-obvious linkage (e.g. 'uses X as a raw material'), never a generic "
        "'this affects everyone' statement."
    )
    companies: list[SectorCompany] = Field(
        min_length=1, max_length=4,
        description="Real, individually-verifiable companies genuinely engaged with this sector's "
        "exposure to the derived need. Prefer several (2-4) when the evidence genuinely supports "
        "that many — never pad with a weak or borderline company just to reach a count.",
    )


class ThematicExtractorResult(BaseModel):
    thesis: str = Field(
        description="A plain-language synthesis of the whole ripple mechanism, written for a "
        "reader with no finance background: what happened, what real-world chain of cause and "
        "effect follows from it, and which kinds of businesses sit on each side of that chain. "
        "Purely descriptive — never a buy/sell/hold recommendation, never a price target, never "
        "the words 'buy'/'sell'/'invest'. The reader should come away understanding which sectors "
        "face pressure and which face opportunity without ever being told what to do about it."
    )
    confidence: float = Field(ge=0, le=1)
    novelty: float = Field(ge=0, le=1)
    horizon: HORIZON
    sector_impacts: list[SectorImpact] = Field(
        default_factory=list, max_length=4,
        description="Up to 4 distinct, specific sectors, each with its own real companies. Empty "
        "list if the research didn't turn up anything verifiable — that is a normal, honest outcome.",
    )
    evidence: list[str] = Field(default_factory=list, description="URLs or named sources cited in the research.")
