"""routers/chat.py
The Research Chat API.

    GET    /api/chat/conversations           the user's newest threads (the UI's stack)
    POST   /api/chat/conversations           start a thread explicitly
    GET    /api/chat/conversations/{id}      one thread with all its turns
    PATCH  /api/chat/conversations/{id}      rename / change language level
    DELETE /api/chat/conversations/{id}      remove a thread
    POST   /api/chat/ask                     ask a question (the only expensive route)

    GET    /api/chat/index/stats             corpus size — is the index built?
    POST   /api/chat/index/run               run one index cycle now

Every conversation route is scoped to the authenticated user's own rows; there
is no route that can read another user's thread.

Retention (CHAT_MAX_CONVERSATIONS_PER_USER) is enforced when a thread is
CREATED rather than on a schedule. A cron job would leave a user who has not
visited in months holding unbounded history, and doing it at creation time
means the invariant "a user has at most N threads" is true continuously
instead of eventually.
"""
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from agents.research_chat.pipeline import ChatTurn, answer_question
from core.config import settings
from core.database import get_db
from dependencies.db_user import get_db_user
from models.models import ChatConversation, ChatMessage, User
from schemas.chat import (
    AskBody, AskResponse, ConversationCreate, ConversationDetailOut, ConversationOut,
    ConversationUpdate, MessageOut,
)
from services.rag.index_worker import run_index_cycle
from services.rag.indexer import index_stats

logger = logging.getLogger("chat.router")

router = APIRouter(prefix="/api/chat", tags=["research-chat"])


def _recency_order():
    """Newest activity first, where "activity" falls back to creation time.

    coalesce, not `last_message_at DESC NULLS LAST`: a conversation created via
    POST /conversations has no messages yet, so ordering on last_message_at
    alone sorts it BELOW every thread that does — which would make the pruning
    below delete the thread the user just created, while every older one
    survived. Falling back to created_at puts a brand-new empty thread exactly
    where the user expects it: at the top.
    """
    return desc(func.coalesce(ChatConversation.last_message_at, ChatConversation.created_at))


def _conversation_out(conversation: ChatConversation) -> dict:
    return ConversationOut.model_validate(conversation).model_dump(by_alias=True)


def _message_out(message: ChatMessage) -> dict:
    return MessageOut.model_validate(message).model_dump(by_alias=True)


def _derive_title(question: str) -> str:
    """First line of the opening question, trimmed. Good enough to recognise a
    thread in a list, and free — asking the model to name the thread would add
    a second billable call to every new conversation for a cosmetic gain."""
    title = " ".join(question.strip().split())
    return (title[:70].rstrip() + "...") if len(title) > 70 else (title or "New research chat")


async def _owned_conversation(
    db: AsyncSession, conversation_id: uuid.UUID, user: User
) -> ChatConversation:
    conversation = await db.get(ChatConversation, conversation_id)
    if conversation is None or conversation.user_id != user.id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


async def _prune_conversations(db: AsyncSession, user: User) -> None:
    """Keep only the newest CHAT_MAX_CONVERSATIONS_PER_USER threads."""
    keep = settings.CHAT_MAX_CONVERSATIONS_PER_USER
    stale_ids = (
        await db.execute(
            select(ChatConversation.id)
            .where(ChatConversation.user_id == user.id)
            .order_by(_recency_order())
            .offset(keep)
        )
    ).scalars().all()
    if stale_ids:
        # Messages go with them via the ON DELETE CASCADE in migration 003.
        await db.execute(delete(ChatConversation).where(ChatConversation.id.in_(stale_ids)))
        logger.info("[chat.router] pruned %d old conversation(s) for user %s", len(stale_ids), user.id)


@router.get("/conversations")
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    db_user: User = Depends(get_db_user),
    limit: int = Query(None, ge=1, le=50),
):
    limit = limit or settings.CHAT_MAX_CONVERSATIONS_PER_USER
    rows = (
        await db.execute(
            select(ChatConversation)
            .where(ChatConversation.user_id == db_user.id)
            .order_by(_recency_order())
            .limit(limit)
        )
    ).scalars().all()
    return {"success": True, "conversations": [_conversation_out(row) for row in rows]}


@router.post("/conversations", status_code=201)
async def create_conversation(
    body: ConversationCreate,
    db: AsyncSession = Depends(get_db),
    db_user: User = Depends(get_db_user),
):
    conversation = ChatConversation(
        user_id=db_user.id,
        title=(body.title or "New research chat").strip()[:120],
        language_level=body.language_level,
    )
    db.add(conversation)
    await db.flush()
    await _prune_conversations(db, db_user)
    await db.refresh(conversation)
    return {"success": True, "conversation": _conversation_out(conversation)}


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    db_user: User = Depends(get_db_user),
):
    conversation = await _owned_conversation(db, conversation_id, db_user)
    messages = (
        await db.execute(
            select(ChatMessage)
            .where(ChatMessage.conversation_id == conversation.id)
            .order_by(ChatMessage.created_at)
        )
    ).scalars().all()
    return ConversationDetailOut(
        conversation=ConversationOut.model_validate(conversation),
        messages=[MessageOut.model_validate(message) for message in messages],
    ).model_dump(by_alias=True)


@router.patch("/conversations/{conversation_id}")
async def update_conversation(
    conversation_id: uuid.UUID,
    body: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
    db_user: User = Depends(get_db_user),
):
    conversation = await _owned_conversation(db, conversation_id, db_user)
    if body.title is not None:
        conversation.title = body.title.strip()[:120] or conversation.title
    if body.language_level is not None:
        conversation.language_level = body.language_level
    await db.flush()
    await db.refresh(conversation)
    return {"success": True, "conversation": _conversation_out(conversation)}


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    db_user: User = Depends(get_db_user),
):
    conversation = await _owned_conversation(db, conversation_id, db_user)
    await db.delete(conversation)
    return {"success": True}


@router.post("/ask")
async def ask(
    body: AskBody,
    db: AsyncSession = Depends(get_db),
    db_user: User = Depends(get_db_user),
):
    """Ask one question. Creates the thread if no conversation_id is given.

    Both turns are written in the SAME transaction as the answer is returned,
    so a thread can never end up holding a question with no answer — a state
    the UI would render as a message that silently vanished.
    """
    # Captured before the model call, and used as the user turn's created_at
    # below. Both turns are inserted in one transaction, and Postgres now()
    # returns the TRANSACTION start time — so leaning on the column default
    # would stamp the question and the answer with the identical timestamp and
    # make "order by created_at" a coin flip between them. The thread would
    # then render its own answer above the question that produced it.
    received_at = datetime.now(timezone.utc)

    question = body.message.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    if len(question) > settings.CHAT_MAX_QUESTION_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Message is too long (limit {settings.CHAT_MAX_QUESTION_CHARS} characters).",
        )
    # ZLM drives both halves of a question — embedding it for retrieval and
    # generating the answer — see agents/research_chat/pipeline.py.
    if not settings.ZLM_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Research Chat is not configured yet — ZLM_API_KEY is missing on the server.",
        )

    if body.conversation_id is not None:
        conversation = await _owned_conversation(db, body.conversation_id, db_user)
    else:
        conversation = ChatConversation(
            user_id=db_user.id,
            title=_derive_title(question),
            language_level=body.language_level,
        )
        db.add(conversation)
        await db.flush()
        await _prune_conversations(db, db_user)

    history_rows = (
        await db.execute(
            select(ChatMessage)
            .where(ChatMessage.conversation_id == conversation.id)
            .order_by(ChatMessage.created_at.desc())
            .limit(settings.CHAT_HISTORY_TURNS * 2)
        )
    ).scalars().all()
    history = [ChatTurn(role=row.role, content=row.content) for row in reversed(history_rows)]

    try:
        result = await answer_question(
            question=question,
            history=history,
            language_level=body.language_level,
        )
    except Exception as exc:
        # Nothing has been committed at this point, so a failed question leaves
        # no half-thread behind — the user simply retries.
        logger.error("[chat.router] answering failed: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=502,
            detail="Research Chat could not complete that answer. Please try again in a moment.",
        )

    answered_at = datetime.now(timezone.utc)
    user_message = ChatMessage(
        conversation_id=conversation.id,
        role="user",
        content=question,
        created_at=received_at,
    )
    assistant_message = ChatMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=result.answer,
        language_level=body.language_level,
        citations=result.citations,
        retrieval_debug=result.retrieval_debug,
        token_usage={"model": result.model} if result.model else {},
        latency_ms=result.latency_ms,
        created_at=answered_at,
    )
    db.add_all([user_message, assistant_message])

    conversation.language_level = body.language_level
    conversation.message_count = (conversation.message_count or 0) + 2
    conversation.last_message_at = answered_at
    if conversation.message_count <= 2:
        conversation.title = _derive_title(question)

    await db.flush()
    await db.refresh(user_message)
    await db.refresh(assistant_message)
    await db.refresh(conversation)

    return AskResponse(
        conversation_id=conversation.id,
        user_message=MessageOut.model_validate(user_message),
        assistant_message=MessageOut.model_validate(assistant_message),
    ).model_dump(by_alias=True)


# ── Index operations ─────────────────────────────────────────────────────────
# Read-only stats are public for the same reason /api/news/health is: they
# describe the corpus, not any user.

@router.get("/index/stats")
async def get_index_stats():
    stats = await index_stats()
    stats["chatModel"] = settings.ZLM_MODEL_CHAT
    # What the frontend actually needs to decide whether to warn "the index is
    # empty, answers will be thin" before the user's first question.
    stats["ready"] = bool(stats.get("totalChunks"))
    return stats


@router.post("/index/run")
async def run_index(
    include_news: bool = Query(True, description="Set false to skip the news corpus"),
    chunk_budget: int = Query(
        None, ge=1, le=5000,
        description="Override RAG_MAX_CHUNKS_PER_CYCLE for this run. Higher = more indexed, "
                    "longer wait (the free tier paces at ~90 texts/minute).",
    ),
    db_user: User = Depends(get_db_user),
):
    """Run one index cycle synchronously and return what changed.

    Auth-gated (unlike the stats route) because it spends embedding quota. It
    is the manual equivalent of ENABLE_RAG_INDEX_WORKER's loop, and exists so
    the index can be built without leaving a worker running.

    `total.moreWorkPending` in the response is the signal to call this again:
    a cycle stops at RAG_MAX_CHUNKS_PER_CYCLE, so a first run over a large
    backlog is several calls, not one. That is by design — see
    core/config.py:RAG_MAX_CHUNKS_PER_CYCLE.
    """
    try:
        return await run_index_cycle(include_news=include_news, chunk_budget=chunk_budget)
    except Exception as exc:
        logger.error("[chat.router] index cycle failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=502, detail=f"Index cycle failed: {exc}")
