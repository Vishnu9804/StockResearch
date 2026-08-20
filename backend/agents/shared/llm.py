"""
agents/shared/llm.py
Single place every workflow under agents/ gets its models from. Every model
here is ZLM (Zhipu AI / Z.ai, GLM models), routed through ADK's LiteLlm
wrapper — see core/config.py's "Multi-agent workflows" comment for the full
reasoning. Gemini has no role left in this codebase: the only reason it was
ever kept was ADK's google_search tool being Gemini-only, and that tool has
been replaced everywhere by agents/shared/zlm_web_search.py, a plain REST
call to Z.ai's own web_search endpoint made BEFORE the relevant agent runs
(see agents/butterfly/pipeline.py and agents/company_profiler/pipeline.py).
So every LlmAgent in every workflow is ZLM, and ZLM_API_KEY is the only model
spend in this codebase — nothing here can ever call Gemini or bill against
GEMINI_API_KEY (services/rag/embeddings.py, the other former Gemini
consumer, was moved to Zhipu's embedding-3 the same way).

Model ids are read from core/config.py rather than hardcoded here, so
changing model generation is a config change, not a code change.

The API key is wired in per-model (`api_key=...` on the LiteLlm kwargs)
rather than exported into the process environment — keeps ZLM_API_KEY
exactly where core/config.py already centralises every other secret,
instead of a second, implicit source of truth.
"""
from typing import Any

from google.adk.models.lite_llm import LiteLlm

from core.config import settings


# LiteLLM's built-in "zai" provider already knows Z.ai's base URL and request
# shape; the "zai/" prefix is what selects it, added here once rather than
# repeated in every core/config.py model id.
#
# allowed_openai_params=["response_format"]: every agent in this codebase
# that needs structured output sets output_schema (see agents/butterfly/
# agents.py, agents/company_profiler/agents.py), which ADK turns into a
# response_format payload on every completion call. LiteLLM's "zai" provider
# entry doesn't have response_format in its internal supported-params list
# yet (a LiteLLM-side gap, verified live Aug 2026 — Z.ai's own GLM API is
# OpenAI-compatible and documents JSON response-format support fine), so
# LiteLLM raises UnsupportedParamsError and drops the call before it's ever
# sent. The fix is LiteLLM's own documented escape hatch: explicitly
# whitelisting the param forwards it through as-is instead of stripping it.
# Deliberately NOT `drop_params=True` (LiteLLM's other suggested fix) — that
# would silently strip response_format instead.
#
# structured=True also overrides WHICH response_format shape gets sent.
# ADK's own conversion (google/adk/models/lite_llm.py:_to_litellm_response_
# format) builds a Gemini-only "json_object"+response_schema payload for
# Gemini models, but for every OTHER model — including ours — it instead
# builds OpenAI's STRICT, grammar-constrained structured-outputs shape
# ({"type": "json_schema", "json_schema": {..., "strict": True, ...}}).
# Verified live Aug 2026: glm-4.7-flashx cannot satisfy strict grammar-
# constrained decoding against this project's schemas and silently returns
# an EMPTY completion (200 OK, no error, nothing to parse) — every
# structured step failed with "Expecting value: line 1 column 1" from
# agents/shared/json_utils.py, which is exactly what json.loads("") raises.
# The fix is the same simpler "json_object" mode ADK already uses for
# Gemini — a soft "you must output valid JSON" instruction rather than a
# forced token-level grammar — which is what this project's schema
# validation (json_utils.py:parse_structured, defensive against markdown
# fences etc.) was actually built to sit behind in the first place, back
# when Gemini (also json_object-mode) was still in use here. Set on
# _additional_args here so it OVERWRITES the auto-built strict payload
# (LiteLlm.generate_content_async does `completion_args.update(self.
# _additional_args)` — additional_args always wins).
#
# structured=False (researcher_agent, profiler_agent, chat_model) leaves
# response_format untouched — those agents have no output_schema at all
# (free-text analysis prose), so forcing json_object mode onto them would
# be actively wrong, not just unnecessary.
def _zlm_kwargs(*, structured: bool) -> dict[str, Any]:
    kwargs: dict[str, Any] = {"allowed_openai_params": ["response_format"]}
    if settings.ZLM_API_KEY:
        kwargs["api_key"] = settings.ZLM_API_KEY
    if structured:
        kwargs["response_format"] = {"type": "json_object"}
    return kwargs


def _zlm_thinking(enabled: bool) -> dict[str, Any]:
    """GLM's API only exposes a binary thinking switch (request-body field
    `thinking: {type: "enabled"|"disabled"}`), not a graduated level — passed
    via extra_body, LiteLLM's standard passthrough for provider-specific
    fields like this one. This can't go through ADK's `generate_content_config`
    (a google.genai types.GenerateContentConfig — Gemini-SDK-typed, and
    ADK's LiteLlm wrapper only reads the handful of generic fields it shares
    with every provider: temperature/max_output_tokens/top_p/top_k/stop/
    presence_penalty/frequency_penalty. A Gemini-only field like
    thinking_config is silently ignored there, so it isn't used at all — see
    agents/shared/adk_runner.py for how the resulting call is made."""
    return {"extra_body": {"thinking": {"type": "enabled" if enabled else "disabled"}}}


def cheap_model(*, structured: bool = True) -> LiteLlm:
    """Cheapest ZLM tier — extraction and yes/no gates only, never judgment calls.

    structured=False for the one cheap-tier agent that returns free text
    instead of a schema (company_profiler's profiler_agent) — see
    _zlm_kwargs above for why that distinction matters.
    """
    return LiteLlm(
        model=f"zai/{settings.ZLM_MODEL_CHEAP}",
        **_zlm_kwargs(structured=structured),
        **_zlm_thinking(settings.ZLM_THINKING_CHEAP),
    )


def smart_model(*, structured: bool = True) -> LiteLlm:
    """Strong-reasoning ZLM tier — reserved for steps that must weigh evidence.

    structured=False for the one smart-tier agent that returns free text
    instead of a schema (butterfly's researcher_agent) — see _zlm_kwargs
    above for why that distinction matters.
    """
    return LiteLlm(
        model=f"zai/{settings.ZLM_MODEL_SMART}",
        **_zlm_kwargs(structured=structured),
        **_zlm_thinking(settings.ZLM_THINKING_SMART),
    )


def chat_model() -> LiteLlm:
    """The Research Chat answering tier (agents/research_chat/).

    Its own setting rather than cheap_model()/smart_model() because it is the
    only one of the three whose cost is driven by USER volume rather than by
    news volume — see core/config.py:ZLM_MODEL_CHAT for the tradeoff. Always
    free text (no output_schema anywhere in agents/research_chat/), same
    reasoning as researcher_agent/profiler_agent above.
    """
    return LiteLlm(
        model=f"zai/{settings.ZLM_MODEL_CHAT}",
        **_zlm_kwargs(structured=False),
        **_zlm_thinking(settings.ZLM_THINKING_CHAT),
    )
