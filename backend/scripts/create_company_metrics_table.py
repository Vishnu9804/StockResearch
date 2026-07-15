"""One-off script: creates the company_metrics table if it doesn't exist yet."""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.database import engine
from models.models import CompanyMetric


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(CompanyMetric.__table__.create, checkfirst=True)
    print("company_metrics table ready.")


if __name__ == "__main__":
    asyncio.run(main())
