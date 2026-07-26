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
    direction: Literal[-1, 0, 1] = Field(
        description="The FACTOR's own movement: +1 = rising/strengthening (price up, demand up, "
        "currency stronger), -1 = falling/weakening, 0 = unclear or roughly flat. This is NOT "
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
    net_direction: Literal[-1, 0, 1] = Field(
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
    demand_direction: Literal[-1, 0, 1] = 0
    search_queries: list[str] = Field(
        default_factory=list, max_length=4,
        description="Concrete web search queries the researcher should run to verify this and find real companies.",
    )


# ── 5/6. Researcher (free text, no schema) → Extractor ──────────────────────
class CandidateCompany(BaseModel):
    symbol: str = Field(description="NSE trading symbol, e.g. 'RELIANCE'. Must be a real, currently listed company.")
    company_name: str
    relevance_reasoning: str = Field(description="Why this specific company sits on the derived need.")


class ThematicExtractorResult(BaseModel):
    thesis: str = Field(description="Plain-language synthesis of the mechanism. Descriptive only — "
                         "never a buy/sell/hold recommendation or price target.")
    confidence: float = Field(ge=0, le=1)
    novelty: float = Field(ge=0, le=1)
    horizon: HORIZON
    candidate_companies: list[CandidateCompany] = Field(default_factory=list, max_length=8)
    evidence: list[str] = Field(default_factory=list, description="URLs or named sources cited in the research.")
