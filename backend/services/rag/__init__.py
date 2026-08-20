"""services/rag
The retrieval layer behind Research Chat (agents/research_chat/).

    sources/     turn a real object (company profile, transcript PDF, news
                 article, help topic) into a RagSourceDocument
    chunking     split a document's text into retrievable passages
    embeddings   Zhipu (ZLM) embeddings, batched and normalised
    indexer      write documents+chunks to Postgres, skipping anything whose
                 content hash hasn't moved
    retriever    hybrid (vector + full-text) search with fusion and re-ranking
    index_worker the background loop that keeps the corpus fresh

Nothing in this package calls a chat model. It produces and retrieves text;
agents/research_chat/ is the only place that turns retrieved text into an
answer.
"""
