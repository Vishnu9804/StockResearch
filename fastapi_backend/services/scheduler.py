"""
services/scheduler.py
Background alert scheduler — replaces node-cron scheduler.ts.
Runs every 5 minutes, checks saved screens + watchlist price alerts.
"""

import logging
import re
from datetime import datetime, timezone
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import AsyncSessionLocal, SavedScreen, WatchlistItem, Notification, User
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


# ── Scheduler init ────────────────────────────────────────────────────────────

def start_scheduler():
    scheduler.add_job(run_screener_alerts, "interval", minutes=5, id="screener_alerts")
    scheduler.add_job(run_watchlist_alerts, "interval", minutes=5, id="watchlist_alerts")
    scheduler.start()
    logger.info("[Scheduler] Started — running every 5 minutes.")
