"""
core/market_hours.py
Tiny helper to know whether the Indian cash market (NSE/BSE) is currently open.

Used by the background sync (Phase 4) so we don't burn FinEdge rate-limit budget
refreshing live quotes at 3 AM when nothing is moving.

India Standard Time has no daylight saving, so a fixed UTC+5:30 offset is exact
and avoids depending on the OS tz database (important on Windows where zoneinfo
data may be absent).
"""

from __future__ import annotations

from datetime import datetime, time, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))

# Regular NSE/BSE equity session.
_MARKET_OPEN = time(9, 15)
_MARKET_CLOSE = time(15, 30)


def now_ist() -> datetime:
    return datetime.now(IST)


def is_weekend(dt: datetime | None = None) -> bool:
    dt = dt or now_ist()
    return dt.weekday() >= 5  # 5 = Saturday, 6 = Sunday


def is_market_open(dt: datetime | None = None) -> bool:
    """True only during the regular Mon–Fri 09:15–15:30 IST session.

    Exchange holidays are NOT modelled here — on a holiday this returns True but
    the upstream quote simply won't change, so at worst we make one harmless
    refresh. Keeping it holiday-agnostic avoids shipping a calendar that rots.
    """
    dt = dt or now_ist()
    if is_weekend(dt):
        return False
    return _MARKET_OPEN <= dt.time() <= _MARKET_CLOSE
