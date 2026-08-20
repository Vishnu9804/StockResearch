"""
scripts/exit_test_mode.py
THE one command that takes the Butterfly Effect workflow from "testing on a
hand-written news set" to "running on the real marketaux feed in production".

Run it when you're done demoing/testing:

    python scripts/exit_test_mode.py            # dry run — shows what WOULD change
    python scripts/exit_test_mode.py --commit   # actually does it

What it does, in one pass:

  1. Deletes every hand-seeded test news item (news_items.source_type='MANUAL').
     Their news_impact_analyses, news_thematic_research and user_news_alerts
     rows go with them automatically — every one of those FKs is declared
     ON DELETE CASCADE (migrations/001, 002), so there is no orphan left
     behind in any related table. Real ingested news (source_type MARKETAUX /
     RSS / GDELT / FINEDGE_ANNOUNCEMENT / PRESS_RELEASE) is never touched.

  2. Clears BUTTERFLY_TEST_NEWS_IDS in backend/.env. That single env var is
     the whole test-mode gate: while it holds ids, agents/butterfly/worker.py's
     _claim_batch() claims ONLY those rows and ignores the real queue entirely.
     Empty = normal production polling, which is exactly what
     core/config.py documents as the default.

  3. Points BUTTERFLY_ANALYSIS_MIN_INGESTED_AT at "now" (UTC) by default, so
     the worker starts on news arriving from this moment forward instead of
     back-processing however many weeks of history already sit in news_items —
     that backlog is real ZLM spend nobody asked for. Pass --process-backlog
     to clear the cutoff instead and work through everything oldest-first
     (correct for a true production launch, but know what it will cost first:
     roughly 3 model calls per item, more on items that earn O2 research).

Nothing here calls an LLM, so running it costs nothing.
"""
import argparse
import asyncio
import os
import re
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text  # noqa: E402

from core.database import async_session_maker  # noqa: E402

ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")


def _set_env_var(content: str, key: str, value: str) -> str:
    """Replaces `key=...` (commented or not) with `key=value`, appending if absent.
    Only touches the one assignment line — every surrounding comment, which in
    this project carries the reasoning for the setting, is preserved."""
    pattern = re.compile(rf"^{re.escape(key)}\s*=.*$", re.MULTILINE)
    if pattern.search(content):
        return pattern.sub(f"{key}={value}", content)
    return content.rstrip("\n") + f"\n{key}={value}\n"


async def main() -> None:
    parser = argparse.ArgumentParser(description="Switch the Butterfly workflow from test mode to production.")
    parser.add_argument("--commit", action="store_true", help="Apply changes (default is a dry run).")
    parser.add_argument(
        "--process-backlog", action="store_true",
        help="Clear the ingestion cutoff so the worker also analyses already-stored older news. "
             "Costs real model spend proportional to the backlog size — read the module docstring first.",
    )
    args = parser.parse_args()

    async with async_session_maker() as session:
        manual_count = await session.scalar(
            text("select count(*) from news_items where source_type = 'MANUAL'")
        )
        analyses = await session.scalar(text(
            "select count(*) from news_impact_analyses a join news_items n on n.id = a.news_id "
            "where n.source_type = 'MANUAL'"))
        thematic = await session.scalar(text(
            "select count(*) from news_thematic_research r join news_items n on n.id = r.news_id "
            "where n.source_type = 'MANUAL'"))
        alerts = await session.scalar(text(
            "select count(*) from user_news_alerts u join news_items n on n.id = u.news_id "
            "where n.source_type = 'MANUAL'"))
        real_pending = await session.scalar(text(
            "select count(*) from news_items where source_type <> 'MANUAL' "
            "and analysis_status in ('PENDING','TRIAGED')"))

    print("Test data that will be removed:")
    print(f"  news_items (MANUAL)........ {manual_count}")
    print(f"  news_impact_analyses....... {analyses}  (cascade)")
    print(f"  news_thematic_research..... {thematic}  (cascade)")
    print(f"  user_news_alerts........... {alerts}  (cascade)")
    print(f"\nReal ingested news currently queued for analysis: {real_pending}")

    cutoff = "" if args.process_backlog else datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    print("\n.env changes:")
    print("  BUTTERFLY_TEST_NEWS_IDS............ (cleared — resumes normal production polling)")
    print(f"  BUTTERFLY_ANALYSIS_MIN_INGESTED_AT. {cutoff or '(cleared — will process the full backlog)'}")

    if not args.commit:
        print("\nDRY RUN — nothing changed. Re-run with --commit to apply.")
        return

    async with async_session_maker() as session:
        result = await session.execute(
            text("delete from news_items where source_type = 'MANUAL' returning id")
        )
        deleted = len(result.fetchall())
        await session.commit()

    with open(ENV_PATH, "r", encoding="utf-8") as handle:
        content = handle.read()
    content = _set_env_var(content, "BUTTERFLY_TEST_NEWS_IDS", "")
    content = _set_env_var(content, "BUTTERFLY_ANALYSIS_MIN_INGESTED_AT", cutoff)
    with open(ENV_PATH, "w", encoding="utf-8") as handle:
        handle.write(content)

    print(f"\nDone. Deleted {deleted} test news item(s) and updated .env.")
    print("Restart the backend so it picks up the new .env — the workflow will then")
    print("analyse real ingested news automatically, with no further changes.")


if __name__ == "__main__":
    asyncio.run(main())
