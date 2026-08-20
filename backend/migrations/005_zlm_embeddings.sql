-- ============================================================================
-- Switch RAG embeddings from Gemini to ZLM (Zhipu AI / Z.ai's embedding-3)
-- Run this in the Supabase SQL editor (or let backend/scripts/apply_migration.py
-- push it; it is idempotent either way).
--
-- Why: every LLM call in this codebase moved to ZLM (see core/config.py's
-- "Multi-agent workflows" comment) so that ZLM is the only provider that ever
-- spends money — Gemini's embeddings (gemini-embedding-001, 768 dimensions)
-- were the last holdout. Zhipu's embedding-3 replaces them, at 1024
-- dimensions (see core/config.py:RAG_EMBEDDING_DIM for why 1024 and not
-- embedding-3's own max of 2048 — pgvector cannot INDEX a column past 2000
-- dimensions).
--
-- Old Gemini vectors are not comparable to embedding-3's vectors even where a
-- dimension happened to match — different model, different embedding space
-- entirely — so this wipes rag_documents (and, by FK cascade, rag_chunks)
-- rather than leaving stale vectors that would silently corrupt retrieval.
-- Nothing is lost that can't be rebuilt: this table is a derived cache over
-- live sources (news, transcripts, fundamentals, help topics), never the
-- source of truth — see migration 003's own header. The index worker (or
-- POST /api/chat/index/run) rebuilds it from scratch automatically, now on
-- embedding-3.
-- ============================================================================

-- Wipe first — MUST happen before the column type change below, since
-- pgvector cannot cast an existing 768-dim vector into a 1024-dim column.
-- CASCADE follows the FK from rag_chunks (on delete cascade, migration 003)
-- so both tables end up empty in one statement.
truncate table public.rag_documents cascade;

-- Drop and re-add rather than ALTER COLUMN ... TYPE: pgvector has no defined
-- cast between two different fixed dimensions, so an ALTER would either
-- error or require a USING clause that's really just "throw the old data
-- away" in disguise — drop+add says that directly, and it also drops the
-- HNSW index that depended on the old column (recreated below) instead of
-- leaving Postgres to figure out what to do with an index over a column
-- that no longer exists in its old shape.
drop index if exists public.ix_rag_chunks_embedding_hnsw;
alter table public.rag_chunks drop column embedding;
alter table public.rag_chunks add column embedding vector(1024);

create index ix_rag_chunks_embedding_hnsw
  on public.rag_chunks using hnsw (embedding vector_cosine_ops);
