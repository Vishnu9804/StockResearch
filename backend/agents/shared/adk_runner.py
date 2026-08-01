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
import logging
import uuid

from google.adk.agents import LlmAgent
from google.adk.runners import InMemoryRunner
from google.genai import types as genai_types
from google.genai.errors import ClientError
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

logger = logging.getLogger("agents.runner")

# ── Request counter ──────────────────────────────────────────────────────────
# In-process only (resets on restart) — purely so LOG_LEVEL=info logs show a
# running count of real calls made to each Gemini model. AI Studio's own
# dashboard lags, so this is the accurate real-time number during a dev/test
# session. Not persisted anywhere; not a rate limiter (GEMINI_QUOTA_COOLDOWN_
# SECONDS handles that reactively off the real 429).
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
    return isinstance(exc, ClientError) and getattr(exc, "code", None) == 429


def _model_id(agent: LlmAgent) -> str:
    """agent.model is normally the Gemini instance built by agents/shared/llm.py
    (model=cheap_model()/smart_model()); fall back to str() for the rarer case
    ADK is handed a plain model-name string directly."""
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
    limit instead of letting the raw Gemini SDK dump its own noisy traceback
    (main.py silences google_adk/google_genai's own logging for exactly this
    reason — this line is the intended replacement, not a duplicate)."""
    runner = InMemoryRunner(agent=agent)
    user_id = "system"
    session_id = uuid.uuid4().hex

    await runner.session_service.create_session(
        app_name=runner.app_name, user_id=user_id, session_id=session_id
    )
    message = genai_types.Content(role="user", parts=[genai_types.Part(text=user_text)])

    model_id = _model_id(agent)
    request_count = _record_request(model_id)
    logger.info(
        "[agents.runner] REQUEST #%d to Gemini model '%s' (agent '%s')",
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
                "[agents.runner] LIMIT HIT — Gemini model '%s' (used by agent '%s') has "
                "no free requests left right now — this call will be retried later, "
                "not lost.",
                _model_id(agent), agent.name,
            )
        raise

    if not final_text.strip():
        raise AgentCallError(f"Agent '{agent.name}' returned an empty final response")
    return final_text
