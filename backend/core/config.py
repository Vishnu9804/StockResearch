import os
from pydantic_settings import BaseSettings
from typing import List

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_file_path = os.path.join(base_dir, ".env")

class Settings(BaseSettings):
    PORT: int = 8000
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "info"

    DATABASE_URL: str = ""

    SUPABASE_URL: str = "https://csejxkjmxdqmemfurkgn.supabase.co"
    SUPABASE_JWT_SECRET: str = "4q2S/EDA+MpZMYwt3x9T9J8NKwz5a1/jRBJR+PALYi4Lf6e2gtVKjv5CJz7DZjpCwUil954FSU6sGdZI1bzB3Q=="
    # Add the Anon Key so the backend can securely pass the firewall
    SUPABASE_ANON_KEY: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzZWp4a2pteGRxbWVtZnVya2duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NDIxMjIsImV4cCI6MjA5ODQxODEyMn0.ouY8pWXsaoCVW7pBhivvysPrpk-TsOIBK2Ac9wnO_AA"
    
    FINEDGE_API_KEY_1: str = "demo-key-1"
    FINEDGE_API_KEY_2: str = "demo-key-2"
    FINEDGE_API_KEY_3: str = "demo-key-3"
    FINEDGE_BASE_URL: str = "https://data.finedgeapi.com"
    FRONTEND_URL: str = "http://localhost:3000"

    # ── FinEdge rate limit (Phase 0) ──────────────────────────────────────────
    # FinEdge allows 300 API calls/minute. Every outbound FinEdge call passes
    # through a global token bucket (core/rate_limiter.py) so this is never
    # exceeded — across the proxy AND the background sync. SAFETY keeps us under
    # the hard cap (bursts + retries need headroom); BURST is the bucket size
    # that smooths short spikes.
    FINEDGE_MAX_CALLS_PER_MINUTE: int = 300
    FINEDGE_RATE_LIMIT_SAFETY: float = 0.9
    FINEDGE_RATE_LIMIT_BURST: int = 10

    # ── Shared cache (Phase 2) ────────────────────────────────────────────────
    # When set (e.g. "redis://localhost:6379/0"), the FinEdge proxy cache is
    # stored in Redis so every web worker/server shares ONE cache — a single
    # upstream call serves all of them. When empty, or if Redis is unreachable,
    # the service transparently falls back to a per-process in-memory cache.
    REDIS_URL: str = ""

    # ── Background sync ownership (Phase 1) ───────────────────────────────────
    # The FinEdge → company_metrics sync must run in exactly ONE process. In
    # local/single-process dev this can stay True. In production run the web
    # app with ENABLE_BACKGROUND_SYNC=false (any number of workers) and run the
    # dedicated `python sync_worker.py` process exactly once instead.
    ENABLE_BACKGROUND_SYNC: bool = True

    # ── News (marketaux) ──────────────────────────────────────────────────────
    # Sole news provider (12 Aug 2026 vendor review — marketaux over mediastack
    # and WorldAPI): mediastack's India "business" coverage turned out to be a
    # re-serve of the same free Google News RSS this app used to fetch itself,
    # and WorldAPI bills per-call in crypto (no ordinary subscription exists to
    # buy). marketaux is purpose-built for market news — every article carries
    # per-company sentiment, industry and match-confidence, which is what
    # services/news_ingest.py stores in NewsItem.mentioned_entities.
    # Empty by default so a fresh checkout never calls a paid API unset.
    MARKETAUX_API_KEY: str = ""
    # Articles returned per themed query (services/news_sources/marketaux_client.py).
    # 50 matches the "Pro 10K" plan (the recommended tier) — raise only after
    # confirming the purchased plan's per-request article cap, a lower-tier key
    # (e.g. Free's cap of 3) will get this rejected with a 422.
    MARKETAUX_ARTICLES_PER_REQUEST: int = 50

    # ── News retention ─────────────────────────────────────────────────────────
    # Deliberately a TIME window, never a row-count cap. A count cap (e.g. "keep
    # the newest 5000 rows") would let one unusually high-volume news day evict
    # yesterday's stories entirely — a quiet news day right after a busy one
    # would otherwise lose history that's still well within any sane retention
    # window. Time-based retention makes "how old" the only thing that decides
    # deletion, independent of how many articles arrived on any given day.
    NEWS_RETENTION_DAYS: int = 21

    # ── Multi-agent workflows (Google ADK + Gemini) ───────────────────────────
    # A single Gemini key drives every agent in every workflow under agents/.
    # Empty by default so a fresh checkout never accidentally spends a token —
    # every worker below checks this and idles (with a log warning) until it's set.
    GEMINI_API_KEY: str = ""

    # Model ids every workflow shares — see agents/shared/llm.py.
    #
    # Published free-tier tables are NOT reliable here — this project's own
    # AI Studio rate-limit dashboard (checked directly, Aug 2026) showed wildly
    # different real per-model daily caps than generic docs suggest:
    #   gemini-2.5-flash        20 RPD
    #   gemini-2.5-flash-lite   20 RPD
    #   gemini-3.6-flash        20 RPD
    #   gemini-3.5-flash-lite  500 RPD   <- the real outlier, verified live
    # gemini-3.5-flash-lite's real 500 RPD (25x the others on THIS account) is
    # why it's the cheap/high-volume model despite 3.x's generic free-tier
    # flakiness reports — always re-check the live dashboard
    # (aistudio.google.com/rate-limit) before assuming a number from docs.
    #
    # gemini-3.6-flash over gemini-2.5-flash for the smart tier because
    # 2.5-flash is scheduled for deprecation 2026-10-16 (verified live,
    # Aug 2026) — no reason to build fresh reliance on a model with a set
    # expiry date when a same-quota, non-deprecating alternative exists.
    #
    # Once the client's billed key is in place, RPD stops being the
    # constraint and this can be revisited purely on $/token and quality —
    # see the cost comment on THINKING_LEVEL_SMART below for the other half
    # of that tradeoff.
    GEMINI_MODEL_CHEAP: str = "gemini-3.5-flash-lite"
    GEMINI_MODEL_SMART: str = "gemini-3.5-flash-lite"

    # ── Thinking budget (cost + reliability control) ─────────────────────────
    # Both models think by default with an unbounded/dynamic budget, and
    # thinking tokens bill as output tokens — on the smart model in
    # particular this makes real cost unpredictable (verified live: Gemini's
    # own docs confirm "Auto" thinking on Flash-tier models, billed at the
    # output-token rate). agents/shared/llm.py applies these via
    # generate_content_config on every LlmAgent so it's one switch for the
    # whole workflow, not something to remember per-agent.
    #
    # MINIMAL for the cheap model: every cheap-tier step (triage, thematic
    # trigger, both extractors) is classification/extraction, not judgment —
    # thinking adds cost and latency without adding accuracy here, and a
    # bounded-low level also avoids the known failure mode where an
    # unbounded thinking pass consumes the entire output-token budget and
    # returns an empty response (github.com/valentinfrlch/ha-llmvision#609).
    #
    # MEDIUM for the smart model: causal-chain analysis and adversarial
    # skepticism are exactly the judgment calls thinking helps with, so this
    # is deliberately NOT disabled — just bounded, so cost stays predictable
    # instead of "however much the model decides."
    #
    # NOTE — model-family coupling: `thinking_level` (MINIMAL/LOW/MEDIUM/HIGH)
    # is the Gemini 3.x mechanism. The 2.x family (e.g. gemini-2.5-flash)
    # does NOT support it and errors on "thinking_level not supported" — if
    # GEMINI_MODEL_CHEAP/SMART ever point back at a 2.x model, agents/shared/
    # llm.py's generation configs must switch to the numeric `thinking_budget`
    # field instead (0 = disabled, -1 = automatic, else a fixed token count).
    THINKING_LEVEL_CHEAP: str = "MINIMAL"
    THINKING_LEVEL_SMART: str = "MEDIUM"

    # How long ANY worker that calls Gemini (butterfly, company profiler) pauses
    # after hitting a 429 RESOURCE_EXHAUSTED before trying again — long enough
    # to stop hammering a quota that's already at zero (see agents/shared/
    # adk_runner.py), short enough that a transient/short-lived throttle still
    # recovers within a session. Shared across workflows since they draw on the
    # same per-model daily quota.
    GEMINI_QUOTA_COOLDOWN_SECONDS: int = 90

    # ── Butterfly Effect workflow: per-news causal analysis (O1) + thematic
    # research (O2), scored against portfolios in plain Python. ──────────────
    # Same single-owner rule as ENABLE_BACKGROUND_SYNC: run this inline for
    # local/single-process dev, or disable it here and run the dedicated
    # `python butterfly_worker.py` process exactly once in production.
    ENABLE_BUTTERFLY_WORKER: bool = False

    BUTTERFLY_POLL_BATCH_SIZE: int = 5
    BUTTERFLY_POLL_INTERVAL_IDLE_SECONDS: int = 30
    BUTTERFLY_POLL_INTERVAL_BUSY_SECONDS: int = 2
    BUTTERFLY_MAX_ANALYSIS_ATTEMPTS: int = 3

    # Optional backlog cutoff — ISO timestamp, e.g. "2026-07-27T02:00:00+00:00".
    # Empty (default) means "process everything queued, oldest included" —
    # the correct behaviour for a real production launch, which should work
    # through its backlog once and then stay caught up.
    # Set this to right-now before a local test run and the worker will only
    # ever pick up news ingested from that moment forward, so flipping the
    # switch on a table that already has weeks of history can never trigger a
    # mass backfill that burns through your token/API budget. Same code path
    # in dev and prod — only the value differs.
    BUTTERFLY_ANALYSIS_MIN_INGESTED_AT: str = ""

    # Manual test-mode allowlist — comma-separated news_items.id UUIDs.
    # Empty (default, production behaviour) means this does nothing at all;
    # every filter above (status/attempts/cutoff/batch size/ordering) applies
    # exactly as written. When set, agents/butterfly/worker.py's _claim_batch
    # skips those filters entirely and claims ONLY the listed rows (still
    # respecting analysis_status so an already-ANALYZED test row isn't
    # reprocessed every poll) — for manually exercising the full pipeline
    # against a small, known set of news items without the worker picking up
    # anything else from the table and burning quota on it. Clear this env var
    # to instantly return to real production behaviour; no code edit needed.
    BUTTERFLY_TEST_NEWS_IDS: str = ""

    # False (default) = real production behaviour: thematic research always
    # runs its full researcher_agent (google_search grounded) step. Set True
    # only when the Gemini key's project has no grounding quota available
    # (grounding requires billing enabled on the project — see agents/
    # butterfly/pipeline.py:_run_thematic_research) — the pipeline still runs
    # the free thematic_trigger_agent classification (no search tool, no
    # billing needed) and logs its verdict, it just stops BEFORE the
    # guaranteed-to-429 grounded call instead of retrying it forever. Flip
    # back to False the moment the key's project has real grounding quota.
    BUTTERFLY_SKIP_GROUNDED_RESEARCH: bool = False

    # Second, smarter gate after the ingestion-time heuristic floor — a cheap
    # model reads the actual article and kills anything the heuristic let
    # through that still isn't a real, market-moving event.
    BUTTERFLY_TRIAGE_SIGNIFICANCE_FLOOR: float = 0.35

    # Per-user alert severity thresholds (see services/butterfly_scorer.py).
    BUTTERFLY_RED_THRESHOLD: float = 0.65
    BUTTERFLY_ORANGE_THRESHOLD: float = 0.45
    BUTTERFLY_YELLOW_THRESHOLD: float = 0.30

    # Flood control: caps how many alerts one news item can generate for one
    # user, and how many RED alerts one user can receive in a day, so "the
    # market is entirely connected" can never turn into an inbox of all-RED.
    BUTTERFLY_MAX_ALERTS_PER_NEWS_PER_USER: int = 3
    BUTTERFLY_MAX_RED_PER_USER_PER_DAY: int = 5

    # ── Company Profiler workflow: builds company_exposure_profiles (Phase 2)
    # OFFLINE, once per company, NOT per news and NOT per user. This is what
    # lets services/butterfly_scorer.py compute a precise, side-aware
    # materiality/direction for a held company instead of a sector-level
    # guess — see agents/company_profiler/. ─────────────────────────────────
    ENABLE_COMPANY_PROFILER_WORKER: bool = False

    COMPANY_PROFILER_POLL_BATCH_SIZE: int = 3
    # Rare, deliberately slow cadence — this workflow refreshes a handful of
    # held companies, not a news firehose. There is no urgency to react to.
    COMPANY_PROFILER_POLL_INTERVAL_IDLE_SECONDS: int = 300
    # A profile older than this is treated as stale and re-built. Company
    # cost/revenue structure genuinely doesn't change week to week.
    COMPANY_PROFILER_REFRESH_DAYS: int = 90

    # Both this worker and agents/butterfly/worker.py share the cheap model's
    # per-MINUTE request limit — a separate, much smaller cap than the daily
    # one. Without this, both workers fire their first call within a second of
    # each other at app boot, which is on its own enough to trip that
    # per-minute limit before either has done any real work. See agents/
    # company_profiler/worker.py.
    COMPANY_PROFILER_STARTUP_STAGGER_SECONDS: int = 20

    # ── Research Chat: RAG index ──────────────────────────────────────────────
    # The retrieval corpus behind agents/research_chat/. Built by
    # services/rag/indexer.py into rag_documents + rag_chunks (migration
    # 003_rag_and_research_chat.sql), and READ on every chat question.
    #
    # Embedding model: gemini-embedding-001. Verified live against this
    # project's own key (Aug 2026) rather than taken from docs — the newer
    # `gemini-embedding-2` is listed as available but silently collapses a
    # BATCH of N texts into ONE vector, which would corrupt the index without
    # raising anything. gemini-embedding-001 batches correctly (hard API cap:
    # 100 texts per request, also verified) and is the only embedding model
    # here that can be trusted with bulk indexing.
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"

    # 768 via Matryoshka truncation of the model's native 3072, re-normalised
    # to unit length afterwards (see services/rag/embeddings.py). 768 keeps the
    # HNSW index ~4x smaller and ~4x faster to probe for a retrieval-quality
    # difference that is negligible at this corpus size.
    #
    # HARD COUPLING: rag_chunks.embedding is declared vector(768) in migration
    # 003. Changing this number without a matching migration fails loudly at
    # insert time — deliberately, since a silently mixed-dimension index would
    # return quietly wrong neighbours instead of an error.
    RAG_EMBEDDING_DIM: int = 768
    # Well under the API's hard 100-contents-per-request cap on purpose. The
    # quota below is a SLIDING per-minute window, and spending it in two
    # near-maximal gulps sits exactly on the window edge — verified live: 90 +
    # 90 sixty seconds apart still 429s, because the first 90 have not all
    # aged out at the instant the second batch fires. Smaller batches let the
    # token bucket spread the same throughput smoothly instead of in spikes
    # that collide with the window boundary.
    RAG_EMBEDDING_BATCH_SIZE: int = 50

    # ── The two embedding quotas, both verified live from the 429 bodies
    # against this project's own key (Aug 2026). Neither matches what a
    # generic docs table would tell you, and BOTH count every TEXT in a batch
    # rather than every HTTP call — so batching helps latency and HTTP
    # overhead but buys nothing at all against either limit.
    #
    #   PER MINUTE   quotaId EmbedContentRequestsPerMinutePerUser...
    #                limit 100. This is what the pacing below defends.
    #
    #   PER DAY      quotaId EmbedContentRequestsPerDayPerUserPerProjectPerModel-FreeTier
    #                limit 1000. THIS is the one that actually constrains a
    #                free-tier build-out, and it is easy to miss because it
    #                surfaces as the same 429 with the same shape.
    #
    # What 1000/day means in practice, and it is worth internalising before
    # tuning anything here:
    #   - help topics + exposure profiles + fundamentals  ~25 embeddings. Free.
    #   - one company's last two concall transcripts      ~130 embeddings.
    #   - the whole 21-day news window (~2900 articles)   ~2900 — three days.
    #   - one user question                               1.
    # So on a free key the news corpus is a multi-day backfill, which is
    # exactly why services/rag/index_worker.py indexes it LAST and why
    # RAG_MAX_CHUNKS_PER_CYCLE exists. A billed key removes the ceiling.
    #
    # SAFETY is far below the 0.9 used for FinEdge, for a reason specific to
    # this endpoint: a REJECTED embedding request is still metered (verified —
    # five throttled calls 45s apart produced monotonically INCREASING
    # retry-after hints, 16s/30s/45s/59s). Overshooting doesn't cost one
    # wasted call, it compounds, and no retry strategy digs out of it — only
    # waiting does. Note this is only the STARTING rate: services/rag/
    # embeddings.py tunes itself down from here whenever the key can't sustain
    # it, and back up when it can.
    RAG_EMBEDDING_TEXTS_PER_MINUTE: int = 100
    RAG_EMBEDDING_RATE_SAFETY: float = 0.6

    # How long to stand down when the DAILY quota (not the per-minute one) is
    # the wall that was hit. The provider's suggested retry delay is useless
    # in that case — it reports the trickle-refill interval, tens of seconds,
    # which would have a worker retry hundreds of times against a budget that
    # does not meaningfully return until the daily reset.
    RAG_EMBEDDING_DAILY_QUOTA_COOLDOWN_SECONDS: int = 3600

    # Ceiling on how many chunks ONE index cycle may embed. At ~60 texts per
    # minute (above), 300 chunks is roughly a five-minute cycle — bounded
    # enough that POST /api/chat/index/run returns in a sensible time and a
    # first run on a large backlog makes visible progress instead of appearing
    # to hang. Whatever is left over is picked up by the next cycle, because
    # an un-indexed document's hash simply hasn't moved yet.
    RAG_MAX_CHUNKS_PER_CYCLE: int = 300

    # Chunking. Concall transcripts are the only genuinely long source (20-40
    # page PDFs); everything else is already a short, self-contained record.
    # ~1400 chars ≈ 350 tokens — small enough that a retrieved chunk is mostly
    # signal, large enough to keep a full question-and-answer exchange from an
    # earnings call together. The overlap is what stops an answer that
    # straddles a boundary from being cut in half.
    RAG_CHUNK_CHARS: int = 1400
    RAG_CHUNK_OVERLAP_CHARS: int = 220

    # ── Research Chat: what gets indexed, and how much per cycle ─────────────
    # News is capped by AGE, not count, for the same reason NEWS_RETENTION_DAYS
    # is: a count cap lets one busy news day evict the previous week entirely.
    RAG_NEWS_MAX_AGE_DAYS: int = 21
    # Per-cycle ceiling so the very first run on a table that already holds
    # thousands of articles spreads its embedding calls over several cycles
    # instead of firing them all at once.
    RAG_NEWS_BATCH_SIZE: int = 600
    # How many concall transcript PDFs to pull per company. Transcripts are by
    # far the heaviest corpus — a single 40-page call is ~70 chunks, so 2 per
    # company is already ~140 chunks each against the 100-texts-per-minute
    # ceiling above. Two covers "the last call" and "the one before", which is
    # what almost every management-commentary question is actually about.
    # Raise it once the key is billed and minutes stop being the constraint.
    RAG_TRANSCRIPTS_PER_SYMBOL: int = 2
    # Hard ceiling on transcript PDF size — a 40-page concall is ~1-2 MB;
    # anything far past that is a scanned annual report misfiled as a
    # transcript and would cost tokens for no retrievable text.
    RAG_TRANSCRIPT_MAX_BYTES: int = 12 * 1024 * 1024

    # When a question names a company that has nothing indexed yet, index it
    # right then (fundamentals + its recent transcripts) before answering,
    # instead of replying "I don't have data on that". This is what lets the
    # chat cover all ~6700 symbols in company_metrics without pre-indexing all
    # of them — the corpus grows to fit what users actually ask about.
    # ON_DEMAND_* bound the extra latency that first question pays.
    RAG_ON_DEMAND_ENABLED: bool = True
    RAG_ON_DEMAND_TRANSCRIPTS: int = 2
    RAG_ON_DEMAND_TIMEOUT_SECONDS: int = 45

    # ── Company document index (services/document_sync.py) ───────────────────
    # Populates company_documents — "what PDFs does FinEdge have for this
    # company" — for EVERY listed company, not just held/watched ones. This is
    # what GET /company/{symbol}/documents serves from (the company page's
    # Documents tab) and what services/rag/sources/transcript_source.py checks
    # BEFORE ever calling FinEdge live, so the first chat question about a new
    # company skips a whole discovery round trip.
    #
    # Cadence reasoning: real filings appear on the order of MONTHS — Indian
    # listcos file quarterly results/concalls roughly 4x/year (within ~45 days
    # of quarter end, per SEBI LODR) and one annual report a year. A full
    # sweep of the ~6700-symbol universe at BATCH_SIZE every
    # INTERVAL_OPEN/CLOSED_SECONDS completes well within a single day even at
    # the slower, market-hours rate — comfortably faster than filings actually
    # change, so this never needs to "guess" a company's exact result date
    # (which slips and varies) the way a hardcoded earnings-season scheduler
    # would. It just needs to be faster than "once a quarter," which a daily
    # sweep is by a wide margin.
    #
    # Same market-hours courtesy as FUNDAMENTALS_SYNC_INTERVAL_* in
    # services/sync_service.py: back off while the market is open so live user
    # requests get priority on the shared 300/min FinEdge budget, and work
    # through the universe faster once it's closed.
    ENABLE_DOCUMENT_SYNC: bool = True
    DOCUMENT_SYNC_BATCH_SIZE: int = 25
    DOCUMENT_SYNC_INTERVAL_OPEN_SECONDS: int = 180
    DOCUMENT_SYNC_INTERVAL_CLOSED_SECONDS: int = 30
    # A document set older than this is treated as stale and re-swept, even if
    # nothing else prompted it — the floor under the "once a quarter" filing
    # cadence above, generous enough that it never re-fetches a company that
    # was just synced minutes ago by the rolling batch.
    DOCUMENT_REFRESH_DAYS: int = 3

    # Background index worker — same single-owner rule as every other worker in
    # this codebase (see ENABLE_BACKGROUND_SYNC). Run inline in single-process
    # dev, or as the dedicated `python rag_index_worker.py` process in prod.
    # Off by default so a fresh checkout never spends embedding quota it wasn't
    # asked to; POST /api/chat/index/run does one cycle on demand instead.
    ENABLE_RAG_INDEX_WORKER: bool = False
    RAG_INDEX_INTERVAL_SECONDS: int = 900
    RAG_INDEX_STARTUP_STAGGER_SECONDS: int = 40

    # ── Research Chat: retrieval + answering ─────────────────────────────────
    # Hybrid retrieval: an ANN pass and a Postgres full-text pass, fused with
    # Reciprocal Rank Fusion. Both halves matter — vector search alone misses
    # exact identifiers (a symbol, "PAT", "Q3FY26"), keyword search alone
    # misses paraphrase ("is the company burning cash?" vs "negative operating
    # cash flow"). CANDIDATES is how deep each half looks BEFORE fusion.
    RAG_VECTOR_CANDIDATES: int = 40
    RAG_KEYWORD_CANDIDATES: int = 40
    RAG_RRF_K: int = 60
    # How many chunks survive re-ranking and actually reach the model.
    RAG_CONTEXT_CHUNKS: int = 12
    # ...bounded again by raw size, because chunk count alone doesn't bound
    # cost — this is the real spend ceiling per question.
    RAG_CONTEXT_MAX_CHARS: int = 22000
    # Max chunks any ONE document may contribute, so a single 40-page
    # transcript can't crowd out every other source for a broad question.
    RAG_MAX_CHUNKS_PER_DOC: int = 4

    # Answering model. Deliberately its own setting rather than reusing
    # GEMINI_MODEL_CHEAP/SMART: this is the only user-facing, unmetered,
    # per-question call in the product (every other Gemini call in this
    # codebase is offline batch work), so its cost/quality tradeoff is a
    # different decision from the workflows' and must be tunable on its own.
    #
    # flash-lite is the right tier for a RAG chat specifically: retrieval has
    # already done the hard part (finding the right facts), leaving the model
    # a grounded summarisation job rather than an open-ended reasoning one.
    # Accuracy here is bought with retrieval quality and citations, not with a
    # bigger model.
    GEMINI_MODEL_CHAT: str = "gemini-3.5-flash-lite"
    # LOW, not MINIMAL: the model still has to weigh several retrieved sources
    # against each other and notice when they disagree. Not MEDIUM/HIGH —
    # thinking tokens bill as output and this call runs on every message.
    THINKING_LEVEL_CHAT: str = "LOW"

    # How many previous turns are replayed to the model. The full thread stays
    # in the database and on screen; only this many are sent, so a long
    # conversation's cost stays flat instead of growing every turn.
    CHAT_HISTORY_TURNS: int = 6
    # Newest N threads kept per user; older ones are deleted when a new thread
    # is created (routers/chat.py). Matches the "stack of last 10" the UI shows.
    CHAT_MAX_CONVERSATIONS_PER_USER: int = 10
    CHAT_MAX_QUESTION_CHARS: int = 2000

    @property
    def FINEDGE_API_KEYS(self) -> List[str]:
        return [self.FINEDGE_API_KEY_1, self.FINEDGE_API_KEY_2, self.FINEDGE_API_KEY_3]

    class Config:
        env_file = env_file_path
        extra = "ignore"

settings = Settings()