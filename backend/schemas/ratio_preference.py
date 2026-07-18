import uuid
from datetime import datetime

from schemas.watchlist import CamelModel


class RatioPreferenceAdd(CamelModel):
    ratio_keys: list[str]


class RatioPreferenceOut(CamelModel):
    id: uuid.UUID
    ratio_key: str
    created_at: datetime
