"""services/rag/sources
One module per corpus. Each exposes `build_*` coroutines that return
RagSourceDocument objects and nothing else — no DB writes, no embedding calls.
See services/rag/schemas.py for the contract and why it is drawn there.
"""
