"""
agents/company_profiler/agents.py
The two LlmAgents behind the Company Profiler workflow. Built fresh per call
(see pipeline.py), same reasoning as agents/butterfly/agents.py.

  1. profiler_agent    cheap — researches one company's real cost/revenue/FX/
                        regulatory exposure from pre-fetched search results
  2. extractor_agent   cheap — turns the Profiler's prose into the strict
                        ProfileExtractionResult schema

Both run on ZLM (Zhipu AI / Z.ai's GLM models) — see agents/shared/llm.py and
core/config.py's provider-split comment. profiler_agent used to be the one
Gemini holdout here (ADK's google_search tool is Gemini-only), but that tool
needed Google Cloud billing to actually work — see agents/shared/
zlm_web_search.py, which now does the retrieval as a plain REST call to
Z.ai's own web_search endpoint BEFORE this agent ever runs (agents/
company_profiler/pipeline.py:build_profile). So profiler_agent is a plain ZLM
agent like extractor_agent: no tool, just search results already sitting in
its prompt — which is also why there's no longer a reason to keep them on
different tiers (the old split was to avoid competing with agents/butterfly/
for Gemini's shared daily quota; ZLM has no such per-workflow contention).
"""
from google.adk.agents import LlmAgent

from agents.company_profiler import prompts
from agents.company_profiler.schemas import ProfileExtractionResult
from agents.shared.llm import cheap_model


def profiler_agent() -> LlmAgent:
    # structured=False: this agent has no output_schema — it returns free-text
    # analysis prose, not JSON (agents/shared/llm.py:cheap_model) — forcing
    # json_object response-format mode onto it would be actively wrong.
    return LlmAgent(
        name="company_profiler_researcher",
        model=cheap_model(structured=False),
        instruction=prompts.PROFILER_INSTRUCTION,
    )


def extractor_agent() -> LlmAgent:
    return LlmAgent(
        name="company_profiler_extractor",
        model=cheap_model(),
        instruction=prompts.EXTRACTOR_INSTRUCTION,
        output_schema=ProfileExtractionResult,
    )
