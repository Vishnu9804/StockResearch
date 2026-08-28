"""
services/ai_summary/agents.py
The two LlmAgents behind the AI Summary pipeline — both ZLM, same pattern as
every other agents/* workflow in this codebase (agents/shared/llm.py). Built
fresh per call, same reasoning as agents/company_profiler/agents.py: an
LlmAgent is cheap to construct and this avoids any chance of state leaking
between one document/company's call and the next.

  1. fact_extractor_agent   cheap tier — extraction only, never judgment.
                             Runs once per document.
  2. summarizer_agent       smart tier — the one step that actually has to
                             weigh and phrase things, so it gets the stronger
                             model and thinking mode on.
"""
from google.adk.agents import LlmAgent

from services.ai_summary import prompts
from services.ai_summary.schemas import DocumentFacts, QuarterSummaryResult
from agents.shared.llm import cheap_model, smart_model


def fact_extractor_agent() -> LlmAgent:
    return LlmAgent(
        name="ai_summary_fact_extractor",
        model=cheap_model(),
        instruction=prompts.FACT_EXTRACTOR_INSTRUCTION,
        output_schema=DocumentFacts,
    )


def summarizer_agent() -> LlmAgent:
    return LlmAgent(
        name="ai_summary_summarizer",
        model=smart_model(),
        instruction=prompts.SUMMARIZER_INSTRUCTION,
        output_schema=QuarterSummaryResult,
    )
