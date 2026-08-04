-- ============================================================================
-- Company document index + RAG pending-retry queue
-- Run this in the Supabase SQL editor.
--
-- Two independent additions, one shared motivation: don't make a live user
-- request pay for a live FinEdge round trip (or lose work silently) when a
-- background process could have done it ahead of time instead.
--
--   company_documents         persisted "what PDFs does FinEdge have for this
--                             company" — for EVERY listed company, not just
--                             held/watched ones. Populated by
--                             services/document_sync.py on a slow cadence
--                             (documents change on the order of months, not
--                             minutes). This is what
--                             GET /company/{symbol}/documents now serves from,
--                             and what services/rag/sources/transcript_source.py
--                             now checks before ever calling FinEdge live.
--
--   rag_pending_symbols       "a user asked about this company and on-demand
--                             indexing hit a wall (usually the embedding
--                             quota) before it finished." Without this, that
--                             request is simply lost — the next user to ask
--                             about the SAME company hits the exact same
--                             cold-start path again. With it, the background
--                             RAG index worker's normal cycle also sweeps up
--                             every pending symbol until it succeeds, so a
--                             quota wall costs a delay, never a dropped
--                             request.
-- ============================================================================

-- ============================================================================
-- 1. company_metrics.documents_synced_at — same pattern as the existing
--    quote_synced_at / fundamentals_synced_at columns: null means "never
--    synced", and services/document_sync.py picks the oldest-synced-first,
--    largest-market-cap-first, exactly like sync_fundamentals_batch already
--    does for fundamentals.
-- ============================================================================
alter table public.company_metrics
  add column if not exists documents_synced_at timestamptz;

create index if not exists ix_company_metrics_documents_synced_at
  on public.company_metrics (documents_synced_at nulls first);


-- ============================================================================
-- 2. company_documents — one row per real filing/PDF FinEdge has for a
--    company. category mirrors the classification routers/finedge.py has
--    used since before this table existed (announcement | annual-report |
--    concall | credit-rating | presentation) — kept as text, not an enum, for
--    the same reason every other classification column in this codebase is:
--    adding a category is a code change, not a migration.
-- ============================================================================
create table if not exists public.company_documents (
  id                uuid primary key default gen_random_uuid(),
  symbol            text not null,

  category          text not null,
  title             text not null,
  filed_date        date,

  -- The filing's real identity. An exchange filing at a given archive URL is
  -- immutable — a correction is published at a NEW url, never edited in
  -- place — which is what makes (symbol, pdf_url) a safe upsert key rather
  -- than something that needs a content hash.
  pdf_url           text not null,

  -- FinEdge's own item id (timestamp_unix in the raw feed), kept only for
  -- traceability back to the source record during debugging — nothing reads
  -- it to make a decision.
  source_ref        text,

  discovered_at     timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint company_documents_unique unique (symbol, pdf_url)
);

create index if not exists ix_company_documents_symbol
  on public.company_documents (symbol);
create index if not exists ix_company_documents_symbol_category
  on public.company_documents (symbol, category);
create index if not exists ix_company_documents_filed_date
  on public.company_documents (filed_date desc);

drop trigger if exists trg_company_documents_updated_at on public.company_documents;
create trigger trg_company_documents_updated_at
  before update on public.company_documents
  for each row execute function public.set_updated_at();


-- ============================================================================
-- 3. rag_pending_symbols — the retry-remembering queue described above.
--    Deliberately tiny: one row per symbol currently owed a retry, deleted
--    the moment it succeeds. This is a WORK QUEUE, not a log — if you want
--    history of what failed and when, that already lives in the structured
--    logs services/rag/index_worker.py writes on every attempt.
-- ============================================================================
create table if not exists public.rag_pending_symbols (
  symbol            text primary key,

  -- Why it's here — almost always 'EMBEDDING_QUOTA', kept as text (not an
  -- enum) for the same reason as company_documents.category above.
  reason            text not null,
  attempts          smallint not null default 1,

  first_requested_at timestamptz not null default now(),
  last_attempt_at     timestamptz not null default now()
);
