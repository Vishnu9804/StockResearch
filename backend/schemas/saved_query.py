import uuid
from datetime import datetime

from schemas.watchlist import CamelModel


class SavedQueryCreate(CamelModel):
    name: str
    query_text: str
    alert_enabled: bool = False
    alert_frequency: str = "IMMEDIATE"


class SavedQueryUpdate(CamelModel):
    name: str | None = None
    query_text: str | None = None
    alert_enabled: bool | None = None
    alert_frequency: str | None = None


class SavedQueryOut(CamelModel):
    id: uuid.UUID
    name: str
    query_text: str
    alert_enabled: bool
    alert_frequency: str
    created_at: datetime
    updated_at: datetime
