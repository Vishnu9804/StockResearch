import uuid
from datetime import date, datetime

from schemas.watchlist import CamelModel


class PortfolioHoldingOut(CamelModel):
    id: uuid.UUID
    portfolio_id: uuid.UUID
    symbol: str
    company_name: str | None
    quantity: float
    avg_buy_price: float
    buy_date: date | None
    created_at: datetime


class PortfolioOut(CamelModel):
    id: uuid.UUID
    name: str
    created_at: datetime
    updated_at: datetime
    holdings: list[PortfolioHoldingOut] = []
