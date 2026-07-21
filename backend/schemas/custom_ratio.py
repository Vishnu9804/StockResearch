import uuid
from datetime import datetime

from schemas.watchlist import CamelModel


class CustomRatioCreate(CamelModel):
    name: str
    formula: str
    description: str | None = None


class CustomRatioUpdate(CamelModel):
    name: str | None = None
    formula: str | None = None
    description: str | None = None


class CustomRatioOut(CamelModel):
    id: uuid.UUID
    name: str
    formula: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class EvaluateFormulaBody(CamelModel):
    formula: str
    symbol: str
