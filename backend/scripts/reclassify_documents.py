"""
scripts/reclassify_documents.py
Re-run services/document_sync.classify_document over every stored
company_documents row, so filings saved under an older classifier land in the
right Documents-tab section without waiting for each company's next sync.

    python scripts/reclassify_documents.py            # dry run: counts + samples per move
    python scripts/reclassify_documents.py --commit   # apply

Stored rows keep only the filing's description (as `title`), not the exchange
category, which classify_document handles. Rows already in 'presentation' are
never moved: that category only ever came from FinEdge's dedicated
investor-presentations feed, which is authoritative on its own. No FinEdge or
LLM call is made.
"""
import argparse
import asyncio
import os
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, update  # noqa: E402

from core.database import async_session_maker  # noqa: E402
from models.models import CompanyDocument  # noqa: E402
from services.document_sync import classify_document  # noqa: E402


async def main() -> None:
    parser = argparse.ArgumentParser(description="Reclassify stored company documents.")
    parser.add_argument("--commit", action="store_true", help="Apply changes (default is a dry run).")
    args = parser.parse_args()

    async with async_session_maker() as session:
        rows = (await session.execute(select(CompanyDocument.id, CompanyDocument.category, CompanyDocument.title))).all()

    moves: dict[str, list] = defaultdict(list)
    transitions: Counter = Counter()
    samples: dict[tuple, list[str]] = defaultdict(list)
    for doc_id, old, title in rows:
        if old == "presentation":
            continue
        new = classify_document(None, title)
        if new != old:
            moves[new].append(doc_id)
            transitions[(old, new)] += 1
            if len(samples[(old, new)]) < 4:
                samples[(old, new)].append((title or "")[:110])

    print(f"{len(rows)} documents scanned, {sum(transitions.values())} would change")
    for (old, new), n in transitions.most_common():
        print(f"  {old:>14} -> {new:<18} {n}")
        for s in samples[(old, new)]:
            print(f"      e.g. {s}")

    if not args.commit:
        print("\nDry run — re-run with --commit to apply.")
        return

    async with async_session_maker() as session:
        for new, ids in moves.items():
            for start in range(0, len(ids), 5000):
                await session.execute(
                    update(CompanyDocument).where(CompanyDocument.id.in_(ids[start:start + 5000])).values(category=new)
                )
        await session.commit()
    print("Applied.")


if __name__ == "__main__":
    asyncio.run(main())
