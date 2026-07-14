import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class WatchlistCreate(CamelModel):
    name: str


class WatchlistRename(CamelModel):
    name: str


class WatchlistItemCreate(CamelModel):
    symbol: str
    company_name: str | None = None
    target_price: float | None = None
    alert_enabled: bool = False


class WatchlistItemUpdate(CamelModel):
    target_price: float | None = None
    alert_enabled: bool | None = None


class MoveItemBody(CamelModel):
    target_watchlist_id: uuid.UUID


class WatchBody(CamelModel):
    symbol: str
    company_name: str | None = None


class WatchlistItemOut(CamelModel):
    id: uuid.UUID
    watchlist_id: uuid.UUID
    symbol: str
    company_name: str | None
    target_price: float | None
    alert_enabled: bool
    created_at: datetime


class WatchlistOut(CamelModel):
    id: uuid.UUID
    name: str
    created_at: datetime
    updated_at: datetime
    items: list[WatchlistItemOut] = []
