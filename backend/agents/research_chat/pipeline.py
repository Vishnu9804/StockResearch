"""agents/research_chat/pipeline.py
One user message in, one grounded answer out.

    guardrails.is_greeting / is_clearly_off_topic   -> canned reply, 0 tokens
    company_resolver.resolve_companies             -> which companies, code-side
    index_worker.ensure_company_indexed            -> grow the corpus if needed
    retriever.retrieve                             -> the passages, 1 embed call
    run_agent_text                                 -> the answer, 1 chat call
    guardrails.strip_advice                        -> enforce the no-advice rule

Cost per answered question is therefore fixed at exactly one embedding call
plus one chat-model call, regardless of conversation length or how many
corpora were searched. That ceiling is the design constraint this module is
built around: this is the only place in the product where a user can spend the
operator's tokens at will, and an unmetered chat that made three model calls
per turn would cost three times as much for the same answer.

Conversation history is REPLAYED IN THE PROMPT rather than carried in an ADK
session, matching agents/shared/adk_runner.py's fresh-session-per-call design.
That keeps the turn stateless — the database is the only memory — and caps
history cost at CHAT_HISTORY_TURNS instead of letting it grow with the thread.
"""
import logging
import re
import time
from dataclasses import dataclass, field

from google.adk.agents import LlmAgent
from sqlalchemy import select

from agents.research_chat import guardrails, prompts
from agents.shared.adk_runner import run_agent_text
from agents.shared.llm import chat_model
from core.config import settings
from core.database import async_session_maker
from models.models import RagDocument
from services.rag.company_resolver import resolve_companies
from services.rag.index_worker import ensure_company_indexed
from services.rag.retriever import RetrievedChunk, retrieve
from services.rag.schemas import SourceType

logger = logging.getLogger("agents.research_chat.pipeline")

WORKFLOW_VERSION = "research_chat-v1"

# Pronouns and bare follow-ups that only make sense against the previous turn.
# "What about its debt?" embeds to nothing useful on its own — the company name
# is in the turn before. Detected here so the retrieval query can be widened
# with prior context, which costs nothing and fixes the single most common
# multi-turn retrieval failure.
_FOLLOW_UP_MARKERS = re.compile(
    r"\b(it|its|it's|they|their|them|that|this|those|these|the company|"
    r"the stock|same|also|instead|what about|how about|and the|why not)\b",
    re.IGNORECASE,
)


@dataclass(slots=True)
class ChatTurn:
    role: str          # 'user' | 'assistant'
    content: str


@dataclass(slots=True)
class ChatAnswer:
    answer: str
    citations: list[dict] = field(default_factory=list)
    retrieval_debug: dict = field(default_factory=dict)
    latency_ms: int = 0
    model: str | None = None
    # True when the answer was produced without a model call (greeting or
    # off-topic). Lets the caller skip usage accounting honestly.
    canned: bool = False


def _answering_agent(language_level: str) -> LlmAgent:
    """Built fresh per call — same reasoning as agents/butterfly/agents.py, and
    doubly so here because the instruction itself varies with the requested
    language level.

    chat_model() is ZLM (agents/shared/llm.py) — no generate_content_config
    here, since that field is Gemini-SDK-typed and thinking is controlled via
    the model's own extra_body kwarg instead (core/config.py:ZLM_THINKING_CHAT)."""
    return LlmAgent(
        name="finscreen_research_chat",
        model=chat_model(),
        instruction=prompts.build_instruction(language_level),
    )


def _build_retrieval_query(question: str, history: list[ChatTurn]) -> str:
    """The text that actually gets embedded and full-text searched.

    Only widened when the question looks like a follow-up AND is short. A long,
    self-contained question does not need prior context, and prepending it
    would dilute the embedding with an unrelated earlier topic — actively
    making retrieval worse for the common case to help the uncommon one.
    """
    if len(question) > 160 or not _FOLLOW_UP_MARKERS.search(question):
        return question

    previous_user_turns = [turn.content for turn in history if turn.role == "user"][-2:]
    if not previous_user_turns:
        return question
    widened = " ".join(previous_user_turns + [question])
    logger.info("[research_chat] follow-up detected — retrieval query widened with prior turns")
    return widened[:600]


def _history_block(history: list[ChatTurn]) -> str:
    turns = history[-(settings.CHAT_HISTORY_TURNS * 2):]
    if not turns:
        return ""
    lines = []
    for turn in turns:
        speaker = "User" if turn.role == "user" else "You"
        # Assistant turns are truncated, user turns are not: the user's exact
        # words carry the thread's intent, whereas a previous answer only needs
        # to be recognisable. This is also what keeps replayed history from
        # dominating the prompt in a long conversation.
        body = turn.content if turn.role == "user" else turn.content[:600]
        lines.append(f"{speaker}: {body}")
    return "\n".join(lines)


def _source_detail(chunk: RetrievedChunk) -> str:
    bits = []
    if chunk.source_type == SourceType.NEWS:
        source_name = chunk.metadata.get("sourceName")
        if source_name:
            bits.append(str(source_name))
    if chunk.source_type == SourceType.TRANSCRIPT:
        quarter = chunk.metadata.get("quarter")
        if quarter:
            bits.append(str(quarter))
    if chunk.doc_date:
        bits.append(chunk.doc_date.strftime("%d %b %Y"))
    return ", ".join(bits)


def _build_sources(chunks: list[RetrievedChunk]) -> tuple[str, list[dict]]:
    blocks: list[str] = []
    citations: list[dict] = []
    for index, chunk in enumerate(chunks, start=1):
        blocks.append(
            prompts.format_source_block(
                index=index,
                label=chunk.source_label,
                title=chunk.title or chunk.symbol or "Untitled",
                detail=_source_detail(chunk),
                content=chunk.content,
            )
        )
        citations.append({
            "n": index,
            "sourceType": chunk.source_type,
            "sourceLabel": chunk.source_label,
            "title": chunk.title,
            "url": chunk.url,
            "symbol": chunk.symbol,
            "date": chunk.doc_date.isoformat() if chunk.doc_date else None,
            "detail": _source_detail(chunk),
        })
    return "\n\n".join(blocks), citations


def _used_citation_numbers(answer: str) -> set[int]:
    return {int(n) for n in re.findall(r"\[(\d{1,2})\]", answer)}


async def answer_question(
    question: str,
    history: list[ChatTurn] | None = None,
    language_level: str = prompts.DEFAULT_LANGUAGE_LEVEL,
) -> ChatAnswer:
    started = time.monotonic()
    history = history or []
    question = question.strip()

    if guardrails.is_greeting(question):
        return ChatAnswer(
            answer=guardrails.GREETING_REPLY,
            latency_ms=int((time.monotonic() - started) * 1000),
            retrieval_debug={"shortCircuit": "greeting"},
            canned=True,
        )

    if guardrails.is_clearly_off_topic(question):
        return ChatAnswer(
            answer=prompts.OFF_TOPIC_REPLY,
            latency_ms=int((time.monotonic() - started) * 1000),
            retrieval_debug={"shortCircuit": "offTopic"},
            canned=True,
        )

    # ── Which companies is this about? ───────────────────────────────────────
    companies = await resolve_companies(question)
    on_demand: list[dict] = []
    if settings.RAG_ON_DEMAND_ENABLED and companies:
        async with async_session_maker() as session:
            indexed = set(
                (
                    await session.execute(
                        select(RagDocument.symbol).where(
                            RagDocument.symbol.in_([c.symbol for c in companies])
                        )
                    )
                ).scalars().all()
            )
        # Only the FIRST unindexed company, never all of them: a question
        # comparing five companies would otherwise spend five FinEdge lookups
        # and up to five PDF downloads before a single word is answered. The
        # background cycle picks up the rest, and the primary subject of a
        # question is almost always the one named first.
        missing = [c.symbol for c in companies if c.symbol not in indexed][:1]
        for symbol in missing:
            logger.info("[research_chat] %s is not indexed yet — indexing on demand", symbol)
            on_demand.append(await ensure_company_indexed(symbol))

    # ── Retrieve ─────────────────────────────────────────────────────────────
    retrieval_query = _build_retrieval_query(question, history)
    retrieval = await retrieve(retrieval_query, companies=companies)
    sources_block, citations = _build_sources(retrieval.chunks)

    companies_line = ", ".join(f"{c.name} ({c.symbol})" for c in companies)

    user_turn = prompts.format_user_turn(
        question=question,
        sources_block=sources_block,
        history_block=_history_block(history),
        companies_line=companies_line,
    )

    # ── Answer ───────────────────────────────────────────────────────────────
    answer_text = await run_agent_text(_answering_agent(language_level), user_turn)

    answer_text, stripped = guardrails.strip_advice(answer_text)
    if not retrieval.chunks:
        answer_text += prompts.NO_CONTEXT_HINT

    # Only return citations the answer actually used. Listing all twelve
    # retrieved passages under an answer that cited three implies a depth of
    # sourcing that is not real, and makes the genuinely-used sources harder
    # to check.
    used = _used_citation_numbers(answer_text)
    if used:
        citations = [citation for citation in citations if citation["n"] in used]

    latency_ms = int((time.monotonic() - started) * 1000)
    debug = dict(retrieval.debug)
    debug.update({
        "workflowVersion": WORKFLOW_VERSION,
        "retrievalQuery": retrieval_query,
        "resolvedCompanies": [{"symbol": c.symbol, "name": c.name, "matchedOn": c.matched_on}
                              for c in companies],
        "onDemandIndexing": on_demand,
        "adviceSentencesStripped": stripped,
        "languageLevel": language_level,
    })

    logger.info(
        "[research_chat] answered in %dms — %d source(s) retrieved, %d cited, level=%s",
        latency_ms, len(retrieval.chunks), len(citations), language_level,
    )

    return ChatAnswer(
        answer=answer_text,
        citations=citations,
        retrieval_debug=debug,
        latency_ms=latency_ms,
        model=settings.ZLM_MODEL_CHAT,
    )
