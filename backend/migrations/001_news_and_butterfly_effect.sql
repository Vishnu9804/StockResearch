-- ============================================================================
-- Butterfly Effect — news store + multi-agent workflow output
-- Run this in the Supabase SQL editor.
--
-- Four tables, each with one job:
--   news_items               canonical, deduped news store (workflow INPUT)
--   news_impact_analyses     workflow OUTPUT, once per news, portfolio-independent
--   company_exposure_profiles  per-company causal surface (built offline, rarely)
--   user_news_alerts         materialised RED/ORANGE/YELLOW per user+news+symbol
--
-- Why the analysis is NOT a column on news_items:
--   the workflow will be re-run as prompts/models improve. Keeping analyses in
--   their own table lets several workflow_versions coexist against one news row,
--   so you can A/B a new pipeline against the old one on identical input and
--   measure whether accuracy actually improved. A jsonb column on news_items
--   would force you to destroy the previous answer to store the new one.
-- ============================================================================

-- ── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists pg_trgm;      -- fuzzy near-duplicate headline match


-- ============================================================================
-- 1. news_items — the canonical news store
-- ============================================================================
create table if not exists public.news_items (
  id                  uuid primary key default gen_random_uuid(),

  -- ── Identity / dedup ──────────────────────────────────────────────────────
  -- url_hash is the hard dedup key (same article re-seen on a later poll).
  -- title_hash is the soft key (same story syndicated under an identical
  -- headline). Genuinely different headlines about the same event are collapsed
  -- later by the triage stage, which sets duplicate_of_id / cluster_key.
  url                 text not null,
  url_hash            text not null,
  title_hash          text not null,
  cluster_key         text,
  duplicate_of_id     uuid references public.news_items(id) on delete set null,

  -- ── Content ───────────────────────────────────────────────────────────────
  title               text not null,
  summary             text,
  body                text,
  image_url           text,
  language            text not null default 'en',

  -- ── Provenance ────────────────────────────────────────────────────────────
  source_name         text not null,             -- 'Economic Times'
  source_slug         text not null,             -- 'economic_times_markets'
  source_type         text not null,             -- RSS | GDELT | FINEDGE_ANNOUNCEMENT
  -- Feeds the Confidence term in the scorer. 1 = regulator/exchange/wire
  -- (RBI, SEBI, NSE), 2 = established publication, 3 = aggregator/syndicated.
  source_tier         smallint not null default 3,
  author              text,

  -- ── Time ──────────────────────────────────────────────────────────────────
  published_at        timestamptz not null,
  ingested_at         timestamptz not null default now(),

  -- ── Classification (set by triage; cheap model + rules) ───────────────────
  category            text,                      -- MACRO|COMMODITY|POLICY|GLOBAL|CORPORATE|SECTOR|MARKETS
  event_type          text,                      -- closed vocabulary, see docs
  regions             text[] not null default '{}',
  -- Symbols the article names OUTRIGHT. This is the "direct hit" set — it is
  -- deliberately NOT the alert set. Butterfly alerts mostly come from symbols
  -- that never appear here.
  mentioned_symbols   text[] not null default '{}',
  mentioned_entities  jsonb  not null default '[]'::jsonb,

  -- ── Pipeline control ──────────────────────────────────────────────────────
  -- market_relevance gates entry to the expensive stage. Sub-threshold items
  -- are stored and shown in the general feed but never analysed.
  market_relevance    numeric,
  analysis_status     text not null default 'PENDING',
  analysis_attempts   smallint not null default 0,
  analysis_error      text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint news_items_url_hash_key   unique (url_hash),
  constraint news_items_source_type_ck check (
    source_type in ('RSS','GDELT','FINEDGE_ANNOUNCEMENT','PRESS_RELEASE','MANUAL')),
  constraint news_items_status_ck check (
    analysis_status in ('PENDING','TRIAGED','SKIPPED','ANALYZING','ANALYZED','FAILED','DUPLICATE')),
  constraint news_items_tier_ck       check (source_tier between 1 and 3),
  constraint news_items_relevance_ck  check (market_relevance is null
                                             or (market_relevance >= 0 and market_relevance <= 1))
);

-- Feed reads: newest first.
create index if not exists ix_news_items_published_at
  on public.news_items (published_at desc);

-- The worker's claim query: "give me PENDING items worth analysing".
create index if not exists ix_news_items_queue
  on public.news_items (analysis_status, market_relevance desc, published_at desc)
  where analysis_status in ('PENDING','TRIAGED');

create index if not exists ix_news_items_title_hash on public.news_items (title_hash);
create index if not exists ix_news_items_cluster    on public.news_items (cluster_key);
create index if not exists ix_news_items_category   on public.news_items (category);

-- Symbol-scoped feed ("news for RELIANCE") without a scan.
create index if not exists ix_news_items_symbols
  on public.news_items using gin (mentioned_symbols);

-- Near-duplicate headline detection across sources.
create index if not exists ix_news_items_title_trgm
  on public.news_items using gin (title gin_trgm_ops);


-- ============================================================================
-- 2. news_impact_analyses — the multi-agent workflow's output
--
-- Portfolio-independent by design. The workflow runs ONCE per news item and
-- describes the world, not any user: "nickel price up, nickel consumers hurt,
-- stainless steel makers hurt, ~2 quarter lag". Joining that to a specific
-- user's holdings is cheap deterministic code (scorer), not another LLM call.
-- This is what stops cost scaling as users × holdings × news.
-- ============================================================================
create table if not exists public.news_impact_analyses (
  id                  uuid primary key default gen_random_uuid(),
  news_id             uuid not null references public.news_items(id) on delete cascade,

  -- Bump when prompts/models/scoring change. Lets a new pipeline be scored
  -- against the old one on the same news before you cut over.
  workflow_version    text not null,

  -- ── Core output ───────────────────────────────────────────────────────────
  -- The normalised event: what actually happened, stripped of narrative.
  event               jsonb not null default '{}'::jsonb,

  -- Every causal chain that survived the Skeptic, each an ordered list of hops
  -- with a typed mechanism per hop. This is what the UI renders as the "why".
  causal_chains       jsonb not null default '[]'::jsonb,

  -- The join key against company_exposure_profiles. Flat, machine-matchable
  -- assertions like
  --   {"axis":"input_cost","key":"COMMODITY:NICKEL","direction":-1,
  --    "magnitude":0.7,"hops":2,"confidence":0.75,"chain_id":"c2"}
  -- The scorer never reads prose — only this array.
  exposure_axes       jsonb not null default '[]'::jsonb,

  -- ── Quality / calibration ─────────────────────────────────────────────────
  market_significance numeric,      -- 0..1 how much this matters at all
  confidence          numeric,      -- 0..1 aggregate evidence quality
  novelty             numeric,      -- 0..1 already priced in? 0 = old news
  horizon             text,         -- IMMEDIATE | DAYS | WEEKS | QUARTERS
  skeptic_verdict     jsonb not null default '{}'::jsonb,  -- what was killed and why
  evidence            jsonb not null default '[]'::jsonb,  -- grounding citations

  -- ── Ops ───────────────────────────────────────────────────────────────────
  model_versions      jsonb not null default '{}'::jsonb,  -- {"analyst":"...","skeptic":"..."}
  token_usage         jsonb not null default '{}'::jsonb,
  latency_ms          integer,
  status              text not null default 'OK',

  created_at          timestamptz not null default now(),

  constraint news_impact_analyses_unique unique (news_id, workflow_version),
  constraint news_impact_analyses_status_ck check (status in ('OK','PARTIAL','FAILED')),
  constraint news_impact_analyses_conf_ck   check (confidence is null
                                                   or (confidence >= 0 and confidence <= 1))
);

create index if not exists ix_news_impact_news on public.news_impact_analyses (news_id);
create index if not exists ix_news_impact_axes
  on public.news_impact_analyses using gin (exposure_axes jsonb_path_ops);


-- ============================================================================
-- 3. company_exposure_profiles — the accuracy moat
--
-- Built offline, once per company, refreshed quarterly. Without this the
-- workflow can only guess whether a nickel shock matters to a given company;
-- with it, the scorer knows nickel is 34% of that company's COGS and can
-- produce a materiality number instead of an opinion.
-- ============================================================================
create table if not exists public.company_exposure_profiles (
  id                       uuid primary key default gen_random_uuid(),
  symbol                   text not null,
  company_name             text,
  sector                   text,
  industry                 text,

  -- ── Causal surface (all jsonb, all weighted 0..1) ─────────────────────────
  revenue_mix              jsonb not null default '[]'::jsonb,  -- segment -> share
  cost_mix                 jsonb not null default '[]'::jsonb,  -- input -> share of COGS
  input_commodities        jsonb not null default '[]'::jsonb,  -- [{key,share_of_cogs,hedged}]
  output_markets           jsonb not null default '[]'::jsonb,
  geographies              jsonb not null default '[]'::jsonb,  -- revenue by region
  fx_exposure              jsonb not null default '{}'::jsonb,  -- {"USD":{"net":-0.3}}
  customer_concentration   jsonb not null default '[]'::jsonb,
  supplier_dependencies    jsonb not null default '[]'::jsonb,
  regulatory_exposure      jsonb not null default '[]'::jsonb,
  substitutes              jsonb not null default '[]'::jsonb,
  complements              jsonb not null default '[]'::jsonb,
  peers                    jsonb not null default '[]'::jsonb,

  -- Scalars the scorer uses directly.
  rate_sensitivity         numeric,   -- -1..1, from debt/equity + duration
  commodity_beta           numeric,
  export_share             numeric,
  import_share             numeric,

  -- The flattened union of every axis key above, for fast containment lookup
  -- against news_impact_analyses.exposure_axes.
  axis_keys                text[] not null default '{}',

  -- ── Provenance ────────────────────────────────────────────────────────────
  evidence_refs            jsonb not null default '[]'::jsonb,
  confidence               numeric,
  profile_version          text not null default 'v1',
  model_version            text,
  generated_at             timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint company_exposure_profiles_symbol_key unique (symbol)
);

create index if not exists ix_exposure_axis_keys
  on public.company_exposure_profiles using gin (axis_keys);
create index if not exists ix_exposure_sector
  on public.company_exposure_profiles (sector);


-- ============================================================================
-- 4. user_news_alerts — materialised per-user result
--
-- One row per (user, news, symbol) that cleared the YELLOW floor. Materialised
-- rather than computed on read because it is what push notifications, unread
-- badges and "why did you alert me last Tuesday" auditing all need.
-- ============================================================================
create table if not exists public.user_news_alerts (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users(id) on delete cascade,
  portfolio_id        uuid references public.portfolios(id) on delete cascade,
  news_id             uuid not null references public.news_items(id) on delete cascade,
  analysis_id         uuid references public.news_impact_analyses(id) on delete set null,

  symbol              text not null,
  company_name        text,

  severity            text not null,     -- RED | ORANGE | YELLOW
  score               numeric not null,  -- 0..1, the composite that chose severity
  direction           smallint not null default 0,   -- -1 headwind, +1 tailwind, 0 unclear

  -- The scorer's component breakdown, kept so a surprising alert can always be
  -- taken apart: {"materiality":0.62,"attenuation":0.45,"directness":1.0,...}
  score_components    jsonb not null default '{}'::jsonb,

  -- The single chain shown to the user, plus the generated prose.
  chain               jsonb not null default '[]'::jsonb,
  explanation         text,
  hops                smallint,

  -- Position context at alert time (value at risk framing, no advice).
  exposure_value      numeric,
  exposure_pct        numeric,

  created_at          timestamptz not null default now(),
  read_at             timestamptz,
  dismissed_at        timestamptz,
  -- Thumbs up/down. This column is the training signal for calibration —
  -- without it you can never prove the thresholds are right.
  user_feedback       smallint,

  constraint user_news_alerts_unique unique (user_id, news_id, symbol),
  constraint user_news_alerts_severity_ck check (severity in ('RED','ORANGE','YELLOW')),
  constraint user_news_alerts_score_ck    check (score >= 0 and score <= 1),
  constraint user_news_alerts_dir_ck      check (direction in (-1,0,1))
);

create index if not exists ix_user_alerts_inbox
  on public.user_news_alerts (user_id, created_at desc)
  where dismissed_at is null;

create index if not exists ix_user_alerts_unread
  on public.user_news_alerts (user_id, severity)
  where read_at is null and dismissed_at is null;

create index if not exists ix_user_alerts_news on public.user_news_alerts (news_id);


-- ============================================================================
-- 5. updated_at triggers
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_news_items_updated_at on public.news_items;
create trigger trg_news_items_updated_at
  before update on public.news_items
  for each row execute function public.set_updated_at();

drop trigger if exists trg_exposure_updated_at on public.company_exposure_profiles;
create trigger trg_exposure_updated_at
  before update on public.company_exposure_profiles
  for each row execute function public.set_updated_at();
