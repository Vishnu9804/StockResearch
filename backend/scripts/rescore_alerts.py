"""
scripts/rescore_alerts.py
Re-run the Butterfly alert scorer (Workflow B) over recent analyses against
every user's CURRENT portfolio holdings. Run it after editing holdings
directly in the database — portfolios have no edit API, and alerts are
otherwise only computed at the moment a news item is analysed.

    python scripts/rescore_alerts.py            # news from the last NEWS_RETENTION_DAYS
    python scripts/rescore_alerts.py --days 7

Deletes alerts on symbols a user no longer holds and adds alerts for newly
held ones; existing alerts (and their read/dismissed state) are left as they
are. Nothing here calls an LLM, so running it costs nothing.
"""
import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.butterfly.pipeline import WORKFLOW_VERSION  # noqa: E402
from services.butterfly_scorer import rescore_recent_analyses  # noqa: E402


async def main() -> None:
    parser = argparse.ArgumentParser(description="Re-score Butterfly alerts against current holdings.")
    parser.add_argument("--days", type=int, default=None, help="Look-back window by news publish date.")
    args = parser.parse_args()
    print(await rescore_recent_analyses(WORKFLOW_VERSION, args.days))


if __name__ == "__main__":
    asyncio.run(main())
