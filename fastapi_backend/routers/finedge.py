"""
routers/finedge.py
Mirrors ALL Express finedge routes + controller logic exactly.
Includes the data transformation (mapFinancials, mergeRatios, etc.)
"""

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from typing import Any, Dict, Optional
import logging
import time

from services.finedge_service import execute_proxy_request

router = APIRouter(prefix="/api/finscreen", tags=["finedge"])
logger = logging.getLogger("finedge_router")


# ── Error helper ──────────────────────────────────────────────────────────────

def _api_error(err: Exception, endpoint: str, request_id: str):
    status = getattr(getattr(err, "response", None), "status_code", 502)
    messages = {
        401: "FinEdge API authentication failed. Check your API key.",
        403: "Access forbidden. Your plan may not include this endpoint.",
        404: "No data found for this symbol on FinEdge.",
        429: "Rate limit reached. Please try again shortly.",
    }
    message = messages.get(status, "Live data temporarily unavailable. Please try again.")
    logger.error(f"[FinEdge] {endpoint} → {status}: {err}")
    raise HTTPException(status_code=status, detail={"error": True, "message": message, "endpoint": endpoint})


def _req_id(request: Request) -> str:
    return request.headers.get("x-request-id", f"req_{int(time.time() * 1000)}")


# ── Financial statement mapping (mirrors mapFinancials in Express) ─────────────

PL_MAP = [
    {"label": "Revenue from Operations", "key": "revenueFromOperations"},
    {"label": "Total Expenses", "key": "expenses", "children": [
        {"label": "Material Cost", "key": "costOfMaterialsConsumed"},
        {"label": "Employee Cost", "key": "employeeBenefitExpense"},
        {"label": "Other Expenses", "key": "otherExpenses"},
    ]},
    {"label": "EBITDA", "calc": lambda f: (f.get("revenueFromOperations") or 0) - (f.get("expenses") or 0)},
    {"label": "EBITDA Margin %", "isPercent": True, "calc": lambda f: (
        ((f.get("revenueFromOperations", 0) - f.get("expenses", 0)) / f["revenueFromOperations"] * 100)
        if f.get("revenueFromOperations") else 0
    )},
    {"label": "Depreciation & Amortisation", "key": "depreciationAndAmortisation"},
    {"label": "EBIT", "calc": lambda f: (f.get("revenueFromOperations", 0) - f.get("expenses", 0)) - f.get("depreciationAndAmortisation", 0)},
    {"label": "Finance Cost (Interest)", "key": "financeCosts"},
    {"label": "Other Income", "key": "otherIncome"},
    {"label": "Profit Before Tax (PBT)", "key": "profitBeforeTax"},
    {"label": "Tax", "key": "taxExpense"},
    {"label": "Net Profit", "key": "profitLossForPeriod"},
    {"label": "EPS (₹)", "key": "eps", "noDiv": True},
]

BS_MAP = [
    {"label": "Equity Capital", "key": "equityCapital"},
    {"label": "Reserves & Surplus", "key": "reserves"},
    {"label": "Total Equity (Net Worth)", "key": "totalEquity"},
    {"label": "Total Borrowings", "calc": lambda f: (f.get("borrowingsCurrent") or 0) + (f.get("borrowingsNoncurrent") or 0), "children": [
        {"label": "Long Term Borrowings", "key": "borrowingsNoncurrent"},
        {"label": "Short Term Borrowings", "key": "borrowingsCurrent"},
    ]},
    {"label": "Total Liabilities", "key": "equityAndLiabilities"},
    {"label": "Fixed Assets (Net Block)", "calc": lambda f: (f.get("propertyPlantAndEquipment") or 0) + (f.get("otherIntangibleAssets") or 0)},
    {"label": "Capital Work in Progress", "key": "capitalWorkInProgress"},
    {"label": "Investments", "calc": lambda f: (f.get("noncurrentInvestments") or 0) + (f.get("currentInvestments") or 0)},
    {"label": "Total Assets", "key": "assets"},
]

CF_MAP = [
    {"label": "Cash from Operations", "key": "cashFlowsFromOperatingActivities"},
    {"label": "Cash from Investing", "key": "cashFlowsFromInvestingActivities", "children": [
        {"label": "Capital Expenditure", "key": "purchaseOfFixed&IntangibleAssets"},
    ]},
    {"label": "Cash from Financing", "key": "cashFlowsFromFinancingActivities"},
    {"label": "Net Cash Flow", "key": "netCashFlow"},
]


def _parse_period_label(f: dict, period: str) -> str:
    if f.get("period_end"):
        s = str(f["period_end"])
        if len(s) == 8:
            year, month_num = s[:4], int(s[4:6])
            months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
            m = months[month_num - 1]
            return f"{m}'{year[2:]}" if period == "quarterly" else f"{m} {year}"
    y = f.get("year", 2024)
    return f"Q1'{str(y)[2:]}" if period == "quarterly" else f"Mar {y}"


def _map_financials(financials: list, map_spec: list, period: str) -> dict:
    sorted_desc = sorted(financials, key=lambda f: int(str(f.get("period_end", f.get("year", 0)))), reverse=True)
    limit = 12 if period == "quarterly" else 13
    sliced = sorted_desc[:limit]
    sliced = sorted(sliced, key=lambda f: int(str(f.get("period_end", f.get("year", 0)))))

    columns = [_parse_period_label(f, period) for f in sliced]

    def map_rows(spec_list):
        rows = []
        for spec in spec_list:
            values = []
            for f in sliced:
                val = None
                if "key" in spec:
                    val = f.get(spec["key"])
                elif "calc" in spec:
                    try:
                        val = spec["calc"](f)
                    except Exception:
                        val = None
                if val is not None:
                    if spec.get("noDiv") or spec.get("isPercent"):
                        values.append(val)
                    else:
                        values.append(val / 1e7)
                else:
                    values.append(None)

            row = {"label": spec["label"], "values": values}
            if spec.get("isPercent"):
                row["isPercent"] = True
            if spec.get("children"):
                row["children"] = map_rows(spec["children"])
            rows.append(row)
        return rows

    return {"columns": columns, "rows": map_rows(map_spec)}


# ── Company Discovery ─────────────────────────────────────────────────────────

@router.get("/stock-symbols")
async def get_stock_symbols(request: Request):
    rid = _req_id(request)
    try:
        return await execute_proxy_request("GET", "stock-symbols", dict(request.query_params), None, rid)
    except Exception as e:
        _api_error(e, "stock-symbols", rid)

@router.get("/stock-search")
async def get_stock_search(request: Request):
    rid = _req_id(request)
    try:
        return await execute_proxy_request("GET", "stock-search", dict(request.query_params), None, rid)
    except Exception as e:
        _api_error(e, "stock-search", rid)

@router.get("/name-changes")
async def get_name_changes(request: Request):
    rid = _req_id(request)
    try:
        return await execute_proxy_request("GET", "name-changes", dict(request.query_params), None, rid)
    except Exception as e:
        _api_error(e, "name-changes", rid)

@router.get("/symbol-changes")
async def get_symbol_changes(request: Request):
    rid = _req_id(request)
    try:
        return await execute_proxy_request("GET", "symbol-changes", dict(request.query_params), None, rid)
    except Exception as e:
        _api_error(e, "symbol-changes", rid)


# ── Company Profile (7 parallel FinEdge calls merged) ────────────────────────

@router.get("/company/{symbol}/profile")
async def get_company_profile(symbol: str, request: Request):
    import asyncio
    sym = symbol.upper()
    rid = _req_id(request)
    try:
        # 1. Fetch profile
        profile = await execute_proxy_request("GET", f"company-profile/{sym}", dict(request.query_params), None, rid)

        # 2. Parallel: quote, ratios (3 types), shareholding, metrics
        results = await asyncio.gather(
            execute_proxy_request("GET", "quote", {"symbol": sym}, None, rid),
            execute_proxy_request("GET", f"ratios/{sym}", {"statement_type": "s", "ratio_type": "pr"}, None, rid),
            execute_proxy_request("GET", f"ratios/{sym}", {"statement_type": "s", "ratio_type": "le"}, None, rid),
            execute_proxy_request("GET", f"ratios/{sym}", {"statement_type": "s", "ratio_type": "li"}, None, rid),
            execute_proxy_request("GET", f"shareholdings/pattern/{sym}", {"period": "quarterly"}, None, rid),
            execute_proxy_request("GET", f"financial-metrics/{sym}", {"statement_type": "s", "ratio_type": "cu"}, None, rid),
            return_exceptions=True
        )
        quote_data, pr_data, le_data, li_data, sh_data, metrics_data = results

        # 3. Parse quote
        quote = None
        if not isinstance(quote_data, Exception) and quote_data:
            quote = quote_data.get(sym) or quote_data

        # 4. Parse ratios
        def latest_ratio(data):
            if isinstance(data, Exception): return None
            if data and isinstance(data.get("ratios"), list):
                return sorted(data["ratios"], key=lambda r: r.get("year", r.get("period_end", 0)), reverse=True)[0]
            return None

        latest_pr = latest_ratio(pr_data)
        latest_le = latest_ratio(le_data)
        latest_li = latest_ratio(li_data)

        # 5. Parse shareholding
        promoter = fii = dii = public_h = 0.0
        if not isinstance(sh_data, Exception) and sh_data:
            cols = sh_data.get("columns", [])
            rows = sh_data.get("rows", [])
            if cols and rows:
                latest_col = cols[-1]
                for row in rows:
                    val = float(row.get("data", {}).get(latest_col, 0) or 0)
                    cat = row.get("catagory", "")
                    if cat in ("Indian", "Promoter"): promoter = val
                    elif cat == "InstitutionsForeign": fii = val
                    elif cat == "InstitutionsDomestic": dii = val
                    elif cat in ("NonInstitutions", "Goverments"): public_h += val

        # 6. Parse metrics
        div_yield = eps_val = 0.0
        if not isinstance(metrics_data, Exception) and metrics_data:
            m = metrics_data.get("metrics") or {}
            div_yield = m.get("dividendYield") or m.get("dividend_yield") or 0
            eps_val = m.get("eps") or m.get("basicEps") or 0

        # 7. Extract price data
        def qv(key, *alts):
            if not quote: return 0
            for k in (key, *alts):
                v = quote.get(k)
                if v is not None: return float(v)
            return 0

        current_price = qv("current_price", "close_price", "ltp")
        change_pct_raw = quote.get("pct_change") or quote.get("change_pct") or quote.get("change") or 0 if quote else 0
        change_pct = float(str(change_pct_raw).replace("%", "")) if change_pct_raw else 0

        # 8. Extract ratio values
        def rv(data, *keys):
            if not data: return 0
            for k in keys:
                v = data.get(k)
                if v is not None:
                    val = float(v)
                    if 0 < val <= 1: val = val * 100
                    return round(val, 2)
            return 0

        roe = rv(latest_pr, "returnOnEquity", "roe")
        roce = rv(latest_pr, "returnOnCapital", "returnOnCapitalEmployed", "roce")
        npm = rv(latest_pr, "netMargin", "netProfitMargin", "net_profit_margin")
        bvps = round(float(latest_le.get("bookValuePerShare") or latest_le.get("book_value_per_share") or 0), 2) if latest_le else 0
        de = round(float(latest_le.get("totalDebtToEquity") or latest_le.get("debtToEquity") or 0), 2) if latest_le else 0

        pe = 0
        if latest_pr:
            pe = float(latest_pr.get("pe") or latest_pr.get("priceToEarnings") or 0)
        if pe == 0 and current_price and eps_val:
            pe = round(current_price / eps_val, 2)

        return {
            "symbol": sym,
            "name": profile.get("name") or profile.get("company_name") or sym,
            "exchange": "NSE" if profile.get("nse_code") else "BSE",
            "sector": profile.get("sector", "Other"),
            "industry": profile.get("industry", "Other"),
            "website": profile.get("website", ""),
            "description": profile.get("description", ""),
            "isin": profile.get("isin", ""),
            "faceValue": profile.get("face_value", 10),
            "price": current_price,
            "change": round(current_price * (change_pct / 100), 2),
            "changePct": change_pct,
            "open": qv("open_price", "open"),
            "high": qv("high_price", "high"),
            "low": qv("low_price", "low"),
            "close": current_price,
            "volume": qv("volume", "traded_volume"),
            "high52w": qv("high52", "week52_high", "yearly_high"),
            "low52w": qv("low52", "week52_low", "yearly_low"),
            "marketCap": qv("market_cap"),
            "pe": pe, "eps": eps_val, "bookValue": bvps,
            "dividendYield": div_yield, "roe": roe, "roce": roce,
            "netProfitMargin": npm, "debtToEquity": de,
            "promoterHolding": promoter, "fiiHolding": fii,
            "diiHolding": dii, "publicHolding": public_h,
        }
    except HTTPException:
        raise
    except Exception as e:
        _api_error(e, f"company-profile/{symbol}", rid)


# ── Financials ────────────────────────────────────────────────────────────────

@router.get("/company/{symbol}/basic-financials")
async def get_basic_financials(symbol: str, request: Request):
    rid = _req_id(request)
    q = {"statement_type": "s", "period": "annual", "statement_code": "pl", **dict(request.query_params)}
    try:
        return await execute_proxy_request("GET", f"basic-financials/{symbol}", q, None, rid)
    except Exception as e:
        _api_error(e, f"basic-financials/{symbol}", rid)

@router.get("/company/{symbol}/financial-metrics")
async def get_financial_metrics(symbol: str, request: Request):
    rid = _req_id(request)
    q = {"statement_type": "s", "period": "annual", "ratio_type": "valuation", **dict(request.query_params)}
    try:
        return await execute_proxy_request("GET", f"financial-metrics/{symbol}", q, None, rid)
    except Exception:
        return {"success": True, "symbol": symbol.upper(), "metrics": None}

@router.get("/company/{symbol}/financials/pl")
async def get_company_pl(symbol: str, request: Request):
    rid = _req_id(request)
    q = {"statement_type": "s", "period": "annual", **dict(request.query_params), "statement_code": "pl"}
    try:
        data = await execute_proxy_request("GET", f"financials/{symbol}", q, None, rid)
        if data and isinstance(data.get("financials"), list):
            return _map_financials(data["financials"], PL_MAP, q.get("period", "annual"))
        return {"columns": [], "rows": []}
    except Exception as e:
        _api_error(e, f"financials/{symbol}/pl", rid)

@router.get("/company/{symbol}/financials/balance-sheet")
async def get_balance_sheet(symbol: str, request: Request):
    rid = _req_id(request)
    q = {"statement_type": "s", "period": "annual", **dict(request.query_params), "statement_code": "bs"}
    try:
        data = await execute_proxy_request("GET", f"financials/{symbol}", q, None, rid)
        if data and isinstance(data.get("financials"), list):
            return _map_financials(data["financials"], BS_MAP, q.get("period", "annual"))
        return {"columns": [], "rows": []}
    except Exception as e:
        _api_error(e, f"financials/{symbol}/bs", rid)

@router.get("/company/{symbol}/financials/cash-flow")
async def get_cash_flow(symbol: str, request: Request):
    rid = _req_id(request)
    q = {"statement_type": "s", "period": "annual", **dict(request.query_params), "statement_code": "cf"}
    try:
        data = await execute_proxy_request("GET", f"financials/{symbol}", q, None, rid)
        if data and isinstance(data.get("financials"), list):
            return _map_financials(data["financials"], CF_MAP, q.get("period", "annual"))
        return {"columns": [], "rows": []}
    except Exception as e:
        _api_error(e, f"financials/{symbol}/cf", rid)

@router.get("/company/{symbol}/notes")
async def get_notes(symbol: str, request: Request):
    rid = _req_id(request)
    try:
        return await execute_proxy_request("GET", f"notes/{symbol}", dict(request.query_params), None, rid)
    except Exception as e:
        _api_error(e, f"notes/{symbol}", rid)

@router.get("/company/{symbol}/segments")
async def get_segments(symbol: str, request: Request):
    rid = _req_id(request)
    q = {"statement_type": "s", "period": "annual", "statement_code": "pl", **dict(request.query_params)}
    try:
        return await execute_proxy_request("GET", f"segment-revenue/{symbol}", q, None, rid)
    except Exception as e:
        _api_error(e, f"segment-revenue/{symbol}", rid)

@router.get("/company/{symbol}/ratios")
async def get_ratios(symbol: str, request: Request):
    import asyncio
    sym = symbol.upper()
    rid = _req_id(request)
    st = request.query_params.get("statement_type", "s")
    try:
        results = await asyncio.gather(
            execute_proxy_request("GET", f"ratios/{sym}", {"statement_type": st, "ratio_type": "pr"}, None, rid),
            execute_proxy_request("GET", f"ratios/{sym}", {"statement_type": st, "ratio_type": "le"}, None, rid),
            execute_proxy_request("GET", f"ratios/{sym}", {"statement_type": st, "ratio_type": "li"}, None, rid),
            execute_proxy_request("GET", f"ratios/{sym}", {"statement_type": st, "ratio_type": "ef"}, None, rid),
            return_exceptions=True
        )

        merged = {}
        for res in results:
            if isinstance(res, Exception): continue
            for r in (res.get("ratios") or []):
                key = r.get("header") or str(r.get("year") or r.get("period_end") or "")
                if not key: continue
                merged[key] = {**merged.get(key, {"header": key}), **r}

        merged_list = sorted(merged.values(), key=lambda x: x.get("year", 0))[-10:]
        columns = [r.get("header") or f"Mar {r.get('year', '')}" for r in merged_list]

        def row(label, key, pct=False):
            vals = []
            for r in merged_list:
                v = r.get(key)
                if v is None:
                    vals.append(None)
                else:
                    v = float(v)
                    if pct: v *= 100
                    vals.append(round(v, 2))
            return {"label": label, "isPercent": pct, "values": vals}

        return {"symbol": sym, "sections": [
            {"section": "Profitability", "columns": columns, "rows": [
                row("ROE (%)", "returnOnEquity", True),
                row("ROCE (%)", "returnOnCapital", True),
                row("Net Profit Margin (%)", "netMargin", True),
                row("Gross Profit Margin (%)", "grossMargin", True),
                row("EBITDA Margin (%)", "ebitdaMargin", True),
            ]},
            {"section": "Leverage", "columns": columns, "rows": [
                row("Debt to Equity", "totalDebtToEquity"),
                row("Interest Coverage", "interestCoverage"),
                row("Book Value Per Share (₹)", "bookValuePerShare"),
            ]},
            {"section": "Liquidity", "columns": columns, "rows": [
                row("Current Ratio", "currentRatio"),
                row("Quick Ratio", "quickRatio"),
            ]},
            {"section": "Efficiency", "columns": columns, "rows": [
                row("Asset Turnover", "assetTurnover"),
                row("Inventory Turnover", "inventoryTurnover"),
            ]},
        ]}
    except HTTPException:
        raise
    except Exception as e:
        _api_error(e, f"ratios/{symbol}", rid)

@router.get("/company/{symbol}/peers")
async def get_peers(symbol: str, request: Request):
    rid = _req_id(request)
    q = {"group": "sector", **dict(request.query_params)}
    try:
        return await execute_proxy_request("GET", f"peers/{symbol}", q, None, rid)
    except Exception as e:
        _api_error(e, f"peers/{symbol}", rid)

@router.get("/company/{symbol}/quote")
async def get_quote(symbol: str, request: Request):
    rid = _req_id(request)
    try:
        return await execute_proxy_request("GET", "quote", {"symbol": symbol, **dict(request.query_params)}, None, rid)
    except Exception as e:
        _api_error(e, f"quote/{symbol}", rid)

@router.get("/company/{symbol}/price-history")
async def get_price_history(symbol: str, request: Request):
    rid = _req_id(request)
    try:
        return await execute_proxy_request("GET", f"daily-quotes/{symbol}", dict(request.query_params), None, rid)
    except Exception as e:
        _api_error(e, f"daily-quotes/{symbol}", rid)

@router.get("/company/{symbol}/annual-price-ratios")
async def get_annual_price_ratios(symbol: str, request: Request):
    rid = _req_id(request)
    q = {"statement_type": "s", "period": "annual", **dict(request.query_params)}
    try:
        return await execute_proxy_request("GET", f"annual-price-ratios/{symbol}", q, None, rid)
    except Exception as e:
        _api_error(e, f"annual-price-ratios/{symbol}", rid)

@router.get("/company/{symbol}/daily-price-ratios")
async def get_daily_price_ratios(symbol: str, request: Request):
    rid = _req_id(request)
    q = {"statement_type": "s", **dict(request.query_params)}
    try:
        return await execute_proxy_request("GET", f"daily-price-ratios/{symbol}", q, None, rid)
    except Exception as e:
        _api_error(e, f"daily-price-ratios/{symbol}", rid)

@router.get("/company/{symbol}/shareholding")
async def get_shareholding(symbol: str, request: Request):
    rid = _req_id(request)
    q = {"period": "annual", **dict(request.query_params)}
    try:
        data = await execute_proxy_request("GET", f"shareholdings/pattern/{symbol}", q, None, rid)
        if not data or not data.get("columns"): return []
        formatted = []
        for col in data["columns"]:
            parts = col.split()
            quarter = f"{parts[0][:3]}'{parts[1][2:]}" if len(parts) == 2 else col
            entry = {"quarter": quarter, "promoter": 0, "fii": 0, "dii": 0, "public": 0, "others": 0}
            for row in data.get("rows", []):
                val = float(row.get("data", {}).get(col, 0) or 0)
                cat = row.get("catagory", "")
                if cat == "Indian": entry["promoter"] = val
                elif cat == "InstitutionsForeign": entry["fii"] = val
                elif cat == "InstitutionsDomestic": entry["dii"] = val
                elif cat in ("NonInstitutions", "Goverments"): entry["public"] += val
                elif cat == "SharesHeldByNonPromoterNonPublicShareholders": entry["others"] = val
            formatted.append(entry)
        return formatted
    except Exception as e:
        _api_error(e, f"shareholdings/pattern/{symbol}", rid)

@router.get("/company/{symbol}/shareholding/beneficial-owners")
async def get_beneficial_owners(symbol: str, request: Request):
    rid = _req_id(request)
    try:
        return await execute_proxy_request("GET", f"shareholdings/beneficial-owners/{symbol}", dict(request.query_params), None, rid)
    except Exception as e:
        _api_error(e, f"shareholdings/beneficial-owners/{symbol}", rid)

@router.get("/company/{symbol}/shareholding/declaration")
async def get_shareholding_declaration(symbol: str, request: Request):
    rid = _req_id(request)
    try:
        return await execute_proxy_request("GET", f"shareholdings/declaration/{symbol}", dict(request.query_params), None, rid)
    except Exception as e:
        _api_error(e, f"shareholdings/declaration/{symbol}", rid)

@router.get("/company/{symbol}/shareholding/ownership-current")
async def get_ownership_current(symbol: str, request: Request):
    rid = _req_id(request)
    try:
        return await execute_proxy_request("GET", f"shareholdings/ownership-current/{symbol}", dict(request.query_params), None, rid)
    except Exception as e:
        _api_error(e, f"shareholdings/ownership-current/{symbol}", rid)

@router.get("/company/{symbol}/shareholding/ownership-history")
async def get_ownership_history(symbol: str, request: Request):
    rid = _req_id(request)
    try:
        return await execute_proxy_request("GET", f"shareholdings/ownership-history/{symbol}", dict(request.query_params), None, rid)
    except Exception as e:
        _api_error(e, f"shareholdings/ownership-history/{symbol}", rid)

@router.get("/company/{symbol}/corporate-actions")
async def get_corporate_actions(symbol: str, request: Request):
    from datetime import datetime, timedelta
    rid = _req_id(request)
    sym = symbol.upper()
    today = datetime.now().strftime("%Y-%m-%d")
    five_years_ago = (datetime.now() - timedelta(days=5*365)).strftime("%Y-%m-%d")
    q = {"from_date": five_years_ago, "to_date": today, **dict(request.query_params), "symbol": sym}
    try:
        data = await execute_proxy_request("GET", "corporate-actions/all", q, None, rid)
        if not isinstance(data, list):
            return {"corporateActions": [], "upcomingEvents": [], "dividendHistory": []}

        actions = []
        div_map = {}
        months = {"Jan":"01","Feb":"02","Mar":"03","Apr":"04","May":"05","Jun":"06",
                  "Jul":"07","Aug":"08","Sep":"09","Oct":"10","Nov":"11","Dec":"12"}

        for i, item in enumerate(data):
            t = item.get("action", "")
            type_map = {"dividend": "Dividend", "bonus": "Bonus", "split": "Split", "rights": "Rights"}
            action_type = type_map.get(t, "Other")

            ex_date = ""
            if item.get("ex_date"):
                parts = item["ex_date"].split("-")
                if len(parts) == 3:
                    ex_date = f"{parts[2]}-{months.get(parts[1], '01')}-{parts[0].zfill(2)}"

            actions.append({
                "id": f"action-{item.get('timestamp_unix', i)}",
                "type": action_type,
                "announcementDate": ex_date, "recordDate": ex_date, "exDate": ex_date,
                "details": item.get("subject", f"{action_type} action")
            })

            if t == "dividend" and item.get("amount") and ex_date:
                year = ex_date[:4]
                div_map[year] = div_map.get(year, 0) + item["amount"]

        actions.sort(key=lambda x: x["exDate"], reverse=True)
        dividend_history = [{"year": y, "amount": a} for y, a in sorted(div_map.items())]

        return {
            "corporateActions": actions,
            "upcomingEvents": [],
            "dividendHistory": dividend_history
        }
    except Exception:
        return {"corporateActions": [], "upcomingEvents": [], "dividendHistory": []}

@router.get("/company/{symbol}/documents")
async def get_documents(symbol: str, request: Request):
    from datetime import datetime, timedelta
    rid = _req_id(request)
    today = datetime.now().strftime("%Y-%m-%d")
    two_years_ago = (datetime.now() - timedelta(days=2*365)).strftime("%Y-%m-%d")
    q = {"from_date": two_years_ago, "to_date": today, **dict(request.query_params), "symbol": symbol.upper()}
    try:
        data = await execute_proxy_request("GET", "corp-announcements", q, None, rid)
        if not isinstance(data, list):
            return {"documents": []}

        documents = []
        for i, item in enumerate(data):
            title = (item.get("description") or item.get("category") or "Regulatory Filing")[:120]
            date = (item.get("announcement_date") or "").split(" ")[0]
            text = f"{item.get('category','')} {item.get('description','')}".lower()

            if "annual report" in text: cat = "annual-report"
            elif any(x in text for x in ["concall", "conference call", "earnings call"]): cat = "concall"
            elif any(x in text for x in ["credit rating", "crisil", "icra"]): cat = "credit-rating"
            else: cat = "announcement"

            doc = {"id": f"doc-{item.get('timestamp_unix', i)}", "title": title, "date": date, "category": cat}
            doc["duration" if cat == "concall" else "size"] = "45:00" if cat == "concall" else "1.5 MB"
            documents.append(doc)

        return {"documents": documents}
    except Exception:
        return {"documents": []}


# ── Market endpoints ──────────────────────────────────────────────────────────

@router.get("/market/indices")
async def get_market_indices(request: Request):
    rid = _req_id(request)
    try:
        return await execute_proxy_request("GET", "index/market-price/daily-feed", {}, None, rid)
    except Exception as e:
        _api_error(e, "index/market-price/daily-feed", rid)

@router.get("/market/index-master")
async def get_index_master(request: Request):
    rid = _req_id(request)
    try:
        return await execute_proxy_request("GET", "index/master", {}, None, rid)
    except Exception as e:
        _api_error(e, "index/master", rid)

@router.get("/market/index-returns")
async def get_index_returns(request: Request):
    rid = _req_id(request)
    try:
        return await execute_proxy_request("GET", "index/price-returns", {}, None, rid)
    except Exception as e:
        _api_error(e, "index/price-returns", rid)

@router.get("/market/movers")
async def get_market_movers(request: Request):
    rid = _req_id(request)
    try:
        return await execute_proxy_request("GET", "quote", dict(request.query_params), None, rid)
    except Exception as e:
        _api_error(e, "quote", rid)

@router.get("/market/ipo")
async def get_ipo_calendar(request: Request):
    from datetime import datetime, timedelta
    rid = _req_id(request)
    now = datetime.now()
    q = {
        "from_date": (now - timedelta(days=90)).strftime("%Y-%m-%d"),
        "to_date": (now + timedelta(days=90)).strftime("%Y-%m-%d"),
        **dict(request.query_params)
    }
    try:
        return await execute_proxy_request("GET", "ipo-calendar", q, None, rid)
    except Exception as e:
        _api_error(e, "ipo-calendar", rid)

@router.get("/market/results-calendar")
async def get_results_calendar(request: Request):
    from datetime import datetime, timedelta
    rid = _req_id(request)
    now = datetime.now()
    q = {
        "from_date": (now - timedelta(days=7)).strftime("%Y-%m-%d"),
        "to_date": (now + timedelta(days=30)).strftime("%Y-%m-%d"),
        **dict(request.query_params)
    }
    try:
        return await execute_proxy_request("GET", "results-calendar", q, None, rid)
    except Exception as e:
        _api_error(e, "results-calendar", rid)

@router.get("/market/holidays")
async def get_holidays(request: Request):
    rid = _req_id(request)
    try:
        return await execute_proxy_request("GET", "holidays-calendar", {}, None, rid)
    except Exception as e:
        _api_error(e, "holidays-calendar", rid)

@router.get("/market/announcements")
async def get_announcements(request: Request):
    from datetime import datetime, timedelta
    rid = _req_id(request)
    now = datetime.now()
    q = {
        "from_date": (now - timedelta(days=1)).strftime("%Y-%m-%d"),
        "to_date": now.strftime("%Y-%m-%d"),
        **dict(request.query_params)
    }
    try:
        return await execute_proxy_request("GET", "corp-announcements", q, None, rid)
    except Exception as e:
        _api_error(e, "corp-announcements", rid)

@router.get("/market/commodity-list")
async def get_commodity_list(request: Request):
    rid = _req_id(request)
    q = {"category": "monthly_index", **dict(request.query_params)}
    try:
        return await execute_proxy_request("GET", "commodity-list", q, None, rid)
    except Exception as e:
        _api_error(e, "commodity-list", rid)


@router.get("/refreshed-stocks")
async def get_refreshed_stocks(request: Request):
    rid = _req_id(request)
    try:
        return await execute_proxy_request("GET", "stock-symbols", dict(request.query_params), None, rid)
    except Exception as e:
        _api_error(e, "refreshed-stocks", rid)


# ── Guest profile endpoint (replaces auth /api/auth/profile) ─────────────────
from fastapi import APIRouter as _AR
_auth = _AR(prefix="/api/auth", tags=["auth"])

@_auth.get("/profile")
async def guest_profile():
    """Returns a guest user so frontend doesn't break without auth."""
    return {
        "success": True,
        "user": {"id": "guest", "email": "guest@finscreen.app", "name": "Guest", "plan": "FREE"}
    }
