import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import CompanyMetric

logger = logging.getLogger("seed")

SEED_COMPANIES = [
    {
        "symbol": "COALINDIA",
        "name": "Coal India Ltd",
        "sector": "Metals & Mining",
        "industry": "Coal",
        "cmp": 432.35,
        "change_pct": 1.15,
        "market_cap": 266506.31,
        "pe": 8.57,
        "pb": 2.1,
        "dividend_yield": 6.13,
        "roe": 47.07,
        "roce": 35.34,
        "debt_to_equity": 0.05,
        "sales_growth_3y": 12.86,
        "profit_growth_3y": 24.69,
        "net_profit_margin": 16.5,
        "ebitda_margin": 22.4,
        "promoter_holding": 63.13,
        "fii_holding": 7.82,
        "current_ratio": 1.45,
        "interest_coverage": 45.2,
        "high_52w": 487.6,
        "low_52w": 280.2,
        "eps": 50.4,
        "book_value": 205.8,
        "rsi14": 52.4,
        "beta": 0.85
    },
    {
        "symbol": "NMDC",
        "name": "NMDC Ltd",
        "sector": "Metals & Mining",
        "industry": "Iron Ore",
        "cmp": 85.07,
        "change_pct": -0.45,
        "market_cap": 74783.23,
        "pe": 10.04,
        "pb": 1.45,
        "dividend_yield": 3.88,
        "roe": 41.29,
        "roce": 27.58,
        "debt_to_equity": 0.02,
        "sales_growth_3y": 8.5,
        "profit_growth_3y": 14.2,
        "net_profit_margin": 22.1,
        "ebitda_margin": 32.5,
        "promoter_holding": 60.79,
        "fii_holding": 5.42,
        "current_ratio": 2.10,
        "interest_coverage": 120.4,
        "high_52w": 280.5,
        "low_52w": 105.4,
        "eps": 8.47,
        "book_value": 58.6,
        "rsi14": 44.5,
        "beta": 1.15
    },
    {
        "symbol": "PETRONET",
        "name": "Petronet LNG Ltd",
        "sector": "Energy & Oil",
        "industry": "Gas Distribution",
        "cmp": 275.50,
        "change_pct": 0.85,
        "market_cap": 41325.00,
        "pe": 10.56,
        "pb": 2.8,
        "dividend_yield": 3.63,
        "roe": 30.11,
        "roce": 22.74,
        "debt_to_equity": 0.10,
        "sales_growth_3y": 15.4,
        "profit_growth_3y": 12.8,
        "net_profit_margin": 6.8,
        "ebitda_margin": 10.2,
        "promoter_holding": 50.00,
        "fii_holding": 34.12,
        "current_ratio": 1.85,
        "interest_coverage": 18.5,
        "high_52w": 315.4,
        "low_52w": 195.2,
        "eps": 26.08,
        "book_value": 98.4,
        "rsi14": 48.2,
        "beta": 0.65
    },
    {
        "symbol": "RELIANCE",
        "name": "Reliance Industries Ltd",
        "sector": "Energy & Oil",
        "industry": "Conglomerate",
        "cmp": 1321.70,
        "change_pct": 1.36,
        "market_cap": 1788586.84,
        "pe": 25.4,
        "pb": 2.5,
        "dividend_yield": 0.75,
        "roe": 10.2,
        "roce": 9.5,
        "debt_to_equity": 0.38,
        "sales_growth_3y": 14.8,
        "profit_growth_3y": 11.4,
        "net_profit_margin": 8.01,
        "ebitda_margin": 14.25,
        "promoter_holding": 50.39,
        "fii_holding": 22.1,
        "current_ratio": 1.25,
        "interest_coverage": 7.45,
        "high_52w": 1611.8,
        "low_52w": 1253.2,
        "eps": 52.03,
        "book_value": 528.6,
        "rsi14": 49.5,
        "beta": 0.98
    },
    {
        "symbol": "TCS",
        "name": "Tata Consultancy Services Ltd",
        "sector": "Information Technology",
        "industry": "IT Services",
        "cmp": 3850.00,
        "change_pct": -0.85,
        "market_cap": 1400000.00,
        "pe": 30.2,
        "pb": 12.4,
        "dividend_yield": 1.25,
        "roe": 38.4,
        "roce": 45.6,
        "debt_to_equity": 0.02,
        "sales_growth_3y": 11.5,
        "profit_growth_3y": 9.8,
        "net_profit_margin": 19.5,
        "ebitda_margin": 24.5,
        "promoter_holding": 72.4,
        "fii_holding": 12.8,
        "current_ratio": 2.85,
        "interest_coverage": 150.0,
        "high_52w": 4250.0,
        "low_52w": 3100.0,
        "eps": 127.48,
        "book_value": 310.48,
        "rsi14": 42.4,
        "beta": 0.78
    },
    {
        "symbol": "INFY",
        "name": "Infosys Ltd",
        "sector": "Information Technology",
        "industry": "IT Services",
        "cmp": 1480.00,
        "change_pct": 0.25,
        "market_cap": 610000.00,
        "pe": 24.5,
        "pb": 8.5,
        "dividend_yield": 2.15,
        "roe": 31.2,
        "roce": 36.4,
        "debt_to_equity": 0.04,
        "sales_growth_3y": 14.2,
        "profit_growth_3y": 11.2,
        "net_profit_margin": 16.8,
        "ebitda_margin": 21.2,
        "promoter_holding": 14.94,
        "fii_holding": 34.2,
        "current_ratio": 2.45,
        "interest_coverage": 95.0,
        "high_52w": 1750.0,
        "low_52w": 1220.0,
        "eps": 60.4,
        "book_value": 174.1,
        "rsi14": 54.8,
        "beta": 0.85
    }
]

async def seed_metrics(db: AsyncSession):
    try:
        # Check if table already has data
        result = await db.execute(select(CompanyMetric).limit(1))
        if result.scalar_one_or_none():
            logger.info("CompanyMetric table already has data. Skipping seed.")
            return

        logger.info("Seeding initial company metrics...")
        for data in SEED_COMPANIES:
            metric = CompanyMetric(**data)
            db.add(metric)
        await db.commit()
        logger.info("Successfully seeded company metrics.")
    except Exception as e:
        logger.error(f"Error seeding company metrics: {e}")
        await db.rollback()
