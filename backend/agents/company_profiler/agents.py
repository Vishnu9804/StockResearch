"""
agents/company_profiler/agents.py
The two LlmAgents behind the Company Profiler workflow. Built fresh per call
(see pipeline.py), same reasoning as agents/butterfly/agents.py.

  1. profiler_agent    cheap + google_search — researches one company's real
                        cost/revenue/FX/regulatory exposure
  2. extractor_agent   cheap — turns the Profiler's prose into the strict
                        ProfileExtractionResult schema

Both agents deliberately run on the CHEAP model (gemini-3.5-flash-lite, 500
RPD on this project) rather than the smart tier. This workflow used to use
smart for profiler_agent, but that put it in direct competition with agents/
butterfly/ for the same 20-RPD smart-model budget — and butterfly (continuous,
per-news-item, portfolio-facing) is the higher priority of the two while on a
free-tier key. Company profiles are a slower-moving, quarterly-refresh
enhancement (see worker.py), so a cheaper/weaker model here is a reasonable
trade: worse research depth per profile, but it stops silently starving
butterfly of the smart-model quota it actually needs today. Revisit once
billing removes the RPD ceiling entirely — see core/config.py.

Two agents rather than one for the same reason as the Butterfly Researcher/
Extractor pair: google_search cannot share an agent with output_schema.
"""
from google.adk.agents import LlmAgent
from google.adk.tools import google_search

from agents.company_profiler import prompts
from agents.company_profiler.schemas import ProfileExtractionResult
from agents.shared.llm import cheap_generation_config, cheap_model


def profiler_agent() -> LlmAgent:
    return LlmAgent(
        name="company_profiler_researcher",
        model=cheap_model(),
        instruction=prompts.PROFILER_INSTRUCTION,
        tools=[google_search],
        generate_content_config=cheap_generation_config(),
    )


def extractor_agent() -> LlmAgent:
    return LlmAgent(
        name="company_profiler_extractor",
        model=cheap_model(),
        instruction=prompts.EXTRACTOR_INSTRUCTION,
        output_schema=ProfileExtractionResult,
        generate_content_config=cheap_generation_config(),
    )
