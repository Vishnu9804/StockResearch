"""
services/scheduler.py
Background alert scheduler — replaces node-cron scheduler.ts.
Runs every 5 minutes, checks saved screens + watchlist price alerts.
"""

import logging
import re
import asyncio
from datetime import datetime, timezone
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import AsyncSessionLocal, SavedScreen, WatchlistItem, Notification, User, CompanyMetric
from services.finedge_service import execute_proxy_request

logger = logging.getLogger("scheduler")
scheduler = AsyncIOScheduler()


# ── Query parser (mirrors Express parseQueryText) ─────────────────────────────

FIELD_MAP = {
    "marketcap": "marketCap", "pe": "pe", "peratio": "pe", "pb": "pb",
    "divyield": "dividendYield", "dividendyield": "dividendYield",
    "roe": "roe", "roce": "roce", "debttoequity": "debtToEquity",
    "de": "debtToEquity", "deratio": "debtToEquity",
    "salesgrowth3y": "salesGrowth3Y", "profitgrowth3y": "profitGrowth3Y",
    "netprofitmargin": "netProfitMargin", "ebitdamargin": "ebitdaMargin",
    "promoterholding": "promoterHolding", "fiiholding": "fiiHolding",
    "currentratio": "currentRatio", "interestcoverage": "interestCoverage",
    "cmp": "price", "price": "price", "eps": "eps", "bookvalue": "bookValue",
}


def _parse_clauses(query_text: str) -> list[dict]:
    clauses = []
    for token in re.split(r"\bAND\b", query_text, flags=re.IGNORECASE):
        token = token.strip()
        if not token:
            continue
        between = re.match(
            r"^([\w\s]+)\s+between\s+([\d.]+)\s+and\s+([\d.]+)$", token, re.IGNORECASE
        )
        if between:
            field = between.group(1).strip().lower().replace(" ", "")
            clauses.append({"field": FIELD_MAP.get(field, field), "op": "between",
                            "value": float(between.group(2)), "value2": float(between.group(3))})
            continue
        op_match = re.match(r"^([\w\s]+)\s*(>=|<=|>|<|=|!=)\s*([\d.]+)$", token, re.IGNORECASE)
        if op_match:
            field = op_match.group(1).strip().lower().replace(" ", "")
            clauses.append({"field": FIELD_MAP.get(field, field), "op": op_match.group(2),
                            "value": float(op_match.group(3))})
    return clauses


def _evaluate(val: float, op: str, value: float, value2: float = None) -> bool:
    match op:
        case ">":   return val > value
        case ">=":  return val >= value
        case "<":   return val < value
        case "<=":  return val <= value
        case "=":   return val == value
        case "!=":  return val != value
        case "between": return value2 is not None and value <= val <= value2
    return False


# ── Live FinEdge fetchers ─────────────────────────────────────────────────────

async def _fetch_screener_results(query_text: str) -> list:
    try:
        data = await execute_proxy_request("POST", "screener/run", {}, {"query": query_text}, "scheduler")
        return data.get("results") or data.get("data") or []
    except Exception as err:
        logger.warning(f"[Scheduler] screener/run failed: {err}")
        return []


async def _fetch_quote(symbol: str) -> dict | None:
    try:
        data = await execute_proxy_request("GET", "quote", {"symbol": symbol}, None, f"quote_{symbol}")
        return data.get("data") or data
    except Exception as err:
        logger.warning(f"[Scheduler] quote/{symbol} failed: {err}")
        return None


# ── Alert tasks ───────────────────────────────────────────────────────────────

async def run_screener_alerts():
    logger.info("[Scheduler] Running screener alert checks…")
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(SavedScreen, User)
            .join(User, SavedScreen.user_id == User.id)
            .where(SavedScreen.alert_enabled == True)
        )
        rows = result.all()
        logger.info(f"[Scheduler] {len(rows)} active screen alert(s) to evaluate.")

        for screen, user in rows:
            matches = await _fetch_screener_results(screen.query_text)

            if not matches:
                clauses = _parse_clauses(screen.query_text)
                if not clauses:
                    continue

            if matches:
                symbols = [m.get("symbol") or m.get("nse_code") for m in matches if m.get("symbol") or m.get("nse_code")]
                if symbols:
                    db.add(Notification(
                        user_id=screen.user_id,
                        type="alert",
                        title=f"Screener Match: {screen.name}",
                        body=(
                            f"Your saved screen \"{screen.name}\" found {len(matches)} matching "
                            f"stocks: {', '.join(symbols[:3])}"
                            f"{'...' if len(symbols) > 3 else ''}. Click to view details."
                        ),
                        symbol=symbols[0],
                        action_url=f"/screener/results?query={screen.query_text}"
                    ))
                    logger.info(f"[Scheduler] Match for \"{screen.name}\": {symbols[:5]}")

        await db.commit()


async def run_watchlist_alerts():
    logger.info("[Scheduler] Running watchlist price alert checks…")
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(WatchlistItem, User)
            .join_from(WatchlistItem, WatchlistItem.watchlist.property.mapper.class_)
            .join(User)
            .where(WatchlistItem.alert_enabled == True)
        )
        items = result.all()
        logger.info(f"[Scheduler] {len(items)} active watchlist alert(s) to scan.")

        for item, user in items:
            if not item.target_price:
                continue

            quote = await _fetch_quote(item.symbol)
            if not quote:
                continue

            current_price = float(
                quote.get("current_price") or quote.get("close_price") or quote.get("ltp") or 0
            )
            if not current_price:
                continue

            if current_price >= item.target_price:
                company_name = quote.get("name") or quote.get("companyName") or item.symbol
                db.add(Notification(
                    user_id=user.id,
                    type="alert",
                    title=f"Price Alert: {item.symbol}",
                    body=(
                        f"{company_name} ({item.symbol}) has crossed your target of "
                        f"₹{item.target_price:,.2f}. Live price: ₹{current_price:,.2f}."
                    ),
                    symbol=item.symbol,
                    action_url=f"/company/{item.symbol}"
                ))
                # Disable so it doesn't fire repeatedly
                item.alert_enabled = False
                logger.info(f"[Scheduler] {item.symbol} crossed ₹{item.target_price} (live: ₹{current_price})")

        await db.commit()


# ── Background Sync Loop (Loop Engineering) ───────────────────────────────────

async def sync_all_company_metrics():
    logger.info("[Scheduler] Starting background loop sync of company metrics from FinEdge API...")
    try:
        symbols_data = await execute_proxy_request("GET", "stock-symbols", {}, None, "scheduler_sync")
        if not symbols_data or not isinstance(symbols_data, list):
            logger.warning("[Scheduler] No stock symbols returned from FinEdge API.")
            return
    except Exception as e:
        logger.error(f"[Scheduler] Failed to fetch stock symbols: {e}")
        return

    def to_percent(val):
        if not val:
            return 0.0
        try:
            v = float(val)
            if abs(v) <= 1.0 and v != 0.0:
                return v * 100.0
            return v
        except Exception:
            return 0.0

    def get_latest_ratio(data):
        if data and isinstance(data.get("ratios"), list) and len(data["ratios"]) > 0:
            return sorted(data["ratios"], key=lambda r: r.get("year", r.get("period_end", 0)), reverse=True)[0]
        return {}

    for item in symbols_data:
        symbol = item.get("symbol")
        if not symbol:
            continue
        symbol = symbol.upper()
        
        # Check if it was updated within last 24 hours
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(CompanyMetric).where(CompanyMetric.symbol == symbol)
            )
            existing = result.scalar_one_or_none()
            if existing:
                # Skip if updated less than 24 hours ago
                age = datetime.now(timezone.utc) - existing.updated_at.replace(tzinfo=timezone.utc)
                if age.total_seconds() < 24 * 3600:
                    continue
        
        logger.info(f"[Scheduler] Fetching live metrics for {symbol}...")
        try:
            quote_data = await execute_proxy_request("GET", "quote", {"symbol": symbol}, None, f"sync_{symbol}")
            pr_data = await execute_proxy_request("GET", f"ratios/{symbol}", {"statement_type": "s", "ratio_type": "pr"}, None, f"sync_{symbol}")
            le_data = await execute_proxy_request("GET", f"ratios/{symbol}", {"statement_type": "s", "ratio_type": "le"}, None, f"sync_{symbol}")
            li_data = await execute_proxy_request("GET", f"ratios/{symbol}", {"statement_type": "s", "ratio_type": "li"}, None, f"sync_{symbol}")
            sh_data = await execute_proxy_request("GET", f"shareholdings/pattern/{symbol}", {"period": "quarterly"}, None, f"sync_{symbol}")
            metrics_data = await execute_proxy_request("GET", f"financial-metrics/{symbol}", {"statement_type": "s", "ratio_type": "cu"}, None, f"sync_{symbol}")
            
            quote = quote_data.get(symbol) or quote_data if quote_data else {}
            
            latest_pr = get_latest_ratio(pr_data)
            latest_le = get_latest_ratio(le_data)
            latest_li = get_latest_ratio(li_data)
            
            promoter = fii = public_h = 0.0
            if sh_data:
                cols = sh_data.get("columns", [])
                rows = sh_data.get("rows", [])
                if cols and rows:
                    latest_col = cols[-1]
                    for row in rows:
                        val = float(row.get("data", {}).get(latest_col, 0) or 0)
                        cat = row.get("catagory", "")
                        if cat in ("Indian", "Promoter"): promoter = val
                        elif cat == "InstitutionsForeign": fii = val
                        elif cat in ("NonInstitutions", "Goverments"): public_h += val
            
            div_yield = eps_val = 0.0
            if metrics_data:
                m = metrics_data.get("metrics") or {}
                div_yield = m.get("dividendYield") or m.get("dividend_yield") or 0
                eps_val = m.get("eps") or m.get("basicEps") or 0

            current_price = float(quote.get("current_price") or quote.get("close_price") or quote.get("ltp") or 0.0)
            change_pct = float(str(quote.get("change") or "0").replace("%", "").strip() or 0.0)
            market_cap = float(quote.get("market_cap") or 0.0)
            
            async with AsyncSessionLocal() as session:
                result = await session.execute(
                    select(CompanyMetric).where(CompanyMetric.symbol == symbol)
                )
                metric = result.scalar_one_or_none()
                if not metric:
                    metric = CompanyMetric(symbol=symbol)
                    session.add(metric)
                    
                metric.name = item.get("name") or symbol
                metric.sector = item.get("sector") or "Other"
                metric.industry = item.get("industry") or "Other"
                metric.cmp = current_price
                metric.change_pct = change_pct
                metric.market_cap = market_cap
                metric.pe = float(latest_pr.get("pe") or latest_pr.get("priceToEarnings") or (current_price / eps_val if current_price and eps_val else 0.0))
                metric.pb = float(latest_le.get("priceToBook") or latest_le.get("pb") or 0.0)
                metric.dividend_yield = to_percent(div_yield)
                metric.roe = to_percent(latest_pr.get("returnOnEquity") or latest_pr.get("roe"))
                metric.roce = to_percent(latest_pr.get("returnOnCapital") or latest_pr.get("returnOnCapitalEmployed") or latest_pr.get("roce"))
                metric.debt_to_equity = float(latest_le.get("totalDebtToEquity") or latest_le.get("debtToEquity") or 0.0)
                metric.sales_growth_3y = to_percent(latest_pr.get("salesGrowth3Y"))
                metric.profit_growth_3y = to_percent(latest_pr.get("profitGrowth3Y"))
                metric.net_profit_margin = to_percent(latest_pr.get("netMargin") or latest_pr.get("netProfitMargin"))
                metric.ebitda_margin = to_percent(latest_pr.get("ebitdaMargin"))
                metric.promoter_holding = promoter
                metric.fii_holding = fii
                metric.current_ratio = float(latest_li.get("currentRatio") or 0.0)
                metric.interest_coverage = float(latest_le.get("interestCoverage") or 0.0)
                metric.high_52w = float(quote.get("high52") or quote.get("week52_high") or 0.0)
                metric.low_52w = float(quote.get("low52") or quote.get("week52_low") or 0.0)
                metric.eps = eps_val
                metric.book_value = float(latest_le.get("bookValuePerShare") or 0.0)
                metric.rsi14 = 50.0
                metric.beta = 1.0
                
                await session.commit()
                logger.info(f"[Scheduler] Successfully updated metrics for {symbol}")
                
        except Exception as ex:
            logger.warning(f"[Scheduler] Failed to sync metrics for {symbol}: {ex}")
            
        await asyncio.sleep(0.5)


async def sync_all_company_metrics_loop():
    while True:
        try:
            await sync_all_company_metrics()
        except Exception as e:
            logger.error(f"[Scheduler] Error in sync_all_company_metrics_loop: {e}")
        await asyncio.sleep(3600)


# ── Scheduler init ────────────────────────────────────────────────────────────

def start_scheduler():
    scheduler.add_job(run_screener_alerts, "interval", minutes=5, id="screener_alerts")
    scheduler.add_job(run_watchlist_alerts, "interval", minutes=5, id="watchlist_alerts")
    scheduler.start()
    logger.info("[Scheduler] Started — running every 5 minutes.")
    
    # Start the continuous sync loop in the background
    asyncio.create_task(sync_all_company_metrics_loop())
