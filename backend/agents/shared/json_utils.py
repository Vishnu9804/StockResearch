"""
agents/shared/json_utils.py
Structured-output agents return raw JSON text (Gemini's JSON mode, driven by
LlmAgent.output_schema). This parses it defensively — models occasionally
wrap JSON in a markdown fence even in structured-output mode — and validates
it against the expected pydantic schema before any pipeline code touches it.
"""
import json
import re
from typing import TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)

_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.MULTILINE)


def parse_structured(text: str, schema: type[T]) -> T:
    cleaned = _FENCE_RE.sub("", text).strip()
    data = json.loads(cleaned)
    return schema.model_validate(data)
