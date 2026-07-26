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

    # Model ids every workflow shares — see agents/shared/llm.py. Verified
    # live (not on any announced Gemini deprecation schedule) as of July
    # 2026. Re-verify before ever changing these.
    GEMINI_MODEL_CHEAP: str = "gemini-3.5-flash-lite"
    GEMINI_MODEL_SMART: str = "gemini-3.6-flash"

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

    @property
    def FINEDGE_API_KEYS(self) -> List[str]:
        return [self.FINEDGE_API_KEY_1, self.FINEDGE_API_KEY_2, self.FINEDGE_API_KEY_3]

    class Config:
        env_file = env_file_path
        extra = "ignore"

settings = Settings()