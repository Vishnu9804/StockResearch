-- ============================================================================
-- AI Summary of company documents (Announcements + Concalls + Presentations)
-- Run this in the Supabase SQL editor.
--
-- One row PER SYMBOL (not per quarter) — by design, per product decision:
-- only the CURRENT quarter's summary is ever kept. When a new quarter's
-- documents show up, the existing row is overwritten in place rather than a
-- new one being inserted, so this table never accumulates history and a
-- lookup is always a single indexed point read, unchanged in cost whether
-- there are 10 companies or the full ~6700-symbol universe.
--
-- Generation itself (services/ai_summary/pipeline.py) never touches
-- embeddings — it feeds extracted PDF text straight to a ZLM model, since the
-- corpus per company per quarter is small (a handful of filings) and doesn't
-- need retrieval. See that module's docstring for the full reasoning.
-- ============================================================================

-- ============================================================================
-- 1. company_metrics.ai_summary_synced_at — same "null = never synced,
--    oldest-first + largest-market-cap-first" pattern as documents_synced_at
--    (migration 004) and fundamentals_synced_at. Drives
--    services/ai_summary/pipeline.py::sync_ai_summaries_batch, the rolling
--    background sweep that makes this feature work unattended across the
--    full listed universe, not just a hand-picked pilot list.
-- ============================================================================
alter table public.company_metrics
  add column if not exists ai_summary_synced_at timestamptz;

create index if not exists ix_company_metrics_ai_summary_synced_at
  on public.company_metrics (ai_summary_synced_at nulls first);


-- ============================================================================
-- 2. company_ai_summaries — the generated, cached summary itself. Read by
--    GET /company/{symbol}/ai-summary on every page view; written only by
--    services/ai_summary/pipeline.py (either the on-demand cold-start path or
--    the background batch sweep). A user viewing this tab NEVER triggers an
--    LLM call directly — they read this table, exactly like the Documents
--    tab reads company_documents instead of calling FinEdge live.
-- ============================================================================
create table if not exists public.company_ai_summaries (
  id                      uuid primary key default gen_random_uuid(),
  symbol                  text not null unique,

  -- Which quarter this summary covers — derived from the company's OWN most
  -- recent filing date, not from today's calendar date (a company doesn't
  -- have Q2 filings the moment Q2 starts; it has them ~6-8 weeks AFTER Q2
  -- ends, per SEBI LODR). See services/ai_summary/quarter.py.
  fiscal_year             smallint not null,
  quarter_number          smallint not null,
  quarter_label           text not null,

  -- Plain-language synthesis, already split into the sections the frontend
  -- renders — see services/ai_summary/schemas.py:QuarterSummaryResult.
  overview                text not null,
  announcements_summary   text,
  concall_summary         text,
  presentation_summary    text,

  -- Bulleted, individually source-attributed facts (each item cites which
  -- document/date it came from) — the traceability trail that lets a claim
  -- in the summary be checked against the real filing it came from.
  key_highlights          jsonb not null default '[]',

  -- Exactly which company_documents rows fed this summary, and which ones
  -- were found but could NOT be read (scanned PDF, download failure, etc.) —
  -- kept so the UI can be honest about partial coverage instead of silently
  -- omitting a document from an "AI Summary" a user might otherwise assume is
  -- complete.
  documents_covered       jsonb not null default '[]',
  documents_skipped       jsonb not null default '[]',

  -- Hash of the exact document set + extracted text used to build this row.
  -- Lets the batch sweep and the on-demand fallback both skip regenerating
  -- (and re-spending LLM cost) when nothing has actually changed since last
  -- time — the same role company_documents' immutable pdf_url plays for
  -- document_sync, just content-based here since a summary is a derived
  -- artifact, not a 1:1 mirror of one filing.
  source_content_hash     text not null,

  -- 'ready'          — summary generated normally.
  -- 'insufficient_data' — this quarter's filings exist but none had
  --                       extractable text (all scanned / all failed to
  --                       download) — a real, honest answer, not an error.
  -- 'no_documents'   — the company simply has no announcement/concall/
  --                       presentation filings yet this quarter.
  -- 'failed'         — generation errored; error_message has the reason.
  status                  text not null default 'ready',
  error_message           text,

  model_used              text,
  generated_at            timestamptz,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint company_ai_summaries_status_check
    check (status in ('ready', 'insufficient_data', 'no_documents', 'failed'))
);

create index if not exists ix_company_ai_summaries_symbol
  on public.company_ai_summaries (symbol);

drop trigger if exists trg_company_ai_summaries_updated_at on public.company_ai_summaries;
create trigger trg_company_ai_summaries_updated_at
  before update on public.company_ai_summaries
  for each row execute function public.set_updated_at();
