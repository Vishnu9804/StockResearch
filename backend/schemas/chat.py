import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import Field

from schemas.watchlist import CamelModel

# Kept as a Literal rather than imported from agents/research_chat/prompts.py
# so the API contract is validated at the edge — an unknown level is a 422 with
# a clear message here, instead of quietly falling back to a default deep
# inside the prompt builder where nobody would notice it happened.
LanguageLevel = Literal["BEGINNER", "INTERMEDIATE", "ADVANCED"]


class ConversationCreate(CamelModel):
    title: str | None = None
    language_level: LanguageLevel = "INTERMEDIATE"


class ConversationUpdate(CamelModel):
    title: str | None = None
    language_level: LanguageLevel | None = None


class ConversationOut(CamelModel):
    id: uuid.UUID
    title: str
    language_level: str
    message_count: int
    last_message_at: datetime | None
    created_at: datetime
    updated_at: datetime


class MessageOut(CamelModel):
    id: uuid.UUID
    role: str
    content: str
    language_level: str | None = None
    citations: list[Any] = []
    latency_ms: int | None = None
    created_at: datetime


class ConversationDetailOut(CamelModel):
    conversation: ConversationOut
    messages: list[MessageOut]


class AskBody(CamelModel):
    message: str = Field(min_length=1)
    language_level: LanguageLevel = "INTERMEDIATE"
    # Omit to start a new thread. The response always returns the id that was
    # used, so a client that omits it does not need a separate create call
    # before its first message.
    conversation_id: uuid.UUID | None = None


class AskResponse(CamelModel):
    conversation_id: uuid.UUID
    user_message: MessageOut
    assistant_message: MessageOut
