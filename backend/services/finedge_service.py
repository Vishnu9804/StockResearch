"""
services/finedge_service.py
High-reliability proxy for FinEdge API.
Production-grade features:
  - Rotating API keys
  - Request deduplication (coalescing)
  - Tiered TTL caching with stale-while-revalidate
  - Adaptive timeout per endpoint class
  - Exponential backoff retries (only 5xx / network errors)
  - Background refresh (stale served, fresh fetched async)
  - Persistent connection pool via shared AsyncClient
"""

import asyncio
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

import httpx

from core.config import settings

logger = logging.getLogger("finedge")

# ── 1. In-memory cache with stale-while-revalidate support ───────────────────
# Each entry: { "data": <Any>, "expires_at": float, "stale_until": float }
_cache: Dict[str, Dict[str, Any]] = {}

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

# ── 4. Shared persistent HTTP client (connection pool) ────────────────────────
# Single shared client avoids per-request TCP handshakes.
_http_client: Optional[httpx.AsyncClient] = None

def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            limits=httpx.Limits(max_connections=50, max_keepalive_connections=20),
            http2=False,  # FinEdge may not support HTTP/2
        )
    return _http_client

# ── 5. Adaptive timeout per endpoint class ────────────────────────────────────
def _get_timeout(endpoint: str) -> float:
    """Return a per-endpoint timeout (seconds) so slow endpoints don't get cut off."""
    ep = endpoint.lower()
    # Bulk/heavy endpoints — give more time
    if any(x in ep for x in ["corp-announcements", "insider", "block-deal", "bulk-deal",
                               "sast", "shareholding", "screener", "daily-feed"]):
        return 45.0
    # Financial data — moderate
    if any(x in ep for x in ["financials", "ratios", "corporate-actions", "documents", "notes"]):
        return 30.0
    # Live quotes — must be fast
    if "quote" in ep:
        return 10.0
    # Default
    return 20.0

# ── 6. Clamp query date ranges for FinEdge API constraints ───────────────────
def _clamp_query_dates(endpoint: str, query: Dict[str, Any]) -> None:
    ep = endpoint.lower()
    from_date_str = query.get("from_date")
    to_date_str = query.get("to_date")
    if not from_date_str or not to_date_str:
        return
    try:
        from_date = datetime.strptime(from_date_str, "%Y-%m-%d")
        to_date = datetime.strptime(to_date_str, "%Y-%m-%d")
    except ValueError:
        return

    # The market-wide feeds (no symbol filter) return every listed company's
    # disclosures for the window, so they're capped hard to avoid an enormous
    # response. A symbol-scoped query is filtered upstream to that one
    # company's filings (verified: a symbol-scoped corp-announcements query
    # returns only that company's records), so it's safe to allow a much
    # wider history — otherwise per-company document lookups (annual
    # reports, concalls, credit ratings) silently only ever see last week.
    has_symbol = bool(query.get("symbol"))
    if "investor-call-transcripts" in ep:
        max_days = 730 if has_symbol else 7
    elif "corp-announcements" in ep:
        max_days = 730 if has_symbol else 7
    else:
        return

    if (to_date - from_date).days > max_days:
        clamped = to_date - timedelta(days=max_days)
        query["from_date"] = clamped.strftime("%Y-%m-%d")
        logger.info(f"[FinEdge Date Clamp] {ep}: clamped from_date to {query['from_date']}")

# ── 7. Smart TTL strategy + stale-while-revalidate window ────────────────────
def _get_ttl(endpoint: str) -> tuple[int, int]:
    """
    Returns (fresh_ttl_seconds, stale_ttl_seconds).
    Data is served fresh within fresh_ttl.
    Between fresh_ttl and stale_ttl, stale data is served while a background
    refresh is triggered.
    After stale_ttl, a blocking fetch is required.
    """
    ep = endpoint.lower()

    # Live quotes → 5 min fresh, 15 min stale
    if "quote" in ep and "daily-quote" not in ep:
        return 5 * 60, 15 * 60

    # Market movers → 10 min fresh, 20 min stale
    if "daily-feed" in ep or "market/movers" in ep:
        return 10 * 60, 20 * 60

    # Announcements, results, insider → 30 min fresh, 60 min stale
    if any(x in ep for x in ["corp-announcements", "credit-ratings", "results-calendar",
                               "investor-call", "insider", "block-deal", "bulk-deal", "sast"]):
        return 30 * 60, 60 * 60

    # Corporate actions, IPO → 2h fresh, 4h stale
    if any(x in ep for x in ["corporate-actions", "ipo-calendar", "dividend", "price-returns"]):
        return 2 * 60 * 60, 4 * 60 * 60

    # Financials → 4h fresh, 8h stale
    if any(x in ep for x in ["financials", "basic-financials", "financial-metrics", "ratios",
                               "segment-revenue", "notes", "annual-price-ratios", "daily-quotes",
                               "daily-price-ratios", "shareholding", "ownership", "peers"]):
        return 4 * 60 * 60, 8 * 60 * 60

    # Master/reference → 24h fresh, 48h stale
    if any(x in ep for x in ["company-profile", "stock-symbols", "stock-search",
                               "index/master", "commodity-list", "holidays-calendar",
                               "name-changes", "symbol-changes"]):
        return 24 * 60 * 60, 48 * 60 * 60

    # Default → 10 min fresh, 20 min stale
    return 10 * 60, 20 * 60


def _cache_get(key: str) -> tuple[Any | None, bool]:
    """
    Returns (data, is_stale).
    data=None means no usable cache entry.
    is_stale=True means data is stale → trigger background refresh.
    """
    entry = _cache.get(key)
    if entry is None:
        return None, False
    now = time.time()
    if now < entry["expires_at"]:
        return entry["data"], False          # Fresh hit
    if now < entry["stale_until"]:
        return entry["data"], True           # Stale hit → serve but refresh async
    # Expired beyond stale window — remove
    _cache.pop(key, None)
    return None, False


def _cache_set(key: str, value: Any, fresh_ttl: int, stale_ttl: int):
    now = time.time()
    _cache[key] = {
        "data": value,
        "expires_at": now + fresh_ttl,
        "stale_until": now + stale_ttl,
    }


# ── 8. Retry predicate — only on 5xx and network errors ──────────────────────
def _should_retry(exc: Exception) -> bool:
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code >= 500 or exc.response.status_code == 429
    if isinstance(exc, (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError)):
        return True
    return False


# ── 9. Core fetch with retry + exponential backoff ───────────────────────────
async def _fetch_with_retry(
    method: str, endpoint: str, query: dict, body: Any, request_id: str
) -> Any:
    delay = 1.0
    last_exc: Exception = RuntimeError("Unknown error")

    for attempt in range(1, 4):  # 3 attempts total
        try:
            return await _do_fetch(method, endpoint, query, body, request_id)
        except Exception as exc:
            last_exc = exc
            if attempt >= 3 or not _should_retry(exc):
                raise
            logger.warning(f"[FinEdge] Retry {attempt}/3 in {delay}s — {type(exc).__name__}: {exc}")
            await asyncio.sleep(delay)
            delay = min(delay * 2, 10.0)  # cap at 10s

    raise last_exc


async def _do_fetch(method: str, endpoint: str, query: dict, body: Any, request_id: str) -> Any:
    api_key = _get_api_key()
    clean = endpoint.lstrip("/")
    if clean.startswith("api/v1/"):
        clean = clean[7:]

    url = f"{settings.FINEDGE_BASE_URL}/api/v1/{clean}"
    timeout = _get_timeout(endpoint)

    logger.info(f"[FinEdge] [{method}] {url} (timeout={timeout}s)")

    params = {k: v for k, v in query.items() if v is not None}
    params["token"] = api_key

    client = _get_http_client()

    try:
        response = await client.request(
            method=method,
            url=url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "X-API-Key": api_key,
                "X-Request-ID": request_id,
                "Content-Type": "application/json",
                "Accept-Encoding": "gzip, deflate",
            },
            params=params,
            json=body if body else None,
            timeout=httpx.Timeout(connect=10.0, read=timeout, write=10.0, pool=5.0),
        )
    except httpx.TimeoutException as exc:
        logger.error(f"[FinEdge] TIMEOUT after {timeout}s on {url}")
        raise

    response.raise_for_status()

    content = response.content.strip() if response.content else b""
    if not content:
        _list_endpoints = ["screener", "symbols", "peers", "list", "calendar",
                           "announcements", "history", "corporate-actions",
                           "documents", "ratios", "financials"]
        if any(x in clean for x in _list_endpoints):
            return []
        return {}

    try:
        return response.json()
    except ValueError:
        _list_endpoints = ["screener", "symbols", "peers", "list", "calendar",
                           "announcements", "history", "corporate-actions",
                           "documents", "ratios", "financials"]
        if any(x in clean for x in _list_endpoints):
            return []
        return {}


# ── 10. Main proxy executor — cache + dedup + stale-while-revalidate ─────────
async def execute_proxy_request(
    method: str,
    endpoint: str,
    query: Dict[str, Any] = {},
    body: Any = None,
    request_id: str = "",
) -> Any:
    import json

    _clamp_query_dates(endpoint, query)

    cache_key = (
        f"{method}:{endpoint}:"
        f"{json.dumps(query, sort_keys=True)}:"
        f"{json.dumps(body, sort_keys=True) if body else ''}"
    )

    # 1. Check cache (fresh or stale)
    cached_data, is_stale = _cache_get(cache_key)
    if cached_data is not None:
        if is_stale:
            logger.info(f"[FinEdge] Cache STALE — serving stale + triggering background refresh: {cache_key[:80]}")
            # Kick off background refresh without blocking the response
            asyncio.create_task(_background_refresh(method, endpoint, query, body, request_id, cache_key))
        else:
            logger.info(f"[FinEdge] Cache HIT: {cache_key[:80]}")
        return cached_data

    # 2. Deduplicate concurrent requests for the same key
    if cache_key in _active_requests:
        logger.info(f"[FinEdge] Deduplicating request: {cache_key[:80]}")
        return await _active_requests[cache_key]

    # 3. Bail early for demo keys
    if _is_demo_key():
        raise Exception("API keys are demo keys. Falling back to seed data.")

    # 4. Real fetch with dedup registration
    loop = asyncio.get_event_loop()
    future: asyncio.Future = loop.create_future()
    _active_requests[cache_key] = future

    try:
        result = await _fetch_with_retry(method, endpoint, query, body, request_id)
        fresh_ttl, stale_ttl = _get_ttl(endpoint)
        _cache_set(cache_key, result, fresh_ttl, stale_ttl)
        future.set_result(result)
        return result
    except Exception as exc:
        future.set_exception(exc)
        raise
    finally:
        _active_requests.pop(cache_key, None)


async def _background_refresh(
    method: str, endpoint: str, query: dict, body: Any, request_id: str, cache_key: str
):
    """Silently refresh a stale cache entry in the background."""
    if cache_key in _active_requests:
        return  # Already being refreshed
    try:
        result = await _fetch_with_retry(method, endpoint, query, body, request_id)
        fresh_ttl, stale_ttl = _get_ttl(endpoint)
        _cache_set(cache_key, result, fresh_ttl, stale_ttl)
        logger.info(f"[FinEdge] Background refresh DONE: {cache_key[:80]}")
    except Exception as exc:
        logger.warning(f"[FinEdge] Background refresh FAILED (stale still served): {exc}")
