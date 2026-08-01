"""
agents/butterfly/compiler.py
Turns the Causal Analyst's chains + the Skeptic's verdicts into the row
actually written to news_impact_analyses. Nothing here calls an LLM — this is
the deterministic gate between "what the model said" and "what the scorer is
allowed to treat as fact".

Two independent filters happen here:
  1. KILLed chains (and anything below MIN_SURVIVING_CONFIDENCE after
     weakening) are dropped from causal_chains entirely — though the full
     verdict list, including kills, is still kept in skeptic_verdict for audit
     (that column's whole purpose, per its own comment: "what was killed and
     why").
  2. Every surviving axis is re-validated against the closed taxonomy
     (agents/shared/taxonomy.py) — an axis that doesn't parse is dropped
     from exposure_axes even if the Skeptic kept it, because the scorer could
     never join on it anyway.
"""
from agents.butterfly.schemas import CausalAnalysisResult, DIRECTION_TO_INT, SkepticResult, TriageResult
from agents.shared.taxonomy import is_valid_axis_key

MIN_SURVIVING_CONFIDENCE = 0.15


def compile_analysis(
    triage: TriageResult,
    causal: CausalAnalysisResult,
    skeptic: SkepticResult,
) -> dict:
    verdict_by_chain = {v.chain_id: v for v in skeptic.verdicts}

    surviving_chains: list[dict] = []
    exposure_axes: list[dict] = []

    for chain in causal.chains:
        verdict = verdict_by_chain.get(chain.chain_id)
        if verdict is None or verdict.verdict == "KILL":
            continue
        if verdict.adjusted_confidence < MIN_SURVIVING_CONFIDENCE:
            continue
        if not is_valid_axis_key(chain.axis, chain.key):
            continue

        chain_dict = chain.model_dump()
        chain_dict["skeptic_verdict"] = verdict.verdict
        chain_dict["skeptic_reason"] = verdict.reason
        chain_dict["confidence"] = verdict.adjusted_confidence
        surviving_chains.append(chain_dict)

        exposure_axes.append({
            "axis": chain.axis,
            "key": chain.key,
            # exposure_axes feeds services/butterfly_scorer.py's sign arithmetic
            # directly, so this is the one place the LLM's string label
            # (schemas.DIRECTION_LABEL, forced by Gemini's string-only enum
            # support) converts back to the -1/0/1 the scorer expects.
            "direction": DIRECTION_TO_INT[chain.net_direction],
            "magnitude": chain.net_magnitude,
            "hops": len(chain.hops),
            "confidence": verdict.adjusted_confidence,
            "chain_id": chain.chain_id,
        })

    surviving_confidences = [c["confidence"] for c in surviving_chains]
    aggregate_confidence = (
        sum(surviving_confidences) / len(surviving_confidences) if surviving_confidences else 0.0
    )

    return {
        "event": {
            "summary": triage.event_summary,
            "primary_driver": triage.primary_driver,
            "event_type": triage.event_type,
            "affected_sectors": triage.affected_sectors,
        },
        "causal_chains": surviving_chains,
        "exposure_axes": exposure_axes,
        "market_significance": triage.significance,
        "confidence": aggregate_confidence,
        "novelty": triage.novelty,
        "horizon": triage.horizon,
        "skeptic_verdict": {"verdicts": [v.model_dump() for v in skeptic.verdicts]},
    }
