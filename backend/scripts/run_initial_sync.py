"""One-off script: populates company_metrics with an initial data set —
bulk quote sync for the whole universe, then fundamentals for the top
symbols by market cap so the screener has real, meaningful data immediately."""
import asyncio
import sys
import os
import logging

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)-8s - %(name)s - %(message)s")

from core.database import async_session_maker
from services.metrics_sync import sync_quote_data, sync_fundamentals_batch


async def main():
    async with async_session_maker() as db:
        n = await sync_quote_data(db)
        print(f"Quote sync: {n} symbols")

    total_enriched = 0
    async with async_session_maker() as db:
        for i in range(5):
            n = await sync_fundamentals_batch(db, batch_size=100)
            total_enriched += n
            print(f"Fundamentals batch {i + 1}: {n} symbols enriched (total {total_enriched})")
            if n == 0:
                break


if __name__ == "__main__":
    asyncio.run(main())
