"""
agents/shared/llm.py
Single place every workflow under agents/ gets its Gemini models from. Bump
MODEL_CHEAP/MODEL_SMART here (or the .env-backed settings they read from) and
every agent in every workflow moves at once.

Model ids are read from core/config.py (GEMINI_MODEL_CHEAP/SMART) rather than
hardcoded here, so changing model generation is a config change, not a code
change. See core/config.py for why these are currently the Gemini 3.5/3.6
Flash family and for the thinking-level tradeoffs below.

The API key is wired in per-model via `client_kwargs` (passed straight through
to google.genai.Client) rather than exported into the process environment —
keeps GEMINI_API_KEY exactly where core/config.py already centralises every
other secret, instead of a second, implicit source of truth.
"""
from typing import Any

from google.adk.models import Gemini
from google.genai import types

from core.config import settings


def _client_kwargs() -> dict[str, Any]:
    return {"api_key": settings.GEMINI_API_KEY} if settings.GEMINI_API_KEY else {}


def cheap_model() -> Gemini:
    """Cheapest live Gemini tier — extraction and yes/no gates only, never judgment calls."""
    return Gemini(model=settings.GEMINI_MODEL_CHEAP, client_kwargs=_client_kwargs())


def smart_model() -> Gemini:
    """Cheapest strong-reasoning tier — reserved for steps that must weigh evidence."""
    return Gemini(model=settings.GEMINI_MODEL_SMART, client_kwargs=_client_kwargs())


def chat_model() -> Gemini:
    """The Research Chat answering tier (agents/research_chat/).

    Its own setting rather than cheap_model()/smart_model() because it is the
    only one of the three whose cost is driven by USER volume rather than by
    news volume — see core/config.py:GEMINI_MODEL_CHAT for the tradeoff.
    """
    return Gemini(model=settings.GEMINI_MODEL_CHAT, client_kwargs=_client_kwargs())


# ── Thinking config ──────────────────────────────────────────────────────────
# Every LlmAgent in every workflow passes one of these as its
# `generate_content_config` (see agents/butterfly/agents.py and agents/
# company_profiler/agents.py) instead of leaving thinking on its unbounded
# default — see core/config.py's THINKING_LEVEL_CHEAP/SMART comment for the
# full reasoning (cost predictability + avoiding the empty-response failure
# mode when an unbounded thinking pass eats the whole output-token budget).
#
# Built fresh per call, same reasoning as cheap_model()/smart_model() above —
# a shared mutable config object reused across agent instances is exactly the
# kind of hidden cross-run state this codebase avoids on principle.
def cheap_generation_config() -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level=settings.THINKING_LEVEL_CHEAP)
    )


def smart_generation_config() -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level=settings.THINKING_LEVEL_SMART)
    )


def chat_generation_config() -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level=settings.THINKING_LEVEL_CHAT)
    )
