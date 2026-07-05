"""
services/finedge_service.py
High-reliability proxy for FinEdge API.
Mirrors Express FinedgeService exactly:
  - Rotating API keys
  - Request deduplication
  - Tiered TTL caching
  - Exponential backoff retries
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict
from cachetools import TTLCache
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception
import httpx

from core.config import settings

logger = logging.getLogger("finedge")

# ── 1. In-memory cache (swap to Redis in production) ──────────────────────────
_cache: Dict[str, Any] = {}
_cache_expiry: Dict[str, float] = {}

# ── 2. Request deduplication registry ─────────────────────────────────────────
_active_requests: Dict[str, asyncio.Future] = {}

# ── 3. API key rotation ────────────────────────────────────────────────────────
_key_index = 0

def _get_api_key() -> str:
    global _key_index
    keys = settings.FINEDGE_API_KEYS
    key = keys[_key_index % len(keys)]
    _key_index += 1
    return key

def _is_demo_key() -> bool:
    return all(k in ("demo-key-1", "demo-key-2", "demo-key-3") for k in settings.FINEDGE_API_KEYS)

# ── 4. Smart TTL strategy (mirrors Express tier logic) ────────────────────────
def _get_ttl(endpoint: str) -> int:
    ep = endpoint.lower()

    # Tier 1: Live quotes — cache until midnight IST
    if "quote" in ep and "daily-quote" not in ep:
        now = datetime.now(timezone.utc)
        midnight = now.replace(hour=18, minute=30, second=0, microsecond=0)  # midnight IST = 18:30 UTC
        if now > midnight:
            midnight = midnight.replace(day=midnight.day + 1)
        return int((midnight - now).total_seconds())

    # Tier 2: Market movers — 15 min
    if "daily-feed" in ep or "market/movers" in ep:
        return 15 * 60

    # Tier 3: Announcements, results calendar — 30 min
    if any(x in ep for x in ["corp-announcements", "credit-ratings", "results-calendar", "investor-call"]):
        return 30 * 60

    # Tier 4: Corporate actions, IPO — 2 hours
    if any(x in ep for x in ["corporate-actions", "ipo-calendar", "dividend", "price-returns"]):
        return 2 * 60 * 60

    # Tier 5: Financials, ratios, shareholding — 4 hours
    if any(x in ep for x in ["financials", "basic-financials", "financial-metrics", "ratios",
                               "segment-revenue", "notes", "annual-price-ratios", "daily-quotes",
                               "daily-price-ratios", "shareholding", "ownership", "peers"]):
        return 4 * 60 * 60

    # Tier 6: Master/reference data — 24 hours
    if any(x in ep for x in ["company-profile", "stock-symbols", "stock-search",
                               "index/master", "commodity-list", "holidays-calendar",
                               "name-changes", "symbol-changes"]):
        return 24 * 60 * 60

    # Default — 10 min
    return 10 * 60


def _cache_get(key: str) -> Any | None:
    import time
    if key in _cache:
        if time.time() < _cache_expiry.get(key, 0):
            return _cache[key]
        else:
            _cache.pop(key, None)
            _cache_expiry.pop(key, None)
    return None


def _cache_set(key: str, value: Any, ttl: int):
    import time
    _cache[key] = value
    _cache_expiry[key] = time.time() + ttl


# ── 5. Retry predicate — only retry on 5xx and 429 ───────────────────────────
def _should_retry(exc: Exception) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code >= 500 or exc.response.status_code == 429
    if isinstance(exc, (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError)):
        return True
    return False


# ── 6. Main proxy executor ────────────────────────────────────────────────────
async def execute_proxy_request(
    method: str,
    endpoint: str,
    query: Dict[str, Any] = {},
    body: Any = None,
    request_id: str = ""
) -> Any:
    import json

    cache_key = f"{method}:{endpoint}:{json.dumps(query, sort_keys=True)}:{json.dumps(body, sort_keys=True) if body else ''}"

    # 1. Check cache
    cached = _cache_get(cache_key)
    if cached is not None:
        logger.info(f"[FinedgeService] Cache HIT: {cache_key[:80]}")
        return cached

    # 2. Deduplicate active requests
    if cache_key in _active_requests:
        logger.info(f"[FinedgeService] Deduplicating request: {cache_key[:80]}")
        return await _active_requests[cache_key]

    # 3. Bail early if demo keys — let callers fall back to seed data
    if _is_demo_key():
        raise Exception("API keys are demo keys. Falling back to seed data.")

    # 4. Build the actual request task with retry
    loop = asyncio.get_event_loop()
    future = loop.create_future()
    _active_requests[cache_key] = future

    try:
        result = await _fetch_with_retry(method, endpoint, query, body, request_id)

        # 5. Cache the result
        ttl = _get_ttl(endpoint)
        _cache_set(cache_key, result, ttl)

        future.set_result(result)
        return result

    except Exception as e:
        future.set_exception(e)
        raise

    finally:
        _active_requests.pop(cache_key, None)


async def _fetch_with_retry(method: str, endpoint: str, query: dict, body: Any, request_id: str) -> Any:
    attempt = 0
    delay = 1.0

    while True:
        try:
            return await _do_fetch(method, endpoint, query, body, request_id)
        except Exception as exc:
            attempt += 1
            if attempt >= 3 or not _should_retry(exc):
                raise
            logger.warning(f"[FinedgeService] Retry {attempt}/3 in {delay}s — {exc}")
            await asyncio.sleep(delay)
            delay *= 2


async def _do_fetch(method: str, endpoint: str, query: dict, body: Any, request_id: str) -> Any:
    api_key = _get_api_key()

    # Clean endpoint
    clean = endpoint.lstrip("/")
    if clean.startswith("api/v1/"):
        clean = clean[7:]

    url = f"{settings.FINEDGE_BASE_URL}/api/v1/{clean}"
    logger.info(f"[FinedgeService] [{method}] {url}")

    params = {k: v for k, v in query.items() if v is not None}
    params["token"] = api_key

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.request(
            method=method,
            url=url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "X-API-Key": api_key,
                "X-Request-ID": request_id,
                "Content-Type": "application/json",
            },
            params=params,
            json=body if body else None,
        )
        response.raise_for_status()
        
        content = response.content.strip() if response.content else b""
        if not content:
            if any(x in clean for x in ["screener", "symbols", "peers", "list", "calendar", "announcements", "history", "corporate-actions", "documents", "ratios", "financials"]):
                return []
            return {}
            
        try:
            return response.json()
        except ValueError:
            if any(x in clean for x in ["screener", "symbols", "peers", "list", "calendar", "announcements", "history", "corporate-actions", "documents", "ratios", "financials"]):
                return []
            return {}
