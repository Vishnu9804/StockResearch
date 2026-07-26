"""
agents/shared/llm.py
Single place every workflow under agents/ gets its Gemini models from. Bump
MODEL_CHEAP/MODEL_SMART here (or the .env-backed settings they read from) and
every agent in every workflow moves at once.

Model ids are read from core/config.py (GEMINI_MODEL_CHEAP/SMART) rather than
hardcoded here, so changing model generation is a config change, not a code
change. Verified live — not on Google's announced deprecation schedule — as
of July 2026:
  gemini-3.5-flash-lite   $0.30 / $2.50 per 1M tokens   extraction, yes/no gates
  gemini-3.6-flash        $1.50 / $7.50 per 1M tokens    reasoning, skepticism, search

The API key is wired in per-model via `client_kwargs` (passed straight through
to google.genai.Client) rather than exported into the process environment —
keeps GEMINI_API_KEY exactly where core/config.py already centralises every
other secret, instead of a second, implicit source of truth.
"""
from typing import Any

from google.adk.models import Gemini

from core.config import settings


def _client_kwargs() -> dict[str, Any]:
    return {"api_key": settings.GEMINI_API_KEY} if settings.GEMINI_API_KEY else {}


def cheap_model() -> Gemini:
    """Cheapest live Gemini tier — extraction and yes/no gates only, never judgment calls."""
    return Gemini(model=settings.GEMINI_MODEL_CHEAP, client_kwargs=_client_kwargs())


def smart_model() -> Gemini:
    """Cheapest strong-reasoning tier — reserved for steps that must weigh evidence."""
    return Gemini(model=settings.GEMINI_MODEL_SMART, client_kwargs=_client_kwargs())
