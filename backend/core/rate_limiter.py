"""
core/rate_limiter.py
Global throttle for outbound FinEdge calls (Phase 0 — the real 300 calls/min cap).

Every FinEdge HTTP request passes through one token bucket so the provider's
per-minute limit is never exceeded — no matter whether the call comes from a
user request (proxy cache miss) or the background sync, and no matter how bursty
`asyncio.gather` makes the sync.

Two implementations, chosen automatically:
  * RedisTokenBucket   — a single bucket SHARED across every process (web
                         workers + the sync worker) via an atomic Lua script.
                         This is what actually holds the whole deployment under
                         300/min when Redis is configured.
  * InProcessBucket    — a per-process asyncio bucket used when Redis is absent.
                         Correct for single-process dev; with multiple processes
                         each gets its own budget, so configure Redis in prod.

A token bucket (not a fixed window) is used so calls are *smoothed* to a steady
rate instead of arriving in bursts that spike over the limit at window edges.
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Optional

from core.config import settings

logger = logging.getLogger("rate_limiter")


class InProcessBucket:
    """Async token bucket local to this process."""

    def __init__(self, rate_per_sec: float, capacity: float) -> None:
        self._rate = rate_per_sec
        self._capacity = capacity
        self._tokens = capacity
        self._updated = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        while True:
            async with self._lock:
                now = time.monotonic()
                self._tokens = min(
                    self._capacity, self._tokens + (now - self._updated) * self._rate
                )
                self._updated = now
                if self._tokens >= 1:
                    self._tokens -= 1
                    return
                wait = (1 - self._tokens) / self._rate
            await asyncio.sleep(wait)


# Atomic token-bucket refill+consume. Returns {allowed(0/1), wait_seconds(str)}.
_LUA_TOKEN_BUCKET = """
local key = KEYS[1]
local rate = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1])
local ts = tonumber(data[2])
if tokens == nil then
  tokens = capacity
  ts = now
end
local delta = math.max(0, now - ts) / 1000.0
tokens = math.min(capacity, tokens + delta * rate)
local allowed = 0
local wait = 0.0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
else
  wait = (1 - tokens) / rate
end
redis.call('HSET', key, 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', key, math.ceil((capacity / rate) * 1000) + 2000)
return {allowed, tostring(wait)}
"""


class RedisTokenBucket:
    """Distributed token bucket shared by every process via Redis."""

    _KEY = "finedge:ratelimit"

    def __init__(self, client, rate_per_sec: float, capacity: float) -> None:
        self._client = client
        self._rate = rate_per_sec
        self._capacity = capacity
        self._script = client.register_script(_LUA_TOKEN_BUCKET)

    async def acquire(self) -> None:
        while True:
            try:
                now_ms = int(time.time() * 1000)
                allowed, wait = await self._script(
                    keys=[self._KEY],
                    args=[self._rate, self._capacity, now_ms],
                )
            except Exception as exc:  # pragma: no cover - network hiccup
                # Never let a limiter outage block the request path outright;
                # degrade to a fixed small pause so we still don't hammer.
                logger.warning("[RateLimiter] Redis limiter failed (%s); pausing briefly", exc)
                await asyncio.sleep(0.2)
                return
            if int(allowed) == 1:
                return
            await asyncio.sleep(max(float(wait), 0.01))


_limiter: Optional[object] = None


def _effective_rate_per_sec() -> float:
    # Apply a safety margin so we stay comfortably UNDER the provider's hard cap
    # (bursts from the token capacity plus in-flight retries need headroom).
    safe_per_min = settings.FINEDGE_MAX_CALLS_PER_MINUTE * settings.FINEDGE_RATE_LIMIT_SAFETY
    return max(safe_per_min / 60.0, 0.1)


async def get_rate_limiter():
    """Return the process-wide limiter, building it once. Prefers the shared
    Redis bucket, reusing the cache's Redis client when one exists."""
    global _limiter
    if _limiter is not None:
        return _limiter

    rate = _effective_rate_per_sec()
    capacity = max(float(settings.FINEDGE_RATE_LIMIT_BURST), 1.0)

    client = None
    try:
        from core.cache import get_redis_client

        client = await get_redis_client()
    except Exception:
        client = None

    if client is not None:
        _limiter = RedisTokenBucket(client, rate, capacity)
        logger.info(
            "[RateLimiter] Using SHARED Redis token bucket (~%.1f calls/min, burst %.0f)",
            rate * 60,
            capacity,
        )
    else:
        _limiter = InProcessBucket(rate, capacity)
        logger.info(
            "[RateLimiter] Using per-process token bucket (~%.1f calls/min, burst %.0f)",
            rate * 60,
            capacity,
        )
    return _limiter


def reset_rate_limiter() -> None:
    """Test/wiring helper — forces the limiter to be rebuilt on next use."""
    global _limiter
    _limiter = None


async def acquire_finedge_slot() -> None:
    limiter = await get_rate_limiter()
    await limiter.acquire()
