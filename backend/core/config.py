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

    # ── Multi-agent workflows (Google ADK, running entirely on ZLM) ────────────
    # Every LlmAgent in every workflow under agents/ runs on ZLM (Zhipu AI /
    # Z.ai's GLM models), routed through ADK's LiteLlm wrapper — see agents/
    # shared/llm.py. ZLM_API_KEY is the ONLY model spend in this codebase.
    #
    # Gemini used to have a foothold here: ADK's built-in google_search tool
    # (used by butterfly's researcher_agent and company_profiler's
    # profiler_agent) is hard-coded Gemini-only (google/adk/tools/
    # google_search_tool.py raises ValueError for any other model), and that
    # tool also needs Google Cloud billing enabled for real use (verified live,
    # Aug 2026: 5,000 free grounded prompts/month on Gemini 3.x, then billed
    # per query) — exactly the kind of second, harder-to-predict spend this
    # project intentionally avoids. Both agents were moved onto ZLM instead:
    # agents/shared/zlm_web_search.py calls Z.ai's own web_search REST endpoint
    # BEFORE either agent runs, and the results are handed to the agent as
    # plain prompt text — see agents/butterfly/pipeline.py and agents/
    # company_profiler/pipeline.py. RAG embeddings (below) made the same move,
    # to Zhipu's embedding-3. Nothing left in this codebase ever calls Gemini.
    #
    # Empty by default so a fresh checkout never accidentally spends a token —
    # every worker below checks this and idles (with a log warning) until
    # it's set.
    ZLM_API_KEY: str = ""

    # Z.ai's web_search endpoint (agents/shared/zlm_web_search.py) — the
    # replacement for ADK's google_search tool, called directly rather than
    # through the agent/tool-calling machinery (verified live, Aug 2026: it's
    # a standalone REST endpoint, not a model-invoked function-calling tool).
    ZLM_WEB_SEARCH_ENGINE: str = "search-prime"
    # Per query. butterfly's researcher_agent runs this once per suggested
    # search query (up to 4); company_profiler's profiler_agent runs it across
    # 3 fixed queries covering the different facts it needs (see that
    # pipeline). Kept modest — each extra result is more prompt tokens for a
    # step that already runs on the smart/cheap tier, not more accuracy past a
    # point.
    ZLM_WEB_SEARCH_RESULT_COUNT: int = 6

    # Cheap tier: classification/extraction only, never judgment — triage,
    # thematic trigger, both extractors (butterfly's thematic_extractor,
    # company_profiler's extractor). glm-4.7-flashx: ~$0.06/1M input,
    # ~$0.40/1M output (verified live via Z.ai's own pricing page + two
    # independent trackers, Aug 2026) — Z.ai's cheapest PAID (non-rate-capped)
    # SKU, 200K context, no free-tier concurrency ceiling.
    ZLM_MODEL_CHEAP: str = "glm-4.7-flashx"

    # Smart tier: causal-chain analysis and adversarial skepticism — the
    # judgment calls thinking is actually for. glm-4.7: $0.60/1M input,
    # $2.20/1M output (verified live, Aug 2026) — same price as glm-4.6 but a
    # strict upgrade on reasoning/tool-use benchmarks (+12.4% HLE, +5.8%
    # SWE-bench per Z.ai's own release notes), so there's no cost reason to
    # pick the older model here.
    ZLM_MODEL_SMART: str = "glm-4.7"

    # Chat tier — see GLM's own setting further down for why this is separate
    # from CHEAP/SMART. glm-4.5-air: $0.20/1M input, $1.10/1M output (verified
    # live, Aug 2026). Deliberately ONE tier above the cheapest available
    # (glm-4.7-flashx) even though the RAG pipeline hands this step
    # already-retrieved facts, not open-ended reasoning: this is the one call
    # in the whole product a real client sees the raw output of, and the
    # extra tier costs a fraction of a rupee per question at this context size
    # — not worth trading for a visible quality gap on the surface that forms
    # the client's actual impression of the product.
    ZLM_MODEL_CHAT: str = "glm-4.5-air"

    # ── ZLM thinking mode ──────────────────────────────────────────────────────
    # GLM's API only exposes a binary switch (thinking: {type: enabled|
    # disabled} in the request body — see agents/shared/llm.py), not a
    # graduated level. Off where the step is classification/extraction (cost +
    # latency with no accuracy upside), on where it's a real judgment call.
    ZLM_THINKING_CHEAP: bool = False
    ZLM_THINKING_SMART: bool = True
    # Off, not on: the chat model's job is grounded summarisation over
    # passages retrieval already selected (see agents/research_chat/
    # pipeline.py's module docstring), not open-ended reasoning. Thinking
    # tokens would bill as output on every single user question for a
    # reasoning step this call doesn't need.
    ZLM_THINKING_CHAT: bool = False

    # How long ANY worker that calls an LLM (butterfly/company profiler on
    # ZLM, the RAG index worker on Zhipu embeddings) pauses after hitting a
    # 429 before trying again — long enough to stop hammering a rate limit
    # that just tripped (see agents/shared/adk_runner.py), short enough that a
    # transient/short-lived throttle still recovers within a session.
    LLM_QUOTA_COOLDOWN_SECONDS: int = 90

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
    # runs its full web-search-grounded researcher_agent step (agents/shared/
    # zlm_web_search.py + agents/butterfly/pipeline.py:_run_thematic_research).
    # Historically this existed to skip Gemini's google_search, which needed
    # Google Cloud billing to work at all — that billing gate no longer
    # applies now that this step runs on ZLM's own web_search instead, so
    # there's no longer a structural reason to leave this on. The pipeline
    # still runs the cheap thematic_trigger_agent classification either way
    # and logs its verdict; setting this True just stops it BEFORE the
    # (now working) grounded call.
    BUTTERFLY_SKIP_GROUNDED_RESEARCH: bool = False

    # Second, smarter gate after the ingestion-time heuristic floor — a cheap
    # model reads the actual article and kills anything the heuristic let
    # through that still isn't a real, market-moving event.
    BUTTERFLY_TRIAGE_SIGNIFICANCE_FLOOR: float = 0.35

    # Per-user alert severity thresholds (see services/butterfly_scorer.py).
    #
    # CALIBRATED EMPIRICALLY (Aug 2026) against real pipeline output, not
    # picked a priori. The scorer's severity number is the product of SEVEN
    # independent 0-1 terms (materiality x attenuation x directness x
    # confidence x novelty x significance x position), so it does not spread
    # across 0-1 the way a single-factor score would — seven terms averaging
    # ~0.8 already land at 0.21. Measured over the first real run (15 analyses
    # x this project's 8-symbol test portfolio): max 0.67, median 0.13,
    # min 0.08.
    #
    # The old 0.65/0.45/0.30 values were a priori guesses on a 0-1 scale, and
    # against the formula's real distribution they meant only a single
    # near-perfect case (direct hit + tier-1 source + 0.9 significance + zero
    # hop attenuation) could ever clear even YELLOW — a crude-price shock
    # scored against a refiner's own VERIFIED crude exposure came out at 0.24
    # and produced no alert at all, which is plainly the wrong answer.
    #
    # These map to what each tier is supposed to MEAN under this formula:
    #   RED    >= 0.40  direct, material, high-significance hit on a real holding
    #   ORANGE >= 0.24  solid, material exposure worth reading today
    #   YELLOW >= 0.11  real but second-order — worth knowing, not acting on
    #
    # RED is deliberately set against the VERIFIED tier's range, not the
    # NAMED tier's. The two are not on the same scale: NAMED assumes the
    # maximum possible materiality (1.0) because the article is about that
    # company, while VERIFIED uses the company's OWN measured exposure, which
    # is a real fraction and therefore almost never near 1.0. So the tier the
    # system trusts most systematically produces SMALLER numbers than the tier
    # it trusts less. Calibrating RED off NAMED-inflated scores would mean a
    # fully verified, measured, correctly-signed hit could effectively never
    # be RED, while an unverified name-match routinely could — backwards.
    # Measured example: a surprise 50bp RBI cut against a bank whose profile
    # documents a +0.5 rate sensitivity, held at ~15% of the portfolio, scores
    # 0.43 — that is unambiguously a "read this first" alert and must be RED.
    # This also matters more over time, not less: as company_exposure_profiles
    # fills in, VERIFIED becomes the common path and NAMED the fallback.
    # Re-measure these (a scoring dry-run over news_impact_analyses needs no
    # LLM calls at all) if the formula's terms are ever changed again.
    BUTTERFLY_RED_THRESHOLD: float = 0.40
    BUTTERFLY_ORANGE_THRESHOLD: float = 0.24
    BUTTERFLY_YELLOW_THRESHOLD: float = 0.11

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
    # 003_rag_and_research_chat.sql / 005_zlm_embeddings.sql), and READ on
    # every chat question.
    #
    # Embedding model: Zhipu's embedding-3, paid via ZLM_API_KEY — the same
    # provider as every LLM call in this codebase (see the "Multi-agent
    # workflows" comment above for why Gemini's embeddings were dropped
    # entirely: its free tier hard-caps at 1000 embeddings/day, which is not
    # remotely enough to keep a growing PDF/news/transcript corpus current for
    # a chatbot in real use). embedding-3's `dimensions` parameter accepts any
    # value from 256-2048 (verified against Zhipu's own API docs, Aug 2026),
    # so — unlike Gemini's Matryoshka-truncated 768 — this is a native
    # request, not a truncation of a larger vector.
    ZLM_EMBEDDING_MODEL: str = "embedding-3"

    # 1024: comfortably under pgvector's hard 2000-dimension ceiling for an
    # indexable column (HNSW/IVFFlat both refuse to build past that — verified
    # against pgvector's own docs, Aug 2026: every index tuple has to fit in
    # an 8KB Postgres page), while still holding meaningfully more signal per
    # vector than the old 768. 2048 (embedding-3's max) was ruled out for
    # exactly that pgvector ceiling — it can be STORED as an un-indexed
    # column but never searched with HNSW, which would defeat the entire
    # point of this table.
    #
    # HARD COUPLING: rag_chunks.embedding is declared vector(1024) in
    # migration 005. Changing this number without a matching migration fails
    # loudly at insert time — deliberately, since a silently mixed-dimension
    # index would return quietly wrong neighbours instead of an error.
    RAG_EMBEDDING_DIM: int = 1024
    # Under embedding-3's hard 64-texts-per-request cap (verified against
    # Zhipu's own API docs, Aug 2026 — a lower ceiling than Gemini's old 100).
    RAG_EMBEDDING_BATCH_SIZE: int = 60

    # Starting point for services/rag/embeddings.py's self-tuning pacer — NOT
    # verified live against a real Zhipu key the way the old Gemini numbers in
    # this file used to be (that took this project actually hitting 429s on a
    # live key; nothing here has been exercised against one yet). Deliberately
    # picked as a reasonable middle rather than an aggressive one: the pacer
    # halves on any rejection and climbs back gradually on success, so a wrong
    # starting number costs a few minutes of self-correction, never a hard
    # failure — see services/rag/embeddings.py's _TextBudget for the mechanism.
    # Re-verify against Z.ai's own rate-limit dashboard once real traffic has
    # exercised this — this project has already been burned once by trusting
    # a provider's published number over a live-checked one (Gemini's old
    # free-tier RPD figures), so treat this as a reminder to check, not a
    # permanent number.
    RAG_EMBEDDING_TEXTS_PER_MINUTE: int = 300
    RAG_EMBEDDING_RATE_SAFETY: float = 0.8

    # Ceiling on how many chunks ONE index cycle may embed. Bounded so
    # POST /api/chat/index/run returns in a sensible time and a first run on a
    # large backlog makes visible progress instead of appearing to hang.
    # Whatever is left over is picked up by the next cycle, because an
    # un-indexed document's hash simply hasn't moved yet. Higher than the old
    # Gemini-era default (300) because there's no free daily cap to respect
    # anymore — a paid, usage-billed API has no reason to spread a backlog
    # over multiple days the way a 1000/day free tier used to force.
    RAG_MAX_CHUNKS_PER_CYCLE: int = 1000

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
    # How many concall transcript PDFs to pull per company. Two covers "the
    # last call" and "the one before", which is what almost every
    # management-commentary question is actually about — raise this if a
    # deeper history turns out to matter more than keeping each company's
    # first index pass fast.
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

    # Answering model — see ZLM_MODEL_CHAT above (agents/shared/llm.py's
    # ZLM section). Deliberately its own setting rather than reusing
    # ZLM_MODEL_CHEAP/SMART: this is the only user-facing, unmetered,
    # per-question call in the product (every other model call in this
    # codebase is offline batch work), so its cost/quality tradeoff is a
    # different decision from the workflows' and must be tunable on its own.
    # Retrieval's embeddings also run on ZLM now (ZLM_EMBEDDING_MODEL above)
    # — the whole answer path, retrieval and generation both, is one provider.

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