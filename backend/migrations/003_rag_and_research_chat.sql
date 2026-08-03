-- ============================================================================
-- Research Chat — RAG index + conversation store
-- Run this in the Supabase SQL editor (or let backend/scripts/apply_migration.py
-- push it; it is idempotent either way).
--
-- Four tables, each with one job:
--   rag_documents        one row per indexed SOURCE object (a company profile,
--                        one concall transcript PDF, one news article, one
--                        help topic). Holds the content hash that decides
--                        whether re-embedding is needed at all.
--   rag_chunks           the retrievable unit — text + its embedding + a
--                        generated tsvector for keyword search.
--   chat_conversations   one row per chat thread, per user.
--   chat_messages        the turns inside a thread.
--
-- Why documents and chunks are split:
--   embedding costs money and quota. A company profile that hasn't changed
--   must NOT be re-embedded just because the indexer woke up. content_hash on
--   the DOCUMENT is what makes "only re-run RAG when the underlying data
--   actually changed" a cheap equality check instead of a diff over N chunks.
--   Chunks are deleted+rewritten wholesale when (and only when) that hash
--   moves, which is why the FK cascades.
--
-- Why chunks carry denormalised symbol/source_type/doc_date:
--   every retrieval filters or re-weights on those three. Joining back to
--   rag_documents for them on every ANN probe would make the hot path pay for
--   a join it can avoid with three small columns.
-- ============================================================================

-- ── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists vector;       -- pgvector: the embedding column + ANN index


-- ============================================================================
-- 1. rag_documents — one row per indexed source object
-- ============================================================================
create table if not exists public.rag_documents (
  id                uuid primary key default gen_random_uuid(),

  -- COMPANY_PROFILE | COMPANY_FUNDAMENTALS | TRANSCRIPT | NEWS | PLATFORM_HELP
  -- Kept as text (not an enum) for the same reason news_items.source_type is:
  -- adding a corpus should be a code change, not a migration.
  source_type       text not null,

  -- Stable natural key WITHIN a source_type. Re-indexing the same real-world
  -- object must land on the same row, so this is deliberately derived from the
  -- object's identity (symbol, news uuid, transcript URL), never from a
  -- timestamp or a random id.
  source_key        text not null,

  symbol            text,                      -- null for NEWS/PLATFORM_HELP without a single owner
  title             text,
  url               text,
  doc_date          timestamptz,               -- publication / filing date, used for recency re-weighting

  -- sha256 of the normalised source text. Equal hash => nothing to do.
  content_hash      text not null,
  metadata          jsonb not null default '{}'::jsonb,

  chunk_count       integer not null default 0,
  embedding_model   text,

  indexed_at        timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint rag_documents_source_unique unique (source_type, source_key)
);

create index if not exists ix_rag_documents_symbol      on public.rag_documents (symbol);
create index if not exists ix_rag_documents_source_type on public.rag_documents (source_type);
create index if not exists ix_rag_documents_doc_date    on public.rag_documents (doc_date desc);


-- ============================================================================
-- 2. rag_chunks — the retrievable unit
-- ============================================================================
-- Dimension note: 768 is gemini-embedding-001 truncated via Matryoshka
-- (MRL) and re-normalised — see backend/services/rag/embeddings.py. Changing
-- RAG_EMBEDDING_DIM in core/config.py WITHOUT a matching migration here will
-- fail at insert time, on purpose: a silently mixed-dimension index would
-- return quietly wrong neighbours instead of an error.
create table if not exists public.rag_chunks (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid not null references public.rag_documents(id) on delete cascade,
  chunk_index       integer not null,

  content           text not null,
  token_estimate    integer,

  -- Denormalised from rag_documents so the hot retrieval path never joins.
  symbol            text,
  source_type       text not null,
  doc_date          timestamptz,

  embedding         vector(768),

  -- Keyword half of hybrid retrieval. Generated (not maintained in Python) so
  -- it can never drift out of sync with `content`.
  tsv tsvector generated always as (to_tsvector('english', content)) stored,

  created_at        timestamptz not null default now(),

  constraint rag_chunks_unique unique (document_id, chunk_index)
);

-- HNSW over cosine distance. Chosen over IVFFlat because IVFFlat needs a
-- representative training set at build time — this index starts empty and
-- grows continuously as news arrives, which is exactly the case IVFFlat
-- degrades on until it is manually rebuilt.
create index if not exists ix_rag_chunks_embedding_hnsw
  on public.rag_chunks using hnsw (embedding vector_cosine_ops);

create index if not exists ix_rag_chunks_tsv         on public.rag_chunks using gin (tsv);
create index if not exists ix_rag_chunks_symbol      on public.rag_chunks (symbol);
create index if not exists ix_rag_chunks_source_type on public.rag_chunks (source_type);
create index if not exists ix_rag_chunks_document    on public.rag_chunks (document_id);


-- ============================================================================
-- 3. chat_conversations — one thread per row
-- ============================================================================
-- A thread survives closing the panel, navigating away and reloading; only
-- pressing "New chat" starts a new one. Retention (newest N per user) is
-- enforced in backend/routers/chat.py rather than here, so the limit is a
-- config value rather than a schema change.
create table if not exists public.chat_conversations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,

  title             text not null default 'New research chat',

  -- BEGINNER | INTERMEDIATE | ADVANCED — the LANGUAGE level only. It never
  -- changes retrieval depth or answer quality, only the vocabulary the answer
  -- is written in. Stored per conversation as the default for new turns; each
  -- message also records the level it was actually answered at.
  language_level    text not null default 'INTERMEDIATE'
                    check (language_level in ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),

  message_count     integer not null default 0,
  last_message_at   timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists ix_chat_conversations_user
  on public.chat_conversations (user_id, last_message_at desc nulls last, created_at desc);


-- ============================================================================
-- 4. chat_messages — the turns
-- ============================================================================
create table if not exists public.chat_messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references public.chat_conversations(id) on delete cascade,

  role              text not null check (role in ('user', 'assistant')),
  content           text not null,

  -- Only set on assistant turns.
  language_level    text,
  -- [{ "n": 1, "sourceType": "...", "title": "...", "url": "...", "symbol": "..." }]
  citations         jsonb not null default '[]'::jsonb,
  -- What retrieval actually did (query used, corpora hit, chunk ids/scores).
  -- Kept so a wrong answer can be diagnosed as "retrieval missed it" vs
  -- "the model ignored what it was given" — those need opposite fixes.
  retrieval_debug   jsonb not null default '{}'::jsonb,
  token_usage       jsonb not null default '{}'::jsonb,
  latency_ms        integer,

  created_at        timestamptz not null default now()
);

create index if not exists ix_chat_messages_conversation
  on public.chat_messages (conversation_id, created_at);


-- ============================================================================
-- 5. updated_at triggers (reuses public.set_updated_at from migration 001)
-- ============================================================================
drop trigger if exists trg_rag_documents_updated_at on public.rag_documents;
create trigger trg_rag_documents_updated_at
  before update on public.rag_documents
  for each row execute function public.set_updated_at();

drop trigger if exists trg_chat_conversations_updated_at on public.chat_conversations;
create trigger trg_chat_conversations_updated_at
  before update on public.chat_conversations
  for each row execute function public.set_updated_at();
