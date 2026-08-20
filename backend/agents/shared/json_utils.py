"""
agents/shared/json_utils.py
Structured-output agents return raw JSON text (routed through ZLM's
"json_object" mode — see agents/shared/llm.py and agents/shared/adk_runner.py
for why the stricter "json_schema" mode isn't used). This parses it
defensively — models occasionally wrap JSON in a markdown fence even in
structured-output mode — and validates it against the expected pydantic
schema before any pipeline code touches it.
"""
import json
import re
from typing import TypeVar

from pydantic import BaseModel, ValidationError

T = TypeVar("T", bound=BaseModel)

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)

# Prompt text (agents/shared/adk_runner.py:_schema_instruction) explicitly
# tells the model never to wrap its answer in a container key like
# {"answer": {...}} — but prompt compliance is never guaranteed, and verified
# live Aug 2026: glm-4.7-flashx still did this on a real call despite that
# instruction. Rather than keep chasing 100% prompt compliance (impossible
# with any LLM), this is a deterministic fallback: if validation fails AND
# the payload is a single-key dict whose one value is itself a dict, retry
# validation against that inner dict before giving up. Cheap, safe (only
# fires on the exact failed shape, never masks a genuinely different error —
# the ORIGINAL exception is still raised if the unwrap doesn't validate
# either), and saves one of the item's limited retry attempts every time it
# fires instead of burning a full attempt (and its real API cost) on a
# failure mode that's completely recoverable from the response already in
# hand.
_ENVELOPE_KEYS = {"answer", "result", "response", "output", "data"}

# Repairs applied to a payload that FAILED validation, driven by pydantic's own
# error report so each one targets exactly the field pydantic objected to and
# nothing else. Both cover a real, observed glm-4.7-flashx behaviour where the
# CONTENT is correct and only its packaging is off — re-calling the model
# would produce the same class of mismatch while costing another request, so
# these are repaired from the response already in hand instead:
#
#   explicit null for an optional field — the model writes
#   "demand_direction": null / "search_queries": null rather than omitting the
#   key. Pydantic treats an explicit null as a value and rejects it against
#   Literal["UP","FLAT","DOWN"] / list[str], even though the field has a
#   perfectly good default. Deleting the key lets that default apply, which is
#   exactly what the model meant by writing null.
#
#   one item over a max_length — e.g. revenue_segments capped at 6, model
#   returned 7 real segments. The cap exists to bound prompt/storage size, not
#   because the 7th item is invalid, and the lists are ordered most-significant
#   first, so trimming the tail keeps the material content.
#
# Deliberately NOT repaired: a missing REQUIRED field, or a value that's the
# wrong type outright. Those mean the model genuinely didn't do the work, and
# silently defaulting them would write hollow data into the database — the
# retry (agents/shared/adk_runner.py) is the correct response there, so the
# original ValidationError is re-raised untouched.
_MAX_REPAIR_PASSES = 4


def _parent_and_key(data, loc: tuple):
    """Walks `loc` (pydantic's error path, e.g. ('chains', 2, 'rationale'))
    down to the container holding the offending value. Returns (None, None) if
    the path doesn't resolve — a payload shaped differently than the error
    implies is not something to guess at."""
    cursor = data
    for part in loc[:-1]:
        try:
            cursor = cursor[part]
        except (KeyError, IndexError, TypeError):
            return None, None
    return cursor, loc[-1]


def _apply_repair(data, error: dict) -> bool:
    """Applies one targeted repair. True if something was actually changed."""
    loc = error.get("loc") or ()
    if not loc:
        return False
    parent, key = _parent_and_key(data, loc)
    if parent is None:
        return False

    # Explicit null where the field is optional → drop it, let the default win.
    if error.get("input", "__sentinel__") is None:
        if isinstance(parent, dict) and key in parent:
            del parent[key]
            return True
        return False

    # One (or a few) items past a list's max_length → trim the tail.
    if error.get("type") == "too_long":
        max_length = (error.get("ctx") or {}).get("max_length")
        try:
            target = parent[key]
        except (KeyError, IndexError, TypeError):
            return False
        if isinstance(max_length, int) and isinstance(target, list) and len(target) > max_length:
            parent[key] = target[:max_length]
            return True
    return False


def parse_structured(text: str, schema: type[T]) -> T:
    cleaned = _FENCE_RE.sub("", text).strip()
    data = json.loads(cleaned)

    # Envelope unwrap, before validation — see _ENVELOPE_KEYS above.
    if isinstance(data, dict) and len(data) == 1:
        (only_key, inner), = data.items()
        if only_key.lower() in _ENVELOPE_KEYS and isinstance(inner, dict):
            data = inner

    first_error: ValidationError | None = None
    for _ in range(_MAX_REPAIR_PASSES):
        try:
            return schema.model_validate(data)
        except ValidationError as exc:
            if first_error is None:
                first_error = exc
            if not any(_apply_repair(data, error) for error in exc.errors()):
                break  # nothing repairable left — this is a genuine failure

    # Last attempt after the final repair pass; if it still fails, surface the
    # ORIGINAL error, which describes what the model actually got wrong.
    try:
        return schema.model_validate(data)
    except ValidationError:
        raise first_error from None
