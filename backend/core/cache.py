"""
core/cache.py
Shared cache backend for the FinEdge proxy (Phase 2).

Why this exists
---------------
The proxy used to keep responses in a plain module-level ``dict``. That works
for a single process, but the moment the API runs with multiple Uvicorn workers
(or on several servers) each process has its OWN dict, so the "one upstream call
serves everyone" guarantee breaks and FinEdge gets hit N times for the same
data. Moving the cache into Redis gives every worker/server ONE shared cache.

Design goals
------------
* **Same stale-while-revalidate semantics** as before: ``get`` returns
  ``(data, is_stale)`` where ``is_stale`` means "serve this now, refresh in the
  background".
* **Graceful degradation**: if ``REDIS_URL`` is unset, the ``redis`` package is
  not installed, or Redis is unreachable at startup, we silently fall back to an
  in-process memory cache. The application never fails because of caching.
* **Async, singleton backend** chosen once at startup via :func:`init_cache`.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
from typing import Any, Optional, Protocol, Tuple

from core.config import settings

logger = logging.getLogger("cache")

# A cache entry is stored as: {"data": <Any>, "expires_at": float, "stale_until": float}
_KEY_PREFIX = "finedge:"


def make_key(raw: str) -> str:
    """Namespace + shorten an arbitrary cache key so Redis keys stay tidy and
    bounded in length regardless of how long the raw request signature is."""
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()
    return f"{_KEY_PREFIX}{digest}"


class CacheBackend(Protocol):
    """Minimal async cache contract used by the FinEdge proxy."""

    async def get(self, key: str) -> Tuple[Any | None, bool]:
        """Return ``(data, is_stale)``. ``data is None`` means no usable entry."""
        ...

    async def set(self, key: str, value: Any, fresh_ttl: int, stale_ttl: int) -> None:
        ...

    async def close(self) -> None:
        ...


class MemoryCache:
    """Per-process in-memory cache. Identical behaviour to the original dict
    implementation — used as the safe fallback when Redis is not configured."""

    def __init__(self) -> None:
        self._store: dict[str, dict[str, Any]] = {}

    async def get(self, key: str) -> Tuple[Any | None, bool]:
        entry = self._store.get(key)
        if entry is None:
            return None, False
        now = time.time()
        if now < entry["expires_at"]:
            return entry["data"], False          # Fresh hit
        if now < entry["stale_until"]:
            return entry["data"], True            # Stale hit → serve + refresh
        self._store.pop(key, None)                # Beyond stale window — drop
        return None, False

    async def set(self, key: str, value: Any, fresh_ttl: int, stale_ttl: int) -> None:
        now = time.time()
        self._store[key] = {
            "data": value,
            "expires_at": now + fresh_ttl,
            "stale_until": now + stale_ttl,
        }

    async def close(self) -> None:
        self._store.clear()


class RedisCache:
    """Shared cache backed by Redis. The JSON-encoded entry carries its own
    freshness timestamps; the Redis key TTL is set to the stale window so
    abandoned entries are reclaimed automatically."""

    def __init__(self, client: Any) -> None:
        self._client = client

    async def get(self, key: str) -> Tuple[Any | None, bool]:
        try:
            raw = await self._client.get(key)
        except Exception as exc:  # pragma: no cover - network hiccup
            logger.warning("[Cache] Redis GET failed (%s); treating as miss", exc)
            return None, False
        if not raw:
            return None, False
        try:
            entry = json.loads(raw)
        except (ValueError, TypeError):
            return None, False
        now = time.time()
        if now < entry.get("expires_at", 0):
            return entry.get("data"), False
        if now < entry.get("stale_until", 0):
            return entry.get("data"), True
        return None, False

    async def set(self, key: str, value: Any, fresh_ttl: int, stale_ttl: int) -> None:
        now = time.time()
        entry = {
            "data": value,
            "expires_at": now + fresh_ttl,
            "stale_until": now + stale_ttl,
        }
        try:
            await self._client.set(key, json.dumps(entry), ex=max(int(stale_ttl), 1))
        except Exception as exc:  # pragma: no cover - network hiccup
            logger.warning("[Cache] Redis SET failed (%s); entry not cached", exc)

    async def close(self) -> None:
        try:
            await self._client.aclose()
        except Exception:  # pragma: no cover
            pass


# ── Singleton backend, selected once at startup ──────────────────────────────
_backend: Optional[CacheBackend] = None


async def _create_backend() -> CacheBackend:
    """Prefer Redis when configured and reachable; otherwise fall back to
    in-memory. Any failure downgrades gracefully — caching is never fatal."""
    if settings.REDIS_URL:
        try:
            import redis.asyncio as aioredis  # imported lazily so the dep is optional

            client = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            await client.ping()
            logger.info("[Cache] Using Redis backend at %s", settings.REDIS_URL)
            return RedisCache(client)
        except ModuleNotFoundError:
            logger.warning(
                "[Cache] REDIS_URL is set but the 'redis' package is not installed; "
                "falling back to in-memory cache. Run: pip install redis"
            )
        except Exception as exc:
            logger.warning(
                "[Cache] Redis unreachable (%s); falling back to in-memory cache", exc
            )
    else:
        logger.info("[Cache] REDIS_URL not set; using per-process in-memory cache")
    return MemoryCache()


async def init_cache() -> CacheBackend:
    """Eagerly initialise the backend at application startup (idempotent)."""
    global _backend
    if _backend is None:
        _backend = await _create_backend()
    return _backend


async def _get_backend() -> CacheBackend:
    if _backend is None:
        return await init_cache()
    return _backend


async def cache_get(raw_key: str) -> Tuple[Any | None, bool]:
    backend = await _get_backend()
    return await backend.get(make_key(raw_key))


async def cache_set(raw_key: str, value: Any, fresh_ttl: int, stale_ttl: int) -> None:
    backend = await _get_backend()
    await backend.set(make_key(raw_key), value, fresh_ttl, stale_ttl)


async def get_redis_client():
    """Return the live Redis client if the active backend is Redis, else None.
    Lets other subsystems (e.g. the rate limiter) share one connection."""
    backend = await _get_backend()
    if isinstance(backend, RedisCache):
        return backend._client
    return None


async def close_cache() -> None:
    global _backend
    if _backend is not None:
        await _backend.close()
        _backend = None
