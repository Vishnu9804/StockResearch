"""agents/research_chat
The user-facing research assistant.

Structurally different from the other two workflows in this folder, on
purpose. agents/butterfly/ and agents/company_profiler/ are OFFLINE, multi-
stage pipelines: several chained model calls per item, run by a background
worker, where latency is irrelevant and per-item cost is amortised over every
user who later reads the output.

This one is ONLINE and single-stage: exactly one chat-model call per user
message, because it is the only path in the product where cost scales with how
much users type. Everything that would normally be a second model call —
deciding what the question is about, deciding which corpus to search,
re-ranking the results, checking the answer for advice language — is done in
plain Python instead (see services/rag/retriever.py and guardrails.py).

    prompts     the per-language-level system instruction + context format
    guardrails  topic gate before the call, advice check after it
    pipeline    retrieve -> assemble -> answer
"""
