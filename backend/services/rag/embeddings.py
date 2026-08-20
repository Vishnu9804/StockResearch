"""services/rag/embeddings.py
The only place in the codebase that turns text into vectors.

Deliberately NOT routed through agents/shared/adk_runner.py: that module wraps
google-adk's LlmAgent/Runner machinery, which exists to run a *conversational
turn*. An embedding call is a plain, stateless REST request with no agent, no
session and no tool loop, so it goes straight to Z.ai's HTTP API via httpx —
while still borrowing adk_runner's two conventions that do apply here: a
per-model request counter for live quota visibility, and treating HTTP 429 as
its own distinct, non-retryable-right-now failure.

Provider: Zhipu AI / Z.ai's embedding-3 (core/config.py:ZLM_EMBEDDING_MODEL),
paid via the same ZLM_API_KEY as every LLM call in this codebase — see
core/config.py's provider-split comment for why this replaced Gemini's
embeddings entirely (Gemini's free tier caps at 1000 embeddings/day; a paid,
usage-billed API has no such daily wall, which is what makes it safe to build
a chatbot corpus — PDFs, news, transcripts — without worrying it'll stop
mid-indexing for a day).
"""
import asyncio
import logging
import math
import re
import time

import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from core.config import settings

logger = logging.getLogger("services.rag.embeddings")

_ENDPOINT = "https://api.z.ai/api/paas/v4/embeddings"
# Hard API cap, verified against Z.ai/Zhipu's own docs (Aug 2026) — a request
# over this is rejected outright, unlike Gemini's old 100-per-request cap.
_MAX_TEXTS_PER_REQUEST = 64


class EmbeddingError(RuntimeError):
    """Embedding could not be produced for the given text(s)."""


class EmbeddingQuotaError(EmbeddingError):
    """HTTP 429 from the embedding endpoint — the per-minute rate limit is spent
    right now.

    Kept distinct for exactly the reason agents/shared/adk_runner.py keeps
    QuotaExhaustedError distinct: no amount of short backoff recovers a rate
    limit that just tripped, so callers must cool down rather than retry
    immediately. Unlike the old Gemini free tier, there is no separate DAILY
    cap to distinguish here — this is a paid, usage-billed API, so a 429 only
    ever means "too many requests this minute," never "out of free quota for
    the day."
    """


# Same in-process, non-persisted counter idea as agents/shared/adk_runner.py —
# Z.ai's own dashboard lags, so this is the accurate live number during a
# dev/test session. Not a rate limiter.
_request_count = 0


def get_request_count() -> int:
    """Embedding requests made by this process since start."""
    return _request_count


def _headers() -> dict[str, str]:
    if not settings.ZLM_API_KEY:
        raise EmbeddingError(
            "ZLM_API_KEY is not set — cannot embed. Set it in backend/.env; "
            "every RAG entry point checks this and degrades gracefully rather "
            "than crashing."
        )
    return {"Authorization": f"Bearer {settings.ZLM_API_KEY}", "Content-Type": "application/json"}


def is_quota_error(exc: BaseException) -> bool:
    return isinstance(exc, EmbeddingQuotaError)


def _should_retry(exc: BaseException) -> bool:
    return not is_quota_error(exc)


# ── Proactive throttle ───────────────────────────────────────────────────────
# Same token-bucket idea as core/rate_limiter.py, with one difference that
# matters: a call costs N tokens, not one, because whatever per-minute limit
# this defends against counts TEXTS rather than HTTP requests — see
# core/config.py:RAG_EMBEDDING_TEXTS_PER_MINUTE. That starting number is a
# reasonable default, not yet verified live against a real Zhipu key (this
# codebase has been burned before by trusting docs over a live dashboard —
# see core/config.py:RAG_EMBEDDING_TEXTS_PER_MINUTE for that history) — so the
# self-tuning below is what actually keeps this correct in practice,
# regardless of whether the starting number is exactly right.
#
# In-process rather than the shared Redis bucket, because every embedding call
# in this system comes from a single owner — the index worker (or a one-off
# /api/chat/index/run), never from N concurrent web workers. The chat's own
# per-question query embedding is the only other caller and is one text.

# Set when the provider says "retry in Xs"; every subsequent acquire waits it
# out. Process-wide rather than per-call because the limit is per-key, not
# per-batch: once one call has been told to wait, every other call in this
# process has been told the same thing, and firing anyway only deepens the debt
# (see the 429-handling comment in _embed_batch).
_cooldown_until: float = 0.0


class _TextBudget:
    """Token bucket that TUNES ITSELF to whatever the key actually allows.

    Ported from the Gemini version of this file with the same reasoning
    (a fixed rate is not trustworthy — see core/config.py's live-verification
    comments), rate-controlled AIMD-style: halve it on a rejection, edge it
    back up on every success. On a rested key it converges to the configured
    ceiling within a couple of minutes; on a throttled one it settles wherever
    the throughput actually is, without a human editing a config value to
    match the weather.
    """

    # Never decays below this — a bucket that backs off to nothing would look
    # identical to a hung process.
    _MIN_TEXTS_PER_MINUTE = 12.0

    def __init__(self, texts_per_minute: float) -> None:
        self._max_rate = max(texts_per_minute / 60.0, 0.1)
        self._min_rate = min(self._MIN_TEXTS_PER_MINUTE / 60.0, self._max_rate)
        self._rate = self._max_rate
        # Deliberately NOT full at startup — see the Gemini-era version of
        # this file for the measured reasoning (a bucket that starts full
        # guarantees a burst 429 on a process that just restarted).
        self._tokens = min(float(self.capacity), 10.0)
        self._updated = time.monotonic()
        self._lock = asyncio.Lock()

    @property
    def capacity(self) -> int:
        """Largest batch this bucket can charge honestly, at the CURRENT rate."""
        return max(1, int(self._rate * 60.0))

    def penalise(self) -> None:
        previous = self._rate * 60.0
        self._rate = max(self._min_rate, self._rate * 0.5)
        self._tokens = 0.0
        self._updated = time.monotonic()
        logger.info(
            "[rag.embeddings] backing off — pacing reduced from %.0f to %.0f texts/min",
            previous, self._rate * 60.0,
        )

    def reward(self) -> None:
        if self._rate >= self._max_rate:
            return
        self._rate = min(self._max_rate, self._rate + self._max_rate / 10.0)

    async def acquire(self, cost: int, max_wait: float | None = None) -> None:
        """Wait for `cost` texts' worth of allowance.

        `max_wait` caps how long the caller is willing to be blocked, raising
        instead of waiting past it. Background indexing passes None — waiting
        is exactly what it should do. The chat's per-question query embedding
        passes a couple of seconds, because a user is on the other end.
        Failing fast there lets services/rag/retriever.py fall back to
        keyword-only search, which is a worse answer delivered in seconds
        instead of no answer at all.
        """
        cost = max(1, min(cost, self.capacity))

        remaining_cooldown = _cooldown_until - time.monotonic()
        if remaining_cooldown > 0:
            if max_wait is not None and remaining_cooldown > max_wait:
                raise EmbeddingQuotaError(
                    f"embedding is cooling down for another {remaining_cooldown:.0f}s"
                )
            logger.info(
                "[rag.embeddings] provider asked us to wait — holding %.0fs before the next call",
                remaining_cooldown,
            )
            await asyncio.sleep(remaining_cooldown)

        while True:
            async with self._lock:
                now = time.monotonic()
                self._tokens = min(
                    float(self.capacity), self._tokens + (now - self._updated) * self._rate
                )
                self._updated = now
                if self._tokens >= cost:
                    self._tokens -= cost
                    return
                wait = (cost - self._tokens) / self._rate
            if max_wait is not None and wait > max_wait:
                raise EmbeddingQuotaError(f"embedding budget is {wait:.0f}s away")
            if wait > 1.0:
                logger.info("[rag.embeddings] pacing — waiting %.0fs for embedding budget", wait)
            await asyncio.sleep(min(wait, 60.0))


_budget: _TextBudget | None = None


def _get_budget() -> _TextBudget:
    global _budget
    if _budget is None:
        _budget = _TextBudget(
            settings.RAG_EMBEDDING_TEXTS_PER_MINUTE * settings.RAG_EMBEDDING_RATE_SAFETY
        )
    return _budget


# How many CONSECUTIVE 429s one embed_documents call absorbs before deferring
# the rest. Each retry costs a real wait (the provider's own suggested delay,
# enforced by _cooldown_until), so this is a time budget as much as an attempt
# count.
_MAX_QUOTA_RETRIES = 3

# How long the chat's per-question query embedding will wait for allowance
# before giving up and letting retrieval fall back to keyword-only. Short,
# because a user is watching a loading indicator.
_QUERY_MAX_WAIT_SECONDS = 2.5

# Best-effort — matches the "retry in Xs" phrasing Gemini used to return.
# NOT verified against Zhipu's actual 429 body (unlike the rest of this
# comment block's Gemini-era numbers, which were confirmed live before being
# relied on). Harmless if it never matches: _suggested_retry_seconds then
# returns None and the caller falls back to a flat 60s wait.
_RETRY_DELAY_RE = re.compile(r"retry in ([0-9.]+)s", re.IGNORECASE)


def _suggested_retry_seconds(exc: BaseException) -> float | None:
    match = _RETRY_DELAY_RE.search(str(exc))
    return float(match.group(1)) if match else None


def _normalise(vector: list[float]) -> list[float]:
    """Re-scale to unit length.

    Defensive rather than confirmed-necessary: unlike gemini-embedding-001
    (whose Matryoshka truncation was verified live to return a vector whose
    norm varies with the text unless renormalised), Zhipu's `dimensions`
    parameter is not documented as truncation of a larger native vector, and
    there's no live-verified evidence either way for embedding-3's specific
    behaviour at a non-default dimension. Renormalising is a no-op on a
    vector that's already unit length, so this stays on as cheap insurance
    against a ranking that would otherwise be silently, subtly wrong rather
    than obviously broken — the same failure mode the Gemini version of this
    file was written to avoid.
    """
    norm = math.sqrt(sum(component * component for component in vector))
    if norm == 0.0:
        return vector
    return [component / norm for component in vector]


@retry(reraise=True, stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=20),
       retry=retry_if_exception(_should_retry))
async def _embed_batch(texts: list[str], max_wait: float | None = None) -> list[list[float]]:
    """Exactly ONE paced attempt. Retrying is the caller's job — see
    embed_documents, and this is not an arbitrary split (see the Gemini-era
    version of this file for the measured reasoning: a rejected request is
    still metered on some providers, and a local retry here would re-send a
    batch size the pacer has just decided is too big)."""
    global _cooldown_until

    budget = _get_budget()
    await budget.acquire(len(texts), max_wait=max_wait)
    try:
        vectors = await _embed_once(texts)
    except EmbeddingQuotaError as exc:
        hinted = _suggested_retry_seconds(exc)
        wait_for = hinted if hinted is not None else 60.0
        _cooldown_until = max(_cooldown_until, time.monotonic() + wait_for + 2.0)
        budget.penalise()
        raise
    else:
        budget.reward()
        return vectors


async def _embed_once(texts: list[str]) -> list[list[float]]:
    global _request_count
    _request_count += 1

    logger.info(
        "[rag.embeddings] REQUEST #%d — %d text(s), model=%s, dim=%d",
        _request_count, len(texts), settings.ZLM_EMBEDDING_MODEL, settings.RAG_EMBEDDING_DIM,
    )

    payload = {
        "model": settings.ZLM_EMBEDDING_MODEL,
        "input": texts,
        "dimensions": settings.RAG_EMBEDDING_DIM,
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(_ENDPOINT, json=payload, headers=_headers())
    except httpx.HTTPError as exc:
        raise EmbeddingError(f"embedding request failed: {exc}") from exc

    if response.status_code == 429:
        hinted = _suggested_retry_seconds(EmbeddingError(response.text))
        logger.warning(
            "[rag.embeddings] LIMIT HIT — embedding model '%s' is rate-limited right now (%s).",
            settings.ZLM_EMBEDDING_MODEL,
            f"retry suggested in {hinted:.1f}s" if hinted is not None else "no retry hint given",
        )
        raise EmbeddingQuotaError(response.text)
    if response.status_code != 200:
        raise EmbeddingError(
            f"embedding model '{settings.ZLM_EMBEDDING_MODEL}' returned HTTP "
            f"{response.status_code}: {response.text[:500]}"
        )

    try:
        data = response.json()
    except ValueError as exc:
        raise EmbeddingError("embedding endpoint returned non-JSON response") from exc

    # Zhipu's response indexes each embedding, so a batch is reassembled by
    # `index` rather than trusted to arrive in request order — cheap
    # insurance against exactly the kind of silent misalignment corruption
    # the length check below also guards against.
    entries = sorted(data.get("data") or [], key=lambda entry: entry.get("index", 0))
    vectors = [list(entry.get("embedding") or []) for entry in entries]

    # A response that silently returns a different number of vectors than we
    # sent texts would misalign EVERY chunk with someone else's embedding —
    # a corruption that produces plausible-looking but wrong retrieval forever
    # after, with nothing in the logs. Refuse rather than risk it.
    if len(vectors) != len(texts):
        raise EmbeddingError(
            f"Embedding model '{settings.ZLM_EMBEDDING_MODEL}' returned "
            f"{len(vectors)} vectors for {len(texts)} inputs — refusing to index "
            "a misaligned batch."
        )
    for vector in vectors:
        if len(vector) != settings.RAG_EMBEDDING_DIM:
            raise EmbeddingError(
                f"Embedding dimension mismatch: got {len(vector)}, expected "
                f"{settings.RAG_EMBEDDING_DIM} (see core/config.py)."
            )

    return [_normalise(vector) for vector in vectors]


async def embed_documents(texts: list[str]) -> list[list[float]]:
    """Embed passages for STORAGE. Returns one vector per input, in order.

    Batched at RAG_EMBEDDING_BATCH_SIZE (bounded by Zhipu's hard 64-per-request
    cap, verified against Zhipu's own docs — see _MAX_TEXTS_PER_REQUEST).
    Batching cuts HTTP round-trips, but buys nothing against the per-minute
    pacer, which counts texts rather than calls — the pacing in _embed_batch is
    what keeps this inside whatever the real limit turns out to be.
    """
    if not texts:
        return []

    vectors: list[list[float]] = []
    budget = _get_budget()
    start = 0
    # CONSECUTIVE failures, reset by every success — see the Gemini-era
    # version of this file for why a total counter would be wrong here.
    consecutive_quota_failures = 0

    while start < len(texts):
        batch_size = max(1, min(settings.RAG_EMBEDDING_BATCH_SIZE, _MAX_TEXTS_PER_REQUEST, budget.capacity))
        try:
            vectors.extend(await _embed_batch(texts[start:start + batch_size]))
        except EmbeddingQuotaError:
            consecutive_quota_failures += 1
            if consecutive_quota_failures > _MAX_QUOTA_RETRIES:
                # Give up on the rest. The caller keeps everything embedded so
                # far and defers the remainder to a later cycle, so nothing is
                # lost and nothing is paid for twice.
                raise
            logger.info(
                "[rag.embeddings] retrying from text %d of %d at the reduced rate "
                "(consecutive failure %d/%d)",
                start, len(texts), consecutive_quota_failures, _MAX_QUOTA_RETRIES,
            )
            continue
        consecutive_quota_failures = 0
        start += batch_size

    return vectors


async def embed_query(text: str) -> list[float]:
    """Embed ONE user question for SEARCH.

    Impatient by design: a person is waiting. If the allowance is more than a
    couple of seconds away this raises rather than blocking, and
    services/rag/retriever.py degrades to keyword-only search — see
    _TextBudget.acquire for why that is the right trade on this path and the
    wrong one for indexing.
    """
    vectors = await _embed_batch([text], max_wait=_QUERY_MAX_WAIT_SECONDS)
    return vectors[0]
