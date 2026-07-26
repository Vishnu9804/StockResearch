"""
agents/shared/taxonomy.py
The closed vocabulary shared by every workflow that reasons about causal
exposure — today that's agents/butterfly (news -> world-level causal chains)
and agents/company_profiler (company -> real-world exposure profile). Both
sides of the join MUST speak this exact vocabulary, or services/
butterfly_scorer.py has nothing reliable to match on.

This file also owns the one shape every "this company is exposed to that
factor" fact takes, regardless of which jsonb column on
company_exposure_profiles it lives in — see ExposureEntry and
iter_profile_exposure_entries below. That shape is what lets the scorer
combine an O1 causal chain with a company profile using nothing but plain
Python arithmetic: no LLM call happens anywhere near a user's portfolio.
"""
import re
from typing import Literal, TypedDict

# ── Mechanisms ────────────────────────────────────────────────────────────────
# The "axis" field on a causal chain (agents/butterfly) AND on every exposure
# entry in a company profile (agents/company_profiler) — both drawn from this
# same closed set, so a match requires the mechanism to agree, not just the key.
MECHANISM_VALUES = (
    "INPUT_COST",
    "OUTPUT_PRICING",
    "DEMAND",
    "FX",
    "RATE",
    "REGULATORY",
    "SUBSTITUTION",
    "PRICING_POWER",
    "CAPEX",
    "LOGISTICS",
)
AXIS_TYPES = set(MECHANISM_VALUES)
MECHANISM = Literal[
    "INPUT_COST", "OUTPUT_PRICING", "DEMAND", "FX", "RATE",
    "REGULATORY", "SUBSTITUTION", "PRICING_POWER", "CAPEX", "LOGISTICS",
]

HORIZON_VALUES = ("IMMEDIATE", "DAYS", "WEEKS", "QUARTERS")
HORIZONS = set(HORIZON_VALUES)
HORIZON = Literal["IMMEDIATE", "DAYS", "WEEKS", "QUARTERS"]

# ── Keys ──────────────────────────────────────────────────────────────────────
# The "key" field is PREFIX:IDENTIFIER, e.g. "COMMODITY:NICKEL", "FX:USD".
KEY_PREFIXES = {
    "COMMODITY",
    "FX",
    "RATE",
    "REGION",
    "REGULATORY",
    "SECTOR",
    "CUSTOMER",
    "SUPPLIER",
}

# FX is the one prefix where a fixed enum is actually enumerable — everything
# else (COMMODITY, SECTOR, ...) has too many legitimate values to hardcode, so
# those are validated by shape (_IDENTIFIER_RE) instead.
ISO_CURRENCIES = {
    "USD", "EUR", "GBP", "JPY", "CNY", "INR", "AUD", "CAD", "CHF", "SGD",
    "AED", "SAR", "RUB", "BRL", "KRW", "HKD", "MYR", "IDR", "THB", "ZAR",
}

_IDENTIFIER_RE = re.compile(r"^[A-Z0-9_]{2,40}$")

SKEPTIC_VERDICTS = {"KEEP", "WEAKEN", "KILL"}
SKEPTIC_REASONS = {
    "VALID",
    "ALREADY_PRICED_IN",
    "TOO_GENERIC",
    "MAGNITUDE_TOO_SMALL",
    "HEDGED_AWAY",
    "SPECULATIVE_LEAP",
    "WRONG_DIRECTION",
}

THEMATIC_NEED_TYPES = {
    "RAW_MATERIAL",
    "CHEMICAL",
    "COMPONENT",
    "EQUIPMENT",
    "SERVICE",
    "INFRASTRUCTURE",
    "TECHNOLOGY",
    "LABOR",
    "LOGISTICS_CAPACITY",
    "NONE",
}


def is_valid_axis_key(axis: str, key: str) -> bool:
    """True only if `key` is a real, joinable PREFIX:IDENTIFIER pair under a
    known mechanism. An axis the compiler can't validate can never be matched
    against a company profile or sector fallback, so storing it would just be
    an exposure_axes entry nobody's severity math can ever use."""
    if axis not in AXIS_TYPES:
        return False
    if ":" not in key:
        return False
    prefix, _, identifier = key.partition(":")
    if prefix not in KEY_PREFIXES:
        return False
    if not _IDENTIFIER_RE.match(identifier):
        return False
    if prefix == "FX" and identifier not in ISO_CURRENCIES:
        return False
    return True


# ── Company exposure entries ─────────────────────────────────────────────────
# The company_exposure_profiles columns that hold lists of these entries
# (fx_exposure is a dict, normalised into the same shape by
# iter_profile_exposure_entries below — see its docstring).
EXPOSURE_LIST_COLUMNS = (
    "input_commodities",
    "output_markets",
    "geographies",
    "customer_concentration",
    "supplier_dependencies",
    "regulatory_exposure",
    "substitutes",
    "complements",
)


class ExposureEntry(TypedDict):
    axis: str
    key: str
    net_exposure: float  # signed, -1..1 — see effective_net_exposure()
    hedged_pct: float
    rationale: str


def clamp(value: float, low: float, high: float) -> float:
    return max(min(value, high), low)


def effective_net_exposure(entry: dict) -> float:
    """The entry's net_exposure after discounting for hedging.

    net_exposure is SIGNED: negative means the company is hurt when the
    factor's own value rises (it's a net payer/consumer of that factor —
    e.g. nickel as a cost input); positive means it's helped when the factor
    rises (a net earner/producer of it — e.g. nickel as something it sells).
    This one signed number is what lets a company-specific direction be
    computed from a factor-level direction with a single multiplication —
    see services/butterfly_scorer.py.
    """
    net = float(entry.get("net_exposure", 0.0) or 0.0)
    hedged = float(entry.get("hedged_pct", 0.0) or 0.0)
    return clamp(net * (1 - clamp(hedged, 0.0, 1.0)), -1.0, 1.0)


def _is_well_formed_entry(entry) -> bool:
    return (
        isinstance(entry, dict)
        and is_valid_axis_key(entry.get("axis", ""), entry.get("key", ""))
        and isinstance(entry.get("net_exposure"), (int, float))
    )


def iter_profile_exposure_entries(profile) -> list[dict]:
    """Every well-formed {axis, key, net_exposure, hedged_pct, rationale}
    entry across every exposure column on one company_exposure_profiles row,
    with fx_exposure's {"USD": {"net_exposure": -0.3, ...}} dict shape
    normalised into the same list-of-entries form as everywhere else.

    This is the ONE place that knows how a profile row is laid out —
    services/butterfly_scorer.py never reads a raw column directly, so the
    storage shape can evolve here without touching the scorer.
    """
    entries: list[dict] = []
    for column in EXPOSURE_LIST_COLUMNS:
        for entry in getattr(profile, column, None) or []:
            if _is_well_formed_entry(entry):
                entries.append(entry)

    for currency, fx in (profile.fx_exposure or {}).items():
        key = f"FX:{currency}"
        if isinstance(fx, dict) and is_valid_axis_key("FX", key) and isinstance(fx.get("net_exposure"), (int, float)):
            entries.append({
                "axis": "FX",
                "key": key,
                "net_exposure": fx["net_exposure"],
                "hedged_pct": fx.get("hedged_pct", 0.0),
                "rationale": fx.get("rationale", ""),
            })

    return entries


def find_best_matching_entry(entries: list[dict], axis: str, key: str) -> dict | None:
    """Among entries whose (axis, key) matches exactly, the one with the
    largest effective exposure — exact match on BOTH fields, not just the
    key, so a company's SUBSTITUTION relationship to nickel is never confused
    with an INPUT_COST one just because the key string is the same."""
    matches = [e for e in entries if e["axis"] == axis and e["key"] == key]
    if not matches:
        return None
    return max(matches, key=lambda e: abs(effective_net_exposure(e)))
