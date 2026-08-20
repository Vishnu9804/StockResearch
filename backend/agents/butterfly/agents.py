"""
agents/butterfly/agents.py
The six LlmAgents behind the Butterfly workflow. Built fresh per call (see
pipeline.py) rather than as module-level singletons — cheap, and avoids any
risk of hidden cross-run state on a shared agent instance.

  1. triage_agent              cheap  — is this real, and how significant
  2. causal_analyst_agent      smart  — world-level causal chains, no company names
  3. skeptic_agent              smart — tries to kill every chain
  4. thematic_trigger_agent     cheap  — is there a second, derived-demand story here
  5. researcher_agent           smart — verifies + finds real companies from pre-fetched search results
  6. thematic_extractor_agent   cheap  — turns researcher prose into structured JSON

Every step runs on ZLM (Zhipu AI / Z.ai's GLM models) — see agents/shared/
llm.py and core/config.py's provider-split comment. researcher_agent used to
be the one Gemini holdout (ADK's google_search tool is Gemini-only), but
that tool needed Google Cloud billing to actually work — see agents/shared/
zlm_web_search.py, which now does the retrieval as a plain REST call to
Z.ai's own web_search endpoint BEFORE this agent ever runs (agents/butterfly/
pipeline.py:_run_thematic_research). So researcher_agent is a plain ZLM
smart-tier agent like every other step here: no tool, just search results
already sitting in its prompt.

Every agent controls thinking via its model's own extra_body kwarg (see
cheap_model()/smart_model() in agents/shared/llm.py), so none of them pass
generate_content_config — that field is Gemini-SDK-typed and would do
nothing for a LiteLlm-backed model.
"""
from google.adk.agents import LlmAgent

from agents.butterfly import prompts
from agents.butterfly.schemas import (
    CausalAnalysisResult,
    SkepticResult,
    ThematicExtractorResult,
    ThematicTriggerResult,
    TriageResult,
)
from agents.shared.llm import cheap_model, smart_model


def triage_agent() -> LlmAgent:
    return LlmAgent(
        name="butterfly_triage",
        model=cheap_model(),
        instruction=prompts.TRIAGE_INSTRUCTION,
        output_schema=TriageResult,
    )


def causal_analyst_agent() -> LlmAgent:
    return LlmAgent(
        name="butterfly_causal_analyst",
        model=smart_model(),
        instruction=prompts.CAUSAL_ANALYST_INSTRUCTION,
        output_schema=CausalAnalysisResult,
    )


def skeptic_agent() -> LlmAgent:
    return LlmAgent(
        name="butterfly_skeptic",
        model=smart_model(),
        instruction=prompts.SKEPTIC_INSTRUCTION,
        output_schema=SkepticResult,
    )


def thematic_trigger_agent() -> LlmAgent:
    return LlmAgent(
        name="butterfly_thematic_trigger",
        model=cheap_model(),
        instruction=prompts.THEMATIC_TRIGGER_INSTRUCTION,
        output_schema=ThematicTriggerResult,
    )


def researcher_agent() -> LlmAgent:
    # structured=False: this agent has no output_schema — it returns free-text
    # analysis prose, not JSON (agents/shared/llm.py:smart_model) — forcing
    # json_object response-format mode onto it would be actively wrong.
    return LlmAgent(
        name="butterfly_researcher",
        model=smart_model(structured=False),
        instruction=prompts.RESEARCHER_INSTRUCTION,
    )


def thematic_extractor_agent() -> LlmAgent:
    return LlmAgent(
        name="butterfly_extractor",
        model=cheap_model(),
        instruction=prompts.EXTRACTOR_INSTRUCTION,
        output_schema=ThematicExtractorResult,
    )
