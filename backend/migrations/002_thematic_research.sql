-- ============================================================================
-- Butterfly Effect — thematic/derived research (O2), sparse second output
-- Run this in the Supabase SQL editor.
--
-- Context: the workflow (Pipeline A, see 001_news_and_butterfly_effect.sql)
-- produces one output per news item — news_impact_analyses — which is what
-- gets combined with a user's portfolio to produce RED/ORANGE/YELLOW alerts
-- (that combination is Pipeline B, code-side, see routers/butterfly.py once
-- built). This table is a SECOND, INDEPENDENT output some news items also
-- earn: not "how does this affect a user's holdings" but "what NEW, non-
-- obvious real-world demand or dependency does this event create, and which
-- real listed companies sit on that dependency" — e.g. a government mandate to
-- blend ethanol into diesel implies new demand for a specific industrial input
-- (an oxygenate such as isobutane), which in turn points at specific,
-- verifiable Indian producers of that input. Most news earns nothing here —
-- that is the expected, normal outcome, not a gap to fill.
--
-- Why a separate table rather than a column on news_impact_analyses: this
-- output is sparse (most rows will simply never exist) and versioned
-- independently of the O1 scoring pipeline — the two can be re-tuned on
-- different schedules without forcing a shared migration.
-- ============================================================================

create table if not exists public.news_thematic_research (
  id                    uuid primary key default gen_random_uuid(),
  news_id               uuid not null references public.news_items(id) on delete cascade,
  -- The O1 analysis this was derived alongside — thematic research always
  -- starts from Pipeline A's already-computed event + causal chains rather
  -- than re-reading the raw article from scratch.
  analysis_id           uuid references public.news_impact_analyses(id) on delete set null,
  workflow_version      text not null,

  -- Why this particular news earned a research note at all — most won't. Kept
  -- even on rows that make it to insertion so a reviewer can see the gate's
  -- own reasoning, not just its yes/no.
  trigger_reasoning     text not null,

  -- The core derived claim: this event creates/intensifies demand for some
  -- concrete real-world input, output, or capability that isn't the event's
  -- own obvious subject. Shape:
  --   {"need_type": "CHEMICAL", "key": "CHEMICAL:ISOBUTANE",
  --    "description": "Isobutane is a common feedstock for producing ETBE,
  --     used as an oxygenate in ethanol-diesel blending.",
  --    "demand_direction": 1}
  -- Grounded via search (see the workflow brief) — never asserted from a
  -- model's unverified general knowledge alone.
  derived_need          jsonb not null default '{}'::jsonb,

  -- Candidate companies engaged with derived_need. Every entry here MUST have
  -- been cross-checked against company_metrics/FinEdge before this row is
  -- written — a candidate the verifier couldn't confirm as a real, currently
  -- listed company is discarded outright, never stored with an invented
  -- price. Shape per entry:
  --   {"symbol": "...", "company_name": "...", "relevance_reasoning": "...",
  --    "current_price": 123.4, "price_as_of": "...", "verified": true}
  candidate_companies   jsonb not null default '[]'::jsonb,

  -- Plain-language synthesis. Descriptive/analytical only — describes the
  -- mechanism and who sits on it, never a recommendation. Enforced by prompt
  -- AND a code-level banned-phrase check (buy/sell/target price/etc.) before
  -- this column is ever populated; a thesis that fails the check is dropped,
  -- not stored, while the structured fields above still are.
  thesis                text,

  confidence            numeric,
  novelty               numeric,
  horizon               text,          -- IMMEDIATE | DAYS | WEEKS | QUARTERS
  skeptic_verdict       jsonb not null default '{}'::jsonb,
  evidence              jsonb not null default '[]'::jsonb,   -- search grounding citations

  model_versions        jsonb not null default '{}'::jsonb,
  token_usage           jsonb not null default '{}'::jsonb,
  latency_ms            integer,
  status                text not null default 'OK',

  created_at            timestamptz not null default now(),

  constraint news_thematic_research_unique unique (news_id, workflow_version),
  constraint news_thematic_research_status_ck check (status in ('OK', 'PARTIAL', 'FAILED')),
  constraint news_thematic_research_conf_ck check (confidence is null
                                                   or (confidence >= 0 and confidence <= 1))
);

create index if not exists ix_thematic_research_news on public.news_thematic_research (news_id);
create index if not exists ix_thematic_research_analysis on public.news_thematic_research (analysis_id);
