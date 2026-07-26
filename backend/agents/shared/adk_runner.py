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
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger("agents.runner")


class AgentCallError(Exception):
    """Raised when an ADK agent turn produces no usable final response."""


@retry(reraise=True, stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=20))
async def run_agent_text(agent: LlmAgent, user_text: str) -> str:
    """Runs `agent` for exactly one turn on a throwaway session and returns its
    final response text (raw — caller parses/validates it, see json_utils.py)."""
    runner = InMemoryRunner(agent=agent)
    user_id = "system"
    session_id = uuid.uuid4().hex

    await runner.session_service.create_session(
        app_name=runner.app_name, user_id=user_id, session_id=session_id
    )
    message = genai_types.Content(role="user", parts=[genai_types.Part(text=user_text)])

    final_text = ""
    async for event in runner.run_async(user_id=user_id, session_id=session_id, new_message=message):
        if event.is_final_response() and event.content and event.content.parts:
            final_text = "".join(
                part.text for part in event.content.parts if part.text and not part.thought
            )

    if not final_text.strip():
        raise AgentCallError(f"Agent '{agent.name}' returned an empty final response")
    return final_text
