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

    @property
    def FINEDGE_API_KEYS(self) -> List[str]:
        return [self.FINEDGE_API_KEY_1, self.FINEDGE_API_KEY_2, self.FINEDGE_API_KEY_3]

    class Config:
        env_file = env_file_path
        extra = "ignore"

settings = Settings()