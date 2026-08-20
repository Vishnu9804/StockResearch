"""
agents/shared/adk_runner.py
Every LLM call in every workflow under agents/ goes through `run_agent_text`.

Deliberately NOT using ADK's own SequentialAgent / shared-session state-passing
(SequentialAgent is marked deprecated in google-adk 2.5 in favour of a
not-yet-stable Workflow API that can't yet be an LlmAgent sub-agent either).
Instead each pipeline (see agents/butterfly/pipeline.py) is an explicit chain
of plain Python calls, and the caller decides exactly what text feeds the next
step. A fresh isolated session per call also means one agent's turn can never
accidentally see another step's raw output history — the only context any
step gets is what its own prompt puts in front of it.
"""
import json
import logging
import uuid

from google.adk.agents import LlmAgent
from google.adk.runners import InMemoryRunner
from google.genai import types as genai_types
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

logger = logging.getLogger("agents.runner")

# ── Schema-shape injection ───────────────────────────────────────────────────
# ADK's LlmRequest.set_output_schema() (google/adk/models/llm_request.py) only
# ever sets internal request CONFIG fields (config.response_schema,
# response_mime_type) — it never puts the actual field names into the prompt
# text itself. For a Gemini model that's fine: Gemini's native structured-
# output mode reads config.response_schema directly. For every other model
# routed through LiteLlm (agents/shared/llm.py — that's every model this
# codebase uses), the ONLY thing that ever carried the schema to the model was
# response_format's strict, grammar-constrained "json_schema" mode — which had
# to be overridden to the simpler "json_object" mode (see agents/shared/llm.py)
# because glm-4.7-flashx returns an empty completion under strict/grammar-
# constrained decoding. "json_object" mode is a soft "output valid JSON"
# instruction with NO field-name information attached — without this, the
# model has no way to learn the required field names at all.
#
# First attempt at fixing this dumped the raw JSON Schema (model_json_schema())
# straight into the prompt. That backfired a different way (verified live Aug
# 2026): the raw schema dict is ITSELF valid, JSON-object-shaped text
# ({"properties": {...}, "required": [...], "type": "object"}), and
# glm-4.7-flashx sometimes pattern-matched that as "the JSON object to hand
# back" and echoed the schema definition itself (verbatim, including the
# words "properties"/"$defs"/"required") instead of an actual filled-in
# instance of it.
#
# The fix: never show the model anything JSON-shaped for the schema itself.
# _render_fields below walks the JSON Schema and renders it as a plain
# bulleted field list (name / type / required-or-optional / description) —
# structurally nothing like a JSON object, so there is nothing for the model
# to mistake for its own answer and copy. Derived straight from the agent's
# own output_schema (the same Pydantic model json_utils.py validates the
# response against afterward), so it can never drift out of sync by hand, and
# it's a no-op (empty string) for the two free-text agents (researcher_agent,
# profiler_agent) that have no output_schema at all.
def _resolve_node(node: dict, defs: dict) -> dict:
    """Resolves a JSON-schema node's $ref — or Pydantic's `allOf: [{$ref: ...}]`
    wrapping, used when a field carries its own description alongside a $ref —
    against $defs, keeping any description found on the referencing node."""
    ref = node.get("$ref")
    all_of = node.get("allOf")
    if not ref and all_of and len(all_of) == 1 and "$ref" in all_of[0]:
        ref = all_of[0]["$ref"]
    if not ref:
        return node
    target = dict(defs.get(ref.rsplit("/", 1)[-1], {}))
    if "description" in node and "description" not in target:
        target["description"] = node["description"]
    return target


def _numeric_range(prop: dict) -> str:
    """Renders Pydantic's ge/le (-> JSON Schema minimum/maximum) as an
    explicit range so the model can't default to the common "0-100 percent"
    convention instead of this codebase's 0-1 fraction convention — verified
    live Aug 2026: without this, share/exposure fields with Field(ge=0, le=1)
    came back as 100, 60, 40, 10 instead of 1.0, 0.6, 0.4, 0.10."""
    lo = prop.get("minimum", prop.get("exclusiveMinimum"))
    hi = prop.get("maximum", prop.get("exclusiveMaximum"))
    if lo is None and hi is None:
        return ""
    if lo is not None and hi is not None:
        return f", range {lo} to {hi}"
    if lo is not None:
        return f", minimum {lo}"
    return f", maximum {hi}"


def _render_fields(schema: dict, defs: dict, indent: int) -> list[str]:
    schema = _resolve_node(schema, defs)
    required = set(schema.get("required", []))
    lines: list[str] = []
    pad = "  " * indent
    for name, prop in schema.get("properties", {}).items():
        prop = _resolve_node(prop, defs)
        prop_type = prop.get("type", "any")
        if prop.get("enum"):
            prop_type = "one of " + ", ".join(json.dumps(v) for v in prop["enum"])
        req_label = "REQUIRED" if name in required else "optional"
        description = prop.get("description", "")
        lines.append(
            f'{pad}- "{name}" ({prop_type}{_numeric_range(prop)}, {req_label})'
            + (f": {description}" if description else "")
        )
        if prop_type == "array":
            items = _resolve_node(prop.get("items", {}), defs)
            if items.get("properties"):
                lines.append(f"{pad}  each element is an object with:")
                lines.extend(_render_fields(items, defs, indent + 2))
        elif prop.get("properties"):
            lines.extend(_render_fields(prop, defs, indent + 1))
    return lines


def _schema_instruction(agent: LlmAgent) -> str:
    schema_cls = getattr(agent, "output_schema", None)
    if schema_cls is None:
        return ""
    schema = schema_cls.model_json_schema()
    defs = schema.get("$defs", {})
    field_list = "\n".join(_render_fields(schema, defs, 0))
    return (
        "\n\n--- REQUIRED OUTPUT FIELDS ---\n"
        "This is a FIELD REFERENCE describing what your answer must contain — it is NOT itself "
        "the object to return, and none of its wording (\"REQUIRED\", field names as prose, etc.) "
        "belongs in your answer. Build ONE fresh JSON object, from scratch, with exactly these "
        "field names, each set to your own real analysis for THIS specific input — never copy "
        "this reference back as your answer. Put these fields DIRECTLY at the top level of the "
        "JSON object — never wrap them in an envelope or container key such as "
        "{\"answer\": {...}} or {\"result\": {...}}. Where a range is given (e.g. \"range 0 to "
        "1\"), that is a FRACTION, not a percentage — 60% is 0.6, never 60:\n"
        f"{field_list}"
    )

# ── Request counter ──────────────────────────────────────────────────────────
# In-process only (resets on restart) — purely so LOG_LEVEL=info logs show a
# running count of real calls made to each model (ZLM — see agents/shared/
# llm.py). Z.ai's own usage dashboard lags, so this is the accurate real-time
# number during a dev/test session. Not persisted anywhere; not a rate
# limiter (LLM_QUOTA_COOLDOWN_SECONDS handles that reactively off the real
# 429).
_request_counts: dict[str, int] = {}


def _record_request(model_id: str) -> int:
    _request_counts[model_id] = _request_counts.get(model_id, 0) + 1
    return _request_counts[model_id]


def get_request_counts() -> dict[str, int]:
    """Snapshot of {model_id: total requests made this process}."""
    return dict(_request_counts)


class AgentCallError(Exception):
    """Raised when an ADK agent turn produces no usable final response."""


class QuotaExhaustedError(AgentCallError):
    """The model rejected the call with HTTP 429 (RESOURCE_EXHAUSTED).

    Kept distinct from every other failure so callers (agents/butterfly/
    pipeline.py, agents/butterfly/worker.py) can back off for a real cooldown
    instead of treating it like a one-off flaky response — a free-tier daily
    quota does not recover in the 2-20s this module's own retry backoff
    covers, so retrying immediately just spends more of a budget that's
    already at zero.
    """


def is_quota_error(exc: BaseException) -> bool:
    # litellm's exceptions (every LlmAgent.model here is a LiteLlm/ZLM
    # instance built by agents/shared/llm.py) all expose the HTTP status as
    # `.status_code`, regardless of Z.ai's own underlying error shape.
    return getattr(exc, "status_code", None) == 429


def _model_id(agent: LlmAgent) -> str:
    """agent.model is normally the LiteLlm (ZLM) instance built by agents/
    shared/llm.py (model=cheap_model()/smart_model()/etc.); fall back to
    str() for the rarer case ADK is handed a plain model-name string
    directly."""
    return getattr(agent.model, "model", None) or str(agent.model)


def _should_retry(exc: BaseException) -> bool:
    # Every other transient failure (empty response, brief network blip) is
    # still worth the normal 3-attempt backoff — only quota exhaustion is
    # excluded, since no wait this short changes the outcome.
    return not is_quota_error(exc)


@retry(reraise=True, stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=20),
       retry=retry_if_exception(_should_retry))
async def run_agent_text(agent: LlmAgent, user_text: str) -> str:
    """Runs `agent` for exactly one turn on a throwaway session and returns its
    final response text (raw — caller parses/validates it, see json_utils.py).

    Quota exhaustion is logged HERE, once, as a single clean line — this is
    the one place in the whole codebase that knows both the agent's name and
    its exact model id, so it's the right place to say precisely what hit its
    limit instead of letting the raw provider SDK dump its own noisy traceback
    (main.py silences google_adk/google_genai's own logging for exactly this
    reason — this line is the intended replacement, not a duplicate)."""
    runner = InMemoryRunner(agent=agent)
    user_id = "system"
    session_id = uuid.uuid4().hex

    await runner.session_service.create_session(
        app_name=runner.app_name, user_id=user_id, session_id=session_id
    )
    full_text = user_text + _schema_instruction(agent)
    message = genai_types.Content(role="user", parts=[genai_types.Part(text=full_text)])

    model_id = _model_id(agent)
    request_count = _record_request(model_id)
    logger.info(
        "[agents.runner] REQUEST #%d to model '%s' (agent '%s')",
        request_count, model_id, agent.name,
    )

    try:
        final_text = ""
        async for event in runner.run_async(user_id=user_id, session_id=session_id, new_message=message):
            if event.is_final_response() and event.content and event.content.parts:
                final_text = "".join(
                    part.text for part in event.content.parts if part.text and not part.thought
                )
    except Exception as exc:
        if is_quota_error(exc):
            logger.warning(
                "[agents.runner] LIMIT HIT — model '%s' (used by agent '%s') has "
                "no free requests left right now — this call will be retried later, "
                "not lost.",
                _model_id(agent), agent.name,
            )
        raise

    if not final_text.strip():
        raise AgentCallError(f"Agent '{agent.name}' returned an empty final response")
    return final_text
