"""Live deep API test against running backend. Run: python scripts/deep_api_test.py"""
import json
import uuid
import httpx

BASE = "http://127.0.0.1:8000"
SYMBOL = "ITC"
INDEX = "nifty-50"
TIMEOUT = 90.0

ENDPOINTS = [
    ("GET", "/health", None, None, {200}, "infra"),
    ("POST", "/api/auth/signup", {"email": "live_{uid}@example.com", "password": "TestPass123!", "name": "Live Test"}, None, {201}, "auth"),
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
    ("GET", f"/api/finscreen/company/{SYMBOL}/identity-history", None, None, {200, 404, 500, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/indices", None, None, {200, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/index-master", None, None, {200, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/index-returns", None, None, {200, 502}, "finscreen"),
    ("GET", "/api/finscreen/market/movers", None, [("symbol", "RELIANCE"), ("symbol", "TCS")], {200, 502}, "finscreen"),
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
    ("POST", "/api/watchlists", {"name": "Live Test WL"}, None, {201}, "watchlist"),
    ("POST", "/api/watchlists/fake-id/items", {"symbol": "RELIANCE", "targetPrice": 2900, "alertEnabled": True}, None, {201, 404}, "watchlist"),
    ("PUT", "/api/watchlists/items/fake-item", {"targetPrice": 3000, "alertEnabled": True}, None, {200, 404}, "watchlist"),
    ("DELETE", "/api/watchlists/items/fake-item", None, None, {200, 404}, "watchlist"),
    ("DELETE", "/api/watchlists/fake-id", None, None, {200, 404}, "watchlist"),
    ("POST", "/api/screener/run", {"query": "pe < 50", "page": 1, "limit": 5}, None, {200}, "screener"),
    ("GET", "/api/screener/saved", None, None, {200}, "screener"),
    ("POST", "/api/screener/saved", {"name": "Live Screen", "queryText": "roe > 10", "alertEnabled": False, "alertFrequency": "IMMEDIATE"}, None, {201}, "screener"),
    ("DELETE", "/api/screener/saved/fake-screen", None, None, {200, 404}, "screener"),
    ("GET", "/api/screener/notifications", None, None, {200}, "screener"),
    ("PUT", "/api/screener/notifications/fake-notif/read", None, None, {200, 404}, "screener"),
    ("PUT", "/api/screener/notifications/read-all", None, None, {200}, "screener"),
    ("GET", "/api/portfolio", None, None, {200, 401, 403}, "portfolio"),
    ("POST", "/api/portfolio", {"name": "Live Portfolio"}, None, {201, 401, 403}, "portfolio"),
    ("DELETE", "/api/portfolio/fake-portfolio", None, None, {200, 401, 403, 404}, "portfolio"),
    ("GET", "/api/portfolio/fake-portfolio/holdings", None, None, {200, 401, 403, 404}, "portfolio"),
    ("POST", "/api/portfolio/fake-portfolio/holdings", {"symbol": "RELIANCE", "companyName": "Reliance", "quantity": 1, "avgBuyPrice": 2500}, None, {201, 401, 403, 404}, "portfolio"),
    ("PUT", "/api/portfolio/fake-portfolio/holdings/fake-holding", {"quantity": 2}, None, {200, 401, 403, 404}, "portfolio"),
    ("DELETE", "/api/portfolio/fake-portfolio/holdings/fake-holding", None, None, {200, 401, 403, 404}, "portfolio"),
    ("GET", "/api/queries", None, None, {200, 401, 403}, "queries"),
    ("POST", "/api/queries", {"queryText": "dividend yield > 2"}, None, {201, 200, 401, 403}, "queries"),
    ("DELETE", "/api/queries/fake-query", None, None, {200, 401, 403, 404}, "queries"),
    ("POST", "/api/payments/initiate", {"plan": "PRO"}, None, {200, 401, 403}, "payments"),
    ("GET", "/api/payments/status", None, None, {200, 401, 403}, "payments"),
    ("POST", "/api/payments/payu/success", None, None, {302, 400, 422}, "payments"),
    ("POST", "/api/payments/payu/failure", None, None, {302, 400, 422}, "payments"),
    ("GET", "/api/admin/summary", None, None, {200, 401, 403}, "admin"),
    ("GET", "/api/finscreen/portfolio", None, None, {404}, "frontend-bug"),
    ("GET", "/api/finscreen/queries", None, None, {404}, "frontend-bug"),
    ("GET", "/api/finscreen/payments/status", None, None, {404}, "frontend-bug"),
    ("GET", "/api/finscreen/admin/summary", None, None, {404}, "frontend-bug"),
]


def main():
    uid = uuid.uuid4().hex[:8]
    results = []
    cookies = {}

    with httpx.Client(base_url=BASE, timeout=TIMEOUT, follow_redirects=False) as client:
        for method, path, body, params, expected, category in ENDPOINTS:
            req_body = None
            if body:
                req_body = {k: (v.format(uid=uid) if isinstance(v, str) and "{uid}" in v else v) for k, v in body.items()}

            try:
                kwargs = {}
                if cookies:
                    kwargs["cookies"] = cookies
                if isinstance(params, list):
                    kwargs["params"] = params
                elif params:
                    kwargs["params"] = params

                if method == "GET":
                    resp = client.get(path, **kwargs)
                elif method == "POST":
                    resp = client.post(path, json=req_body, **kwargs) if req_body is not None else client.post(path, **kwargs)
                elif method == "PUT":
                    resp = client.put(path, json=req_body or {}, **kwargs)
                elif method == "DELETE":
                    resp = client.delete(path, **kwargs)
                else:
                    raise ValueError(method)

                if path == "/api/auth/login" and resp.status_code == 200:
                    cookies.update(dict(resp.cookies))

                status = resp.status_code
                snippet = (resp.text or "")[:150]
            except Exception as e:
                status = "ERR"
                snippet = str(e)[:150]

            ok = status in expected if status != "ERR" else False
            results.append({
                "method": method, "path": path, "status": status,
                "expected": sorted(expected), "ok": ok, "category": category, "snippet": snippet,
            })

    passed = [r for r in results if r["ok"]]
    failed = [r for r in results if not r["ok"]]
    finscreen_200 = [r for r in results if r["category"] == "finscreen" and r["status"] == 200]
    finscreen_err = [r for r in results if r["category"] == "finscreen" and r["status"] not in (200, "ERR") and not r["ok"]]

    print("=" * 72)
    print(f"LIVE DEEP API TEST: {len(passed)}/{len(results)} route checks passed")
    print("=" * 72)

    by_cat = {}
    for r in results:
        by_cat.setdefault(r["category"], {"pass": 0, "fail": 0})
        by_cat[r["category"]]["pass" if r["ok"] else "fail"] += 1
    for cat, c in sorted(by_cat.items()):
        print(f"  {cat:14} pass={c['pass']:2} fail={c['fail']:2}")

    print(f"\nFinscreen live 200 OK: {len(finscreen_200)} endpoints returned real data")

    if failed:
        print(f"\nUNEXPECTED ({len(failed)}):")
        for r in failed:
            print(f"  [{r['status']}] {r['method']} {r['path']}")
            print(f"         expected {r['expected']}")
            print(f"         {r['snippet'][:120]}")

    # Save JSON report
    report_path = "scripts/deep_api_test_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump({"summary": {"passed": len(passed), "total": len(results), "finscreen_200": len(finscreen_200)}, "results": results}, f, indent=2)
    print(f"\nReport saved: {report_path}")


if __name__ == "__main__":
    main()
