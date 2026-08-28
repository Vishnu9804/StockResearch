"""Pre-generates company_ai_summaries rows for a fixed pilot list of
well-known, large-cap NSE companies, so the "AI Summary" tab has cached data
ready before anyone clicks into it in the frontend — no user should be the
one paying the first LLM-call cost during a demo.

    python scripts/generate_ai_summaries.py                 # the pilot list below
    python scripts/generate_ai_summaries.py RELIANCE TCS    # explicit symbols

Sequential, not concurrent, on purpose: this is a manual/occasional run, not
the production sweep (services/ai_summary/pipeline.py::sync_ai_summaries_batch
handles that, on its own schedule, for the full universe), so there's no
reason to burst multiple companies' worth of ZLM calls at once.
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Summaries routinely contain non-ASCII characters (Rupee sign, etc.) —
# Windows consoles often default to a legacy codepage (cp1252) that can't
# encode them, which crashes a plain print() mid-batch. Reconfiguring stdout
# to UTF-8 makes this script's output encoding-safe regardless of the
# terminal it's run from.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from services.ai_summary.pipeline import generate_summary_for_symbol  # noqa: E402
from services.document_sync import sync_one_symbol  # noqa: E402
from core.database import async_session_maker  # noqa: E402

# Ten well-known, large-cap NSE companies spanning different sectors — picked
# for name recognition during a client demo, not by any programmatic
# ranking. (A market-cap-ranked list is trivially available from
# company_metrics for the real production sweep; this is just the pilot set.)
PILOT_SYMBOLS = [
    "RELIANCE",    # Reliance Industries — energy/retail/telecom conglomerate
    "TCS",         # Tata Consultancy Services — IT services
    "HDFCBANK",    # HDFC Bank — private banking
    "INFY",        # Infosys — IT services
    "ICICIBANK",   # ICICI Bank — private banking
    "HINDUNILVR",  # Hindustan Unilever — FMCG
    "SBIN",        # State Bank of India — public sector banking
    "BHARTIARTL",  # Bharti Airtel — telecom
    "ITC",         # ITC Limited — FMCG/conglomerate
    "LT",          # Larsen & Toubro — infrastructure/engineering
]


async def main(symbols: list[str]) -> None:
    for symbol in symbols:
        symbol = symbol.upper()
        print(f"\n=== {symbol} ===")
        try:
            async with async_session_maker() as db:
                n = await sync_one_symbol(db, symbol)
            print(f"  documents synced: {n}")
        except Exception as exc:
            print(f"  document sync failed: {exc}")
            continue

        try:
            row = await generate_summary_for_symbol(symbol, force=True)
        except Exception as exc:
            print(f"  FAILED: {exc}")
            continue

        if row is None:
            print("  symbol not found in company_metrics — skipped")
            continue

        print(f"  status: {row.status}")
        print(f"  quarter: {row.quarter_label}")
        print(f"  documents covered: {len(row.documents_covered)}, skipped: {len(row.documents_skipped)}")
        print(f"  overview: {row.overview[:200]}")


if __name__ == "__main__":
    symbols = sys.argv[1:] or PILOT_SYMBOLS
    asyncio.run(main(symbols))
