"""
agents/company_profiler/agents.py
The two LlmAgents behind the Company Profiler workflow. Built fresh per call
(see pipeline.py), same reasoning as agents/butterfly/agents.py.

  1. profiler_agent    smart + google_search — researches one company's real
                        cost/revenue/FX/regulatory exposure
  2. extractor_agent   cheap — turns the Profiler's prose into the strict
                        ProfileExtractionResult schema

Two agents rather than one for the same reason as the Butterfly Researcher/
Extractor pair: google_search cannot share an agent with output_schema.
"""
from google.adk.agents import LlmAgent
from google.adk.tools import google_search

from agents.company_profiler import prompts
from agents.company_profiler.schemas import ProfileExtractionResult
from agents.shared.llm import cheap_model, smart_model


def profiler_agent() -> LlmAgent:
    return LlmAgent(
        name="company_profiler_researcher",
        model=smart_model(),
        instruction=prompts.PROFILER_INSTRUCTION,
        tools=[google_search],
    )


def extractor_agent() -> LlmAgent:
    return LlmAgent(
        name="company_profiler_extractor",
        model=cheap_model(),
        instruction=prompts.EXTRACTOR_INSTRUCTION,
        output_schema=ProfileExtractionResult,
    )
