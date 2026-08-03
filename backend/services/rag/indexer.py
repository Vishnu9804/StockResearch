"""services/rag/indexer.py
Writes RagSourceDocuments into rag_documents + rag_chunks.

The one rule this module exists to enforce: **re-embed only what actually
changed.** Every document carries a sha256 of its own normalised text; if the
stored hash matches, the indexer does nothing at all — no embedding call, no
delete, no write. That is what makes it safe to run the index cycle every 15
minutes over a corpus that mostly changes once a quarter.

A hash miss is handled as delete-then-rewrite rather than a per-chunk diff.
Chunk boundaries shift when text changes, so "chunk 3" before and after an
edit are not the same passage — diffing them would be comparing things that
only share an index. Deleting the document's chunks and re-chunking is both
simpler and correct, and the FK cascade in migration 003 does the delete.
"""
import hashlib
import logging
from dataclasses import dataclass

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from core.config import settings
from core.database import async_session_maker
from models.models import RagChunk, RagDocument
from services.rag import embeddings
from services.rag.chunking import estimate_tokens, normalise_text, split_text
from services.rag.schemas import RagSourceDocument

logger = logging.getLogger("services.rag.indexer")


@dataclass(slots=True)
class IndexResult:
    """What one call to index_documents actually did. Returned (not just
    logged) so the ops endpoint in routers/chat.py can show it, and so a test
    can assert 'the second run embedded nothing'."""

    considered: int = 0
    indexed: int = 0
    unchanged: int = 0
    failed: int = 0
    # Ran out of this cycle's chunk budget with work still to do. NOT a
    # failure — the deferred documents are picked up by the next cycle
    # untouched, because their content hash never moved.
    deferred: int = 0
    chunks_written: int = 0
    quota_exhausted: bool = False

    def as_dict(self) -> dict:
        return {
            "considered": self.considered,
            "indexed": self.indexed,
            "unchanged": self.unchanged,
            "failed": self.failed,
            "deferred": self.deferred,
            "chunksWritten": self.chunks_written,
            "quotaExhausted": self.quota_exhausted,
        }

    def merge(self, other: "IndexResult") -> "IndexResult":
        self.considered += other.considered
        self.indexed += other.indexed
        self.unchanged += other.unchanged
        self.failed += other.failed
        self.deferred += other.deferred
        self.chunks_written += other.chunks_written
        self.quota_exhausted = self.quota_exhausted or other.quota_exhausted
        return self


def content_hash(text: str) -> str:
    """Hash the NORMALISED text, not the raw text.

    PDF extraction is not byte-stable — pypdf can emit a different run of
    spaces for the identical file across versions, and a publisher re-uploading
    the same transcript changes nothing a reader would notice. Hashing after
    normalisation means those produce the same hash and cost nothing, which is
    the entire point of the hash.
    """
    return hashlib.sha256(normalise_text(text).encode("utf-8")).hexdigest()


def _chunks_for(document: RagSourceDocument) -> list[str]:
    if document.pre_chunked is not None:
        return [chunk for chunk in (c.strip() for c in document.pre_chunked) if chunk]
    return split_text(document.text)


def _prefix_chunk(document: RagSourceDocument, chunk: str) -> str:
    """Prepend a one-line header naming the document to every chunk.

    Retrieval returns a chunk, not a document, so without this a passage from
    page 14 of a transcript reads as anonymous prose — the embedding carries no
    trace of WHOSE call it was, and a question naming the company matches it
    only by luck. The header is cheap (~15 tokens) and lifts symbol/date/kind
    into both the embedding and the tsvector, where both halves of hybrid
    retrieval can use them.
    """
    parts = [document.title]
    if document.symbol:
        parts.insert(0, document.symbol)
    if document.doc_date:
        parts.append(document.doc_date.strftime("%d %b %Y"))
    return f"[{' | '.join(parts)}]\n{chunk}"


async def _existing_hashes(source_type: str, source_keys: list[str]) -> dict[str, str]:
    if not source_keys:
        return {}
    async with async_session_maker() as session:
        rows = (
            await session.execute(
                select(RagDocument.source_key, RagDocument.content_hash).where(
                    RagDocument.source_type == source_type,
                    RagDocument.source_key.in_(source_keys),
                )
            )
        ).all()
    return {source_key: stored_hash for source_key, stored_hash in rows}


async def _write_document(document: RagSourceDocument, chunks: list[str], vectors: list[list[float]]) -> None:
    values = dict(
        source_type=document.source_type,
        source_key=document.source_key,
        symbol=document.symbol,
        title=document.title,
        url=document.url,
        doc_date=document.doc_date,
        content_hash=content_hash(document.text),
        extra_metadata=document.metadata or {},
        chunk_count=len(chunks),
        embedding_model=settings.GEMINI_EMBEDDING_MODEL,
    )

    async with async_session_maker() as session:
        statement = pg_insert(RagDocument).values(**values)
        # `excluded` is keyed by DB COLUMN name, while `values` above is keyed
        # by ORM ATTRIBUTE name — and those differ for extra_metadata, which
        # maps to the column "metadata" (the attribute is renamed because
        # `metadata` is reserved on a declarative class). Going through the
        # mapper is what keeps the two in step; spelling either set of names
        # out by hand is how this silently breaks the next time a column is
        # added.
        mapper_columns = RagDocument.__mapper__.columns
        update_columns = {
            mapper_columns[attribute].name: statement.excluded[mapper_columns[attribute].name]
            for attribute in values
            if attribute not in ("source_type", "source_key")
        }
        # indexed_at is not in `values` (it has a server default), but it must
        # move on every successful re-index so "when did we last actually
        # embed this" stays true rather than freezing at first insert.
        update_columns["indexed_at"] = func.now()
        statement = statement.on_conflict_do_update(
            index_elements=["source_type", "source_key"], set_=update_columns
        ).returning(RagDocument.id)
        document_id = (await session.execute(statement)).scalar_one()

        # Boundaries move when text changes, so the old chunks are not a
        # subset of the new ones — see the module docstring.
        await session.execute(delete(RagChunk).where(RagChunk.document_id == document_id))

        session.add_all([
            RagChunk(
                document_id=document_id,
                chunk_index=index,
                content=chunk,
                token_estimate=estimate_tokens(chunk),
                symbol=document.symbol,
                source_type=document.source_type,
                doc_date=document.doc_date,
                embedding=vector,
            )
            for index, (chunk, vector) in enumerate(zip(chunks, vectors))
        ])
        await session.commit()


async def index_documents(
    documents: list[RagSourceDocument],
    chunk_budget: int | None = None,
) -> IndexResult:
    """Index every document whose content hash has moved, up to `chunk_budget`
    chunks. Returns what it did.

    Embedding is batched ACROSS documents, not per document, so a cycle that
    picks up 300 short news articles makes 3 HTTP calls rather than 300.

    `chunk_budget` bounds how long one call can run. It is a WALL-CLOCK bound,
    not a cost one: the free tier meters texts per minute (see
    core/config.py:RAG_EMBEDDING_TEXTS_PER_MINUTE), so an unbounded first run
    over a large backlog would sit there for half an hour looking hung. A
    document that doesn't fit is simply left alone — nothing is written and
    its hash never moves, so the next cycle picks it up with no bookkeeping.
    Documents are taken in the order the caller supplied them, which is how
    "most important corpus first" in index_worker.py stays meaningful.
    """
    result = IndexResult(considered=len(documents))
    if not documents:
        return result
    if chunk_budget is not None and chunk_budget <= 0:
        result.deferred = len(documents)
        return result

    by_type: dict[str, list[RagSourceDocument]] = {}
    for document in documents:
        by_type.setdefault(document.source_type, []).append(document)

    stored_by_type: dict[str, dict[str, str]] = {}
    for source_type, group in by_type.items():
        stored_by_type[source_type] = await _existing_hashes(
            source_type, [d.source_key for d in group]
        )

    pending: list[tuple[RagSourceDocument, list[str]]] = []
    budget_left = chunk_budget
    for document in documents:
        if not document.text or not document.text.strip():
            result.failed += 1
            logger.warning(
                "[rag.indexer] %s/%s has no text — skipped",
                document.source_type, document.source_key,
            )
            continue
        if stored_by_type[document.source_type].get(document.source_key) == content_hash(document.text):
            result.unchanged += 1
            continue
        chunks = _chunks_for(document)
        if not chunks:
            result.failed += 1
            continue
        if budget_left is not None and len(chunks) > budget_left:
            # Never partially index a document: half its chunks in the index
            # is worse than none, because retrieval would confidently serve an
            # answer from the half that happens to be there.
            result.deferred += 1
            continue
        if budget_left is not None:
            budget_left -= len(chunks)
        pending.append((document, [_prefix_chunk(document, chunk) for chunk in chunks]))

    if result.deferred:
        logger.info(
            "[rag.indexer] %d document(s) deferred to a later cycle — chunk budget spent",
            result.deferred,
        )

    if not pending:
        logger.info(
            "[rag.indexer] nothing to do — %d document(s) already current",
            result.unchanged,
        )
        return result

    total_chunks = sum(len(chunks) for _, chunks in pending)
    logger.info(
        "[rag.indexer] embedding %d chunk(s) across %d changed document(s)",
        total_chunks, len(pending),
    )

    # Embed and write in WAVES rather than embedding everything and then
    # writing everything. On the free tier a large set takes several minutes of
    # paced calls, and a quota wall three minutes in used to throw away every
    # successfully-embedded vector before it — paying real quota for nothing
    # and leaving the next cycle to redo the identical work. Flushing each
    # wave means a mid-run wall costs only the wave in flight; everything
    # already written stays written, and its hash keeps it from being redone.
    #
    # Waves are sized at the embedding batch size so a wave is normally one
    # HTTP call. A single document larger than that is its own wave and is
    # split internally by embed_documents — never across a write boundary,
    # since a half-written document is worse than an unwritten one.
    # Deferrals so far are budget deferrals, counted before `pending` was even
    # built — snapshot them so the reconciliation at the end can tell those
    # apart from documents that were queued in `pending` and never reached.
    budget_deferred = result.deferred

    wave: list[tuple[RagSourceDocument, list[str]]] = []
    wave_chunks = 0

    async def _flush(batch: list[tuple[RagSourceDocument, list[str]]]) -> bool:
        """Embed + write one wave. Returns False when the caller must stop."""
        if not batch:
            return True
        flat = [chunk for _, chunks in batch for chunk in chunks]
        try:
            vectors = await embeddings.embed_documents(flat)
        except Exception as exc:
            if embeddings.is_quota_error(exc):
                result.quota_exhausted = True
                result.deferred += len(batch)
                logger.warning(
                    "[rag.indexer] embedding quota exhausted — %d document(s) deferred "
                    "(everything already written this run is kept)",
                    len(batch),
                )
                return False
            logger.exception("[rag.indexer] embedding failed")
            result.failed += len(batch)
            return False

        offset = 0
        for document, chunks in batch:
            slice_ = vectors[offset:offset + len(chunks)]
            offset += len(chunks)
            try:
                await _write_document(document, chunks, slice_)
                result.indexed += 1
                result.chunks_written += len(chunks)
            except Exception:
                result.failed += 1
                logger.exception(
                    "[rag.indexer] write failed for %s/%s",
                    document.source_type, document.source_key,
                )
        return True

    stopped = False
    for entry in pending:
        wave.append(entry)
        wave_chunks += len(entry[1])
        if wave_chunks >= settings.RAG_EMBEDDING_BATCH_SIZE:
            if not await _flush(wave):
                stopped = True
                break
            wave, wave_chunks = [], 0
    if not stopped:
        await _flush(wave)

    # Everything in `pending` that was neither written, nor failed, nor
    # already counted as deferred by the wave that stopped, was simply never
    # reached — those are deferrals too, and the next cycle will find them
    # exactly as they are.
    accounted = result.indexed + result.failed + (result.deferred - budget_deferred)
    result.deferred += max(0, len(pending) - accounted)

    logger.info(
        "[rag.indexer] done — indexed=%d unchanged=%d deferred=%d failed=%d chunks=%d",
        result.indexed, result.unchanged, result.deferred, result.failed, result.chunks_written,
    )
    return result


async def delete_documents(source_type: str, source_keys: list[str]) -> int:
    """Remove documents (and, by cascade, their chunks) that no longer exist
    upstream — a news article aged past NEWS_RETENTION_DAYS, a help topic that
    was renamed. Without this the index would only ever grow, and retrieval
    would keep surfacing passages whose source is gone."""
    if not source_keys:
        return 0
    async with async_session_maker() as session:
        result = await session.execute(
            delete(RagDocument).where(
                RagDocument.source_type == source_type,
                RagDocument.source_key.in_(source_keys),
            )
        )
        await session.commit()
    return result.rowcount or 0


async def index_stats() -> dict:
    """Corpus size by source type — what the ops endpoint and the frontend's
    'is the index built yet?' check both read."""
    async with async_session_maker() as session:
        document_rows = (
            await session.execute(
                select(RagDocument.source_type, func.count(), func.max(RagDocument.indexed_at))
                .group_by(RagDocument.source_type)
            )
        ).all()
        chunk_rows = (
            await session.execute(
                select(RagChunk.source_type, func.count()).group_by(RagChunk.source_type)
            )
        ).all()

    chunk_counts = {source_type: count for source_type, count in chunk_rows}
    return {
        "embeddingModel": settings.GEMINI_EMBEDDING_MODEL,
        "embeddingDim": settings.RAG_EMBEDDING_DIM,
        "totalDocuments": sum(count for _, count, _ in document_rows),
        "totalChunks": sum(chunk_counts.values()),
        "bySourceType": {
            source_type: {
                "documents": count,
                "chunks": chunk_counts.get(source_type, 0),
                "lastIndexedAt": last_indexed.isoformat() if last_indexed else None,
            }
            for source_type, count, last_indexed in document_rows
        },
    }
