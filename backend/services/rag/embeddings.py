"""services/rag/embeddings.py
The only place in the codebase that turns text into vectors.

Deliberately NOT routed through agents/shared/adk_runner.py: that module wraps
google-adk's LlmAgent/Runner machinery, which exists to run a *conversational
turn*. An embedding call is a plain, stateless google-genai request with no
agent, no session and no tool loop, so it uses the SDK client directly — while
still borrowing adk_runner's two conventions that do apply here: a per-model
request counter for live quota visibility, and treating HTTP 429 as its own
distinct, non-retryable-right-now failure.

Two task types, and the difference is not cosmetic. gemini-embedding-001 is
trained asymmetrically: RETRIEVAL_DOCUMENT and RETRIEVAL_QUERY place a passage
and the question that should find it into a *shared* space. Embedding both
sides with the same task type measurably degrades recall, so the two entry
points below are separate functions rather than one with a flag nobody
remembers to set.
"""
import asyncio
import logging
import math
import re
import time

from google import genai
from google.genai import types as genai_types
from google.genai.errors import ClientError
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from core.config import settings

logger = logging.getLogger("services.rag.embeddings")


class EmbeddingError(RuntimeError):
    """Embedding could not be produced for the given text(s)."""


class EmbeddingQuotaError(EmbeddingError):
    """HTTP 429 from the embedding endpoint — the daily/per-minute cap is spent.

    Kept distinct for exactly the reason agents/shared/adk_runner.py keeps
    QuotaExhaustedError distinct: no amount of short backoff recovers a quota
    that is already at zero, so callers must cool down rather than retry.
    """


# Same in-process, non-persisted counter idea as agents/shared/adk_runner.py —
# AI Studio's own dashboard lags, so this is the accurate live number during a
# dev/test session. Not a rate limiter.
_request_count = 0
_client: genai.Client | None = None


def get_request_count() -> int:
    """Embedding requests made by this process since start."""
    return _request_count


def _get_client() -> genai.Client:
    """Built lazily and cached: constructing a Client validates nothing, but a
    fresh one per batch would throw away the SDK's connection pool on a code
    path that fires up to 100 times during a single index cycle."""
    global _client
    if not settings.GEMINI_API_KEY:
        raise EmbeddingError(
            "GEMINI_API_KEY is not set — cannot embed. Set it in backend/.env; "
            "every RAG entry point checks this and degrades gracefully rather "
            "than crashing."
        )
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


def is_quota_error(exc: BaseException) -> bool:
    return isinstance(exc, (EmbeddingQuotaError,)) or (
        isinstance(exc, ClientError) and getattr(exc, "code", None) == 429
    )


def _should_retry(exc: BaseException) -> bool:
    return not is_quota_error(exc)


# ── Proactive throttle ───────────────────────────────────────────────────────
# Same token-bucket idea as core/rate_limiter.py, with one difference that
# matters: a call costs N tokens, not one, because the quota this defends
# counts TEXTS rather than HTTP requests (see
# core/config.py:RAG_EMBEDDING_TEXTS_PER_MINUTE for how that was established).
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

    A fixed rate is not good enough here, and that is an empirical finding
    rather than a design preference. The documented free-tier ceiling is 100
    texts/minute and it holds on a rested key — but after sustained indexing
    the same key sustains barely a third of that, and no static number is
    right in both states. Measured directly: after 90 seconds of complete
    silence, a 25-text request was still rejected, and each further 25-text
    request added ~40 seconds of debt to a 60-second window.

    So the rate is controlled AIMD-style, the way congestion control has
    always handled a capacity you cannot observe directly: halve it on a
    rejection, edge it back up on every success. On a rested key it converges
    to the configured ceiling within a couple of minutes; on a throttled one it
    settles wherever the throughput actually is, without a human editing a
    config value to match the weather.
    """

    # Never decays below this — a bucket that backs off to nothing would look
    # identical to a hung process.
    _MIN_TEXTS_PER_MINUTE = 12.0

    def __init__(self, texts_per_minute: float) -> None:
        self._max_rate = max(texts_per_minute / 60.0, 0.1)
        self._min_rate = min(self._MIN_TEXTS_PER_MINUTE / 60.0, self._max_rate)
        self._rate = self._max_rate
        # Deliberately NOT full at startup. A bucket that starts full assumes
        # the provider's window is empty, which is false whenever a process
        # restarts shortly after doing work — and a short-lived process (the
        # one-off /api/chat/index/run) is then guaranteed to burst straight
        # into a 429 before it has embedded anything. Verified: starting full
        # reproducibly 429s on the third batch of a fresh run.
        #
        # A small non-zero start is the compromise: the latency-sensitive path
        # (one text, to embed a chat question) never waits, while bulk
        # indexing ramps up over the first ~40 seconds instead of spiking.
        self._tokens = min(float(self.capacity), 10.0)
        self._updated = time.monotonic()
        self._lock = asyncio.Lock()

    @property
    def capacity(self) -> int:
        """Largest batch this bucket can charge honestly, at the CURRENT rate.

        Callers size their batches to this rather than to the API's own
        100-per-request cap, for two reasons: a batch larger than the bucket
        would have to be clamped (silently under-charging the difference and
        drifting over the real limit a few texts at a time), and while the
        rate is backed off, smaller batches are what let progress continue at
        all instead of one oversized request failing over and over.
        """
        return max(1, int(self._rate * 60.0))

    def penalise(self) -> None:
        """Multiplicative decrease, plus a drain. Called on every rejection.

        The drain is not redundant with the cooldown: the cooldown stops the
        NEXT call from going out too early, and the drain stops it from going
        out with a full allowance the moment the cooldown lapses.
        """
        previous = self._rate * 60.0
        self._rate = max(self._min_rate, self._rate * 0.5)
        self._tokens = 0.0
        self._updated = time.monotonic()
        logger.info(
            "[rag.embeddings] backing off — pacing reduced from %.0f to %.0f texts/min",
            previous, self._rate * 60.0,
        )

    def reward(self) -> None:
        """Additive increase after a success — a TENTH of the ceiling.

        Small on purpose. A larger step (a fifth was tried first) overshoots
        immediately once the sustainable rate is well below the ceiling:
        observed live, 15/min succeeded, the reward jumped it to 27, and 27 was
        rejected — so the controller spent every other call paying for its own
        optimism. A tenth still recovers a rested key to full speed inside a
        dozen successful calls, which is fast enough for a background job.
        """
        if self._rate >= self._max_rate:
            return
        self._rate = min(self._max_rate, self._rate + self._max_rate / 10.0)

    async def acquire(self, cost: int, max_wait: float | None = None) -> None:
        """Wait for `cost` texts' worth of allowance.

        `max_wait` caps how long the caller is willing to be blocked, raising
        instead of waiting past it. Background indexing passes None — waiting
        is exactly what it should do. The chat's per-question query embedding
        passes a couple of seconds, because a user is on the other end: when
        the daily quota is spent the cooldown is an HOUR, and waiting it out
        would hang the request rather than degrade it. Failing fast there lets
        services/rag/retriever.py fall back to keyword-only search, which is a
        worse answer delivered in seconds instead of no answer at all.
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
                # Accumulate no more than the CURRENT rate's worth, not the
                # configured maximum: while backed off, letting a long idle
                # refill the bucket to the old ceiling would hand back exactly
                # the burst the backoff just took away.
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
# count — three in a row is enough to ride out a window boundary, few enough
# that a genuinely spent quota is noticed within a couple of minutes.
_MAX_QUOTA_RETRIES = 3

# How long the chat's per-question query embedding will wait for allowance
# before giving up and letting retrieval fall back to keyword-only. Short,
# because a user is watching a loading indicator.
_QUERY_MAX_WAIT_SECONDS = 2.5

_RETRY_DELAY_RE = re.compile(r"retry in ([0-9.]+)s", re.IGNORECASE)
# The 429 body names the exact quota it tripped. Distinguishing the two
# matters a lot: a per-minute wall clears in under a minute, a daily one does
# not clear meaningfully until the reset — and both arrive with a
# tens-of-seconds "retry in" hint, so the hint alone cannot tell them apart.
_DAILY_QUOTA_RE = re.compile(r"PerDay|RequestsPerDay", re.IGNORECASE)


def _suggested_retry_seconds(exc: BaseException) -> float | None:
    """Gemini's own "Please retry in 1.8s". Honouring it turns a recoverable
    throttle into a short pause instead of a deferred cycle."""
    match = _RETRY_DELAY_RE.search(str(exc))
    return float(match.group(1)) if match else None


def is_daily_quota_error(exc: BaseException) -> bool:
    return bool(_DAILY_QUOTA_RE.search(str(exc)))


def _normalise(vector: list[float]) -> list[float]:
    """Re-scale to unit length.

    Required, not optional: gemini-embedding-001 returns unit-normalised
    vectors ONLY at its native 3072 dimensions. Ask for fewer (Matryoshka
    truncation, which is what RAG_EMBEDDING_DIM does) and the result is a
    truncated prefix whose norm is < 1 and, crucially, VARIES with the text.
    Cosine distance in Postgres would then be comparing vectors of different
    lengths — google's own guidance is to re-normalise after truncating, and
    skipping it produces a ranking that is subtly, silently wrong rather than
    obviously broken.
    """
    norm = math.sqrt(sum(component * component for component in vector))
    if norm == 0.0:
        return vector
    return [component / norm for component in vector]


@retry(reraise=True, stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=20),
       retry=retry_if_exception(_should_retry))
async def _embed_batch(
    texts: list[str],
    task_type: str,
    max_wait: float | None = None,
) -> list[list[float]]:
    """Exactly ONE paced attempt. Retrying is the caller's job — see
    embed_documents, and this is not an arbitrary split.

    The counter-intuitive fact the whole design turns on, established live: **a
    rejected embedding request is still metered.** Measured directly — five
    50-text calls, 45 seconds apart, all rejected, and the provider's own
    suggested retry delay climbed monotonically with each one (16s, 30s, 45s,
    59s) instead of falling. A conventional retry loop, with a backoff schedule
    guessed in advance, makes this strictly worse the harder it tries.

    Retrying HERE has a second, subtler problem that is why the retry moved
    out: a 429 shrinks the pacing rate (see _TextBudget), but this function has
    already been handed a fixed list of texts, so a local retry would re-send
    the same oversized batch the reduced rate has just decided is too big. The
    caller can re-slice; this cannot.
    """
    global _cooldown_until

    budget = _get_budget()
    await budget.acquire(len(texts), max_wait=max_wait)
    try:
        vectors = await _embed_once(texts, task_type)
    except EmbeddingQuotaError as exc:
        if is_daily_quota_error(exc):
            # The DAILY budget, not the per-minute window. Its "retry in 43s"
            # hint describes a trickle refill, not real recovery — obeying it
            # would have the worker retry every minute for the rest of the day.
            wait_for = float(settings.RAG_EMBEDDING_DAILY_QUOTA_COOLDOWN_SECONDS)
            logger.warning(
                "[rag.embeddings] DAILY embedding quota is spent (free tier is 1000 "
                "texts/day). Standing down for %.0f minutes — indexing resumes "
                "automatically; already-indexed content keeps answering questions.",
                wait_for / 60,
            )
        else:
            hinted = _suggested_retry_seconds(exc)
            # No hint means we have no idea how deep the hole is; assume a full
            # window rather than optimistically resuming.
            wait_for = hinted if hinted is not None else 60.0
        _cooldown_until = max(_cooldown_until, time.monotonic() + wait_for + 2.0)
        budget.penalise()
        raise
    else:
        budget.reward()
        return vectors


async def _embed_once(texts: list[str], task_type: str) -> list[list[float]]:
    global _request_count
    client = _get_client()
    _request_count += 1

    logger.info(
        "[rag.embeddings] REQUEST #%d — %d text(s), task=%s, model=%s",
        _request_count, len(texts), task_type, settings.GEMINI_EMBEDDING_MODEL,
    )

    try:
        response = await client.aio.models.embed_content(
            model=settings.GEMINI_EMBEDDING_MODEL,
            contents=texts,
            config=genai_types.EmbedContentConfig(
                task_type=task_type,
                output_dimensionality=settings.RAG_EMBEDDING_DIM,
            ),
        )
    except Exception as exc:
        if isinstance(exc, ClientError) and getattr(exc, "code", None) == 429:
            logger.warning(
                "[rag.embeddings] LIMIT HIT — embedding model '%s' is out of free "
                "capacity right now (%s).",
                settings.GEMINI_EMBEDDING_MODEL,
                f"retry suggested in {_suggested_retry_seconds(exc):.1f}s"
                if _suggested_retry_seconds(exc) is not None else "no retry hint given",
            )
            raise EmbeddingQuotaError(str(exc)) from exc
        raise

    vectors = [list(embedding.values or []) for embedding in (response.embeddings or [])]

    # A response that silently returns a different number of vectors than we
    # sent texts would misalign EVERY chunk with someone else's embedding —
    # a corruption that produces plausible-looking but wrong retrieval forever
    # after, with nothing in the logs. This is exactly how `gemini-embedding-2`
    # behaves today (verified live: it collapses a batch into one vector), so
    # this check is a real guard, not a theoretical one.
    if len(vectors) != len(texts):
        raise EmbeddingError(
            f"Embedding model '{settings.GEMINI_EMBEDDING_MODEL}' returned "
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

    Batched at RAG_EMBEDDING_BATCH_SIZE because the API rejects more than 100
    contents per request (verified live — 120 returns INVALID_ARGUMENT).
    Batching cuts HTTP round-trips, but note it buys nothing against the free
    tier's quota, which counts texts rather than calls — the pacing in
    _embed_batch is what keeps this inside the limit. A large index cycle is
    therefore bounded by minutes, not by request count, which is why
    RAG_MAX_CHUNKS_PER_CYCLE exists.
    """
    if not texts:
        return []

    vectors: list[list[float]] = []
    budget = _get_budget()
    start = 0
    # CONSECUTIVE failures, reset by every success. Counting total failures
    # instead aborts a run that is genuinely making progress: on a heavily
    # throttled key the controller settles into "one small batch succeeds,
    # occasionally one is rejected", and a total counter turns that steady
    # crawl into a stop after the third hiccup — even with hundreds of chunks
    # already safely embedded.
    consecutive_quota_failures = 0

    while start < len(texts):
        # Recomputed every iteration, not once up front: the bucket's capacity
        # moves as it tunes itself (see _TextBudget). That is what makes the
        # retry below meaningful — after a 429 the rate has halved, so the
        # SAME offset is retried with a smaller batch rather than re-sending
        # the size that was just rejected.
        batch_size = max(1, min(settings.RAG_EMBEDDING_BATCH_SIZE, 100, budget.capacity))
        try:
            vectors.extend(await _embed_batch(texts[start:start + batch_size], "RETRIEVAL_DOCUMENT"))
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
    """Embed ONE user question for SEARCH. See the module docstring for why
    this cannot just call embed_documents with a one-item list.

    Impatient by design: a person is waiting. If the allowance is more than a
    couple of seconds away this raises rather than blocking, and
    services/rag/retriever.py degrades to keyword-only search — see
    _TextBudget.acquire for why that is the right trade on this path and the
    wrong one for indexing.
    """
    vectors = await _embed_batch([text], "RETRIEVAL_QUERY", max_wait=_QUERY_MAX_WAIT_SECONDS)
    return vectors[0]
