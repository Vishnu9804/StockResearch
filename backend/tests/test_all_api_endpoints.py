"""
Deep smoke test for all APIs documented in api-frontend-usage-curl.csv.
Run against a live server: pytest tests/test_all_api_endpoints.py -v -s
Or in-process: pytest tests/test_all_api_endpoints.py -v -s (uses conftest client)
"""

import re
import uuid
import pytest
from httpx import AsyncClient

SYMBOL = "ITC"
INDEX = "nifty-50"
WL_ID = "test-wl-id"
ITEM_ID = "test-item-id"
SCREEN_ID = "test-screen-id"
NOTIF_ID = "test-notif-id"
PORTFOLIO_ID = "test-portfolio-id"
HOLDING_ID = "test-holding-id"
QUERY_ID = "test-query-id"

# (method, path_template, json_body, query_params, expect_statuses, category)
ENDPOINTS = [
    ("GET", "/health", None, None, {200}, "infra"),
    ("POST", "/api/auth/signup", {"email": "deep_test_{uid}@example.com", "password": "TestPass123!", "name": "Deep Test"}, None, {201}, "auth"),
    ("POST", "/api/auth/login", {"email": "free@finscreen.in", "password": "free@finscreen.in", "rememberMe": False}, None, {200}, "auth"),
    ("GET", "/api/auth/profile", None, None, {200}, "auth"),
    ("POST", "/api/auth/logout", None, None, {200}, "auth"),
    ("GET", "/api/finscreen/stock-symbols", None, {"query": "REL"}, {200}, "finscreen"),
    ("GET", "/api/finscreen/stock-search", None, {"group": "sector", "value": "IT"}, {200}, "finscreen"),
    ("GET", "/api/finscreen/name-changes", None, None, {200, 400, 502}, "finscreen"),
    ("GET", "/api/finscreen/symbol-changes", None, None, {200, 400, 502}, "finscreen"),
    ("GET", f"/api/finscreen/company/{SYMBOL}/profile", None, None, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/company/{SYMBOL}/basic-financials", None, None, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/company/{SYMBOL}/financial-metrics", None, None, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/company/{SYMBOL}/financials/pl", None, {"statement_type": "s", "period": "annual"}, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/company/{SYMBOL}/financials/balance-sheet", None, {"statement_type": "s", "period": "annual"}, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/company/{SYMBOL}/financials/cash-flow", None, {"statement_type": "s", "period": "annual"}, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/company/{SYMBOL}/notes", None, {"statement_type": "s", "period": "annual"}, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/company/{SYMBOL}/segments", None, None, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/company/{SYMBOL}/ratios", None, None, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/company/{SYMBOL}/peers", None, None, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/company/{SYMBOL}/quote", None, None, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/company/{SYMBOL}/price-history", None, {"from_date": "2025-01-01", "to_date": "2026-07-11"}, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/company/{SYMBOL}/annual-price-ratios", None, None, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/company/{SYMBOL}/daily-price-ratios", None, {"from_date": "2025-01-01", "to_date": "2026-07-11"}, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/company/{SYMBOL}/shareholding", None, None, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/company/{SYMBOL}/shareholding/beneficial-owners", None, None, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/company/{SYMBOL}/shareholding/declaration", None, None, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/company/{SYMBOL}/shareholding/ownership-current", None, None, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/company/{SYMBOL}/shareholding/ownership-history", None, None, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/company/{SYMBOL}/corporate-actions", None, None, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/company/{SYMBOL}/documents", None, None, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/company/{SYMBOL}/credit-ratings", None, None, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/company/{SYMBOL}/identity-history", None, None, {200, 404, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/indices", None, None, {200, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/index-master", None, None, {200, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/index-returns", None, None, {200, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/movers", None, {"symbol": ["RELIANCE", "TCS"]}, {200, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/sector-performance", None, None, {200, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/ipo", None, None, {200, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/results-calendar", None, None, {200, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/holidays", None, None, {200, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/commodities", None, None, {200, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/commodity-list", None, None, {200, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/announcements", None, {"page": 1, "limit": 5}, {200, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/news", None, None, {200, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/bulk-deals", None, {"page": 1, "limit": 5}, {200, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/block-deals", None, {"page": 1, "limit": 5}, {200, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/sast-trades", None, {"page": 1, "limit": 5}, {200, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/insider-trades", None, {"page": 1, "limit": 5}, {200, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/dividends", None, {"page": 1, "limit": 5}, {200, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/concalls", None, {"page": 1, "limit": 5}, {200, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/annual-reports", None, {"page": 1, "limit": 5}, {200, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/sectors", None, None, {200, 502}, "finscreen"),
    ("GET", f"/api/finscreen/index/{INDEX}/profile", None, None, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/index/{INDEX}/historical", None, None, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/index/{INDEX}/returns", None, None, {200, 404, 502}, "finscreen"),
    ("GET", f"/api/finscreen/index/{INDEX}/valuation", None, None, {200, 404, 502}, "finscreen"),
    ("GET", "/api/finscreen/refreshed-stocks", None, {"days": 1}, {200, 401, 502}, "finscreen"),
    ("GET", "/api/watchlists", None, None, {200}, "watchlist"),
    ("POST", "/api/watchlists", {"name": "Deep Test WL"}, None, {201}, "watchlist"),
    ("POST", f"/api/watchlists/{WL_ID}/items", {"symbol": "RELIANCE", "targetPrice": 2900, "alertEnabled": True}, None, {201, 404}, "watchlist"),
    ("PUT", f"/api/watchlists/items/{ITEM_ID}", {"targetPrice": 3000, "alertEnabled": True}, None, {200, 404}, "watchlist"),
    ("DELETE", f"/api/watchlists/items/{ITEM_ID}", None, None, {200, 404}, "watchlist"),
    ("DELETE", f"/api/watchlists/{WL_ID}", None, None, {200, 404}, "watchlist"),
    ("POST", "/api/screener/run", {"query": "pe < 50", "page": 1, "limit": 5}, None, {200}, "screener"),
    ("GET", "/api/screener/saved", None, None, {200}, "screener"),
    ("POST", "/api/screener/saved", {"name": "Deep Test Screen", "queryText": "roe > 10", "alertEnabled": False, "alertFrequency": "IMMEDIATE"}, None, {201}, "screener"),
    ("DELETE", f"/api/screener/saved/{SCREEN_ID}", None, None, {200, 404}, "screener"),
    ("GET", "/api/screener/notifications", None, None, {200}, "screener"),
    ("PUT", f"/api/screener/notifications/{NOTIF_ID}/read", None, None, {200, 404}, "screener"),
    ("PUT", "/api/screener/notifications/read-all", None, None, {200}, "screener"),
    ("GET", "/api/portfolio", None, None, {200, 401, 403}, "portfolio"),
    ("POST", "/api/portfolio", {"name": "Deep Test Portfolio"}, None, {201, 401, 403}, "portfolio"),
    ("DELETE", f"/api/portfolio/{PORTFOLIO_ID}", None, None, {200, 401, 403, 404}, "portfolio"),
    ("GET", f"/api/portfolio/{PORTFOLIO_ID}/holdings", None, None, {200, 401, 403, 404}, "portfolio"),
    ("POST", f"/api/portfolio/{PORTFOLIO_ID}/holdings", {"symbol": "RELIANCE", "companyName": "Reliance", "quantity": 1, "avgBuyPrice": 2500}, None, {201, 401, 403, 404}, "portfolio"),
    ("PUT", f"/api/portfolio/{PORTFOLIO_ID}/holdings/{HOLDING_ID}", {"quantity": 2}, None, {200, 401, 403, 404}, "portfolio"),
    ("DELETE", f"/api/portfolio/{PORTFOLIO_ID}/holdings/{HOLDING_ID}", None, None, {200, 401, 403, 404}, "portfolio"),
    ("GET", "/api/queries", None, None, {200, 401, 403}, "queries"),
    ("POST", "/api/queries", {"queryText": "dividend yield > 2"}, None, {201, 200, 401, 403}, "queries"),
    ("DELETE", f"/api/queries/{QUERY_ID}", None, None, {200, 401, 403, 404}, "queries"),
    ("POST", "/api/payments/initiate", {"plan": "PRO"}, None, {200, 401, 403}, "payments"),
    ("GET", "/api/payments/status", None, None, {200, 401, 403}, "payments"),
    ("POST", "/api/payments/payu/success", None, None, {302, 400, 422}, "payments"),
    ("POST", "/api/payments/payu/failure", None, None, {302, 400, 422}, "payments"),
    ("GET", "/api/admin/summary", None, None, {200, 401, 403}, "admin"),
    # Frontend wrong-base paths (should 404 on backend)
    ("GET", "/api/finscreen/portfolio", None, None, {404}, "frontend-bug"),
    ("GET", "/api/finscreen/queries", None, None, {404}, "frontend-bug"),
    ("GET", "/api/finscreen/payments/status", None, None, {404}, "frontend-bug"),
    ("GET", "/api/finscreen/admin/summary", None, None, {404}, "frontend-bug"),
]

def _fmt_params(params):
    if not params:
        return None
    out = {}
    for k, v in params.items():
        if isinstance(v, list):
            out[k] = v
        else:
            out[k] = v
    return out

@pytest.mark.asyncio
async def test_all_documented_endpoints_deep_smoke(client: AsyncClient):
    uid = uuid.uuid4().hex[:8]
    results = []
    auth_cookies = {}

    for method, path, body, params, expected, category in ENDPOINTS:
        req_body = None
        if body:
            req_body = {k: (v.format(uid=uid) if isinstance(v, str) and "{uid}" in v else v) for k, v in body.items()}

        kwargs = {"params": _fmt_params(params)}
        if auth_cookies:
            kwargs["cookies"] = auth_cookies

        if method == "GET":
            resp = await client.get(path, **kwargs)
        elif method == "POST":
            if req_body is not None:
                resp = await client.post(path, json=req_body, **kwargs)
            else:
                resp = await client.post(path, **kwargs)
        elif method == "PUT":
            resp = await client.put(path, json=req_body or {}, **kwargs)
        elif method == "DELETE":
            resp = await client.delete(path, **kwargs)
        else:
            raise ValueError(method)

        if path == "/api/auth/login" and resp.status_code == 200:
            for c in resp.cookies.jar:
                auth_cookies[c.name] = c.value

        ok = resp.status_code in expected
        results.append({
            "method": method,
            "path": path,
            "status": resp.status_code,
            "expected": sorted(expected),
            "ok": ok,
            "category": category,
            "snippet": (resp.text or "")[:120],
        })

    passed = [r for r in results if r["ok"]]
    failed = [r for r in results if not r["ok"]]

    print("\n" + "=" * 72)
    print(f"DEEP API SMOKE TEST: {len(passed)}/{len(results)} passed")
    print("=" * 72)

    by_cat = {}
    for r in results:
        by_cat.setdefault(r["category"], {"pass": 0, "fail": 0})
        by_cat[r["category"]]["pass" if r["ok"] else "fail"] += 1

    for cat, counts in sorted(by_cat.items()):
        print(f"  {cat:14} pass={counts['pass']:2} fail={counts['fail']:2}")

    if failed:
        print("\nFAILURES:")
        for r in failed:
            print(f"  [{r['status']}] {r['method']} {r['path']}")
            print(f"         expected {r['expected']} | {r['snippet']}")

    finscreen_200 = [r for r in results if r["category"] == "finscreen" and r["status"] == 200]
    finscreen_upstream = [r for r in results if r["category"] == "finscreen" and r["status"] in (502, 503, 504)]
    print(f"\nFinscreen live data: {len(finscreen_200)} returned 200, {len(finscreen_upstream)} upstream errors")

    assert not failed, f"{len(failed)} endpoint(s) returned unexpected status — see output above"
