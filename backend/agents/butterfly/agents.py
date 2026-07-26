"""
agents/butterfly/agents.py
The six LlmAgents behind the Butterfly workflow. Built fresh per call (see
pipeline.py) rather than as module-level singletons — cheap, and avoids any
risk of hidden cross-run state on a shared agent instance.

  1. triage_agent              cheap  — is this real, and how significant
  2. causal_analyst_agent      smart  — world-level causal chains, no company names
  3. skeptic_agent              smart — tries to kill every chain
  4. thematic_trigger_agent     cheap  — is there a second, derived-demand story here
  5. researcher_agent           smart + google_search — verifies + finds real companies
  6. thematic_extractor_agent   cheap  — turns researcher prose into structured JSON

google_search cannot share an agent with other tools/output_schema in ADK, which is
exactly why the Researcher (step 5) and Extractor (step 6) are two separate agents
rather than one.
"""
from google.adk.agents import LlmAgent
from google.adk.tools import google_search

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
    return LlmAgent(
        name="butterfly_researcher",
        model=smart_model(),
        instruction=prompts.RESEARCHER_INSTRUCTION,
        tools=[google_search],
    )


def thematic_extractor_agent() -> LlmAgent:
    return LlmAgent(
        name="butterfly_extractor",
        model=cheap_model(),
        instruction=prompts.EXTRACTOR_INSTRUCTION,
        output_schema=ThematicExtractorResult,
    )
