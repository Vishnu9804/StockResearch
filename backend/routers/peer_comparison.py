"""
routers/peer_comparison.py
Peer Comparison section on the company detail page.

Financial Ratios data is served from the local `company_metrics` cache (the
same table the Screener filters against — see services/metrics_sync.py) so
the table loads instantly and never fires a burst of live FinEdge calls on
every page view. The peer set itself still comes from FinEdge's real
`peers/{symbol}` endpoint by default; switching the sector dropdown to a
different sector re-queries `company_metrics` by that sector instead, since
FinEdge's peers endpoint is scoped to the anchor symbol's own sector.

Quarterly Performance is fetched live from FinEdge on demand (only once the
user opens that tab) since quarter-level P&L isn't cached anywhere locally.
"""

from fastapi import APIRouter, Request, Depends
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
import logging
import time

from core.database import get_db
from models.models import CompanyMetric
from services.finedge_service import execute_proxy_request

router = APIRouter(prefix="/api/finscreen", tags=["peer-comparison"])
logger = logging.getLogger("peer_comparison")

MAX_PEERS = 10
MAX_PEERS_HARD_CAP = 100
QUARTERLY_CONCURRENCY = 4
MAX_QUARTERLY_SYMBOLS = 12


def _req_id(request: Request) -> str:
    return request.headers.get("x-request-id", f"req_{int(time.time() * 1000)}")


def _to_peer_dict(r: CompanyMetric) -> dict:
    cmp_ = float(r.cmp) if r.cmp is not None else 0.0
    pe = float(r.pe) if r.pe is not None else 0.0
    if r.pb is not None:
        pb = float(r.pb)
    elif r.book_value and float(r.book_value) > 0 and cmp_:
        pb = round(cmp_ / float(r.book_value), 2)
    else:
        pb = 0.0
    return {
        "symbol": r.symbol,
        "name": r.name,
        "sector": r.sector,
        "marketCap": float(r.market_cap) if r.market_cap is not None else 0.0,
        "price": cmp_,
        "change": float(r.change_pct) if r.change_pct is not None else 0.0,
        "pe": pe,
        "pb": pb,
        # Not reliably derivable from the cached fields (would require
        # compounding several approximations) — left null rather than guessed.
        # The frontend fills this in for the anchor row from its own
        # already-loaded profile (`ratios.evEbitda`), which is real.
        "evEbitda": None,
        "dividendYield": float(r.dividend_yield) if r.dividend_yield is not None else None,
        "debtToEquity": float(r.debt_to_equity) if r.debt_to_equity is not None else 0.0,
    }


async def _get_anchor(db: AsyncSession, sym: str) -> CompanyMetric | None:
    result = await db.execute(select(CompanyMetric).where(CompanyMetric.symbol == sym))
    return result.scalar_one_or_none()


async def _peers_by_sector(db: AsyncSession, sector: str, exclude_sym: str, limit: int = MAX_PEERS) -> list[CompanyMetric]:
    result = await db.execute(
        select(CompanyMetric)
        .where(
            CompanyMetric.sector.ilike(sector),
            CompanyMetric.symbol != exclude_sym,
            CompanyMetric.market_cap.isnot(None),
            # Some quote-sync rows never got a resolved name (still just the
            # raw BSE numeric code) — exclude them rather than surfacing
            # "532407 / 532407" as a peer.
            CompanyMetric.name != CompanyMetric.symbol,
        )
        .order_by(CompanyMetric.market_cap.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


@router.get("/company/{symbol}/peer-comparison")
async def get_peer_comparison(symbol: str, request: Request, db: AsyncSession = Depends(get_db)):
    sym = symbol.upper()
    rid = _req_id(request)
    sector_param = request.query_params.get("sector")
    try:
        limit = min(max(1, int(request.query_params.get("limit", MAX_PEERS))), MAX_PEERS_HARD_CAP)
    except ValueError:
        limit = MAX_PEERS

    anchor = await _get_anchor(db, sym)
    anchor_sector = anchor.sector if anchor else None
    effective_sector = sector_param or anchor_sector or "Other"

    is_fallback = False
    peer_rows: list[CompanyMetric] = []

    # Only ask FinEdge for the anchor's real peer set when the dropdown is
    # still on the company's own (default) sector — FinEdge's peers endpoint
    # has no concept of "peers within an arbitrary different sector".
    use_finedge = sector_param is None or sector_param == anchor_sector
    if use_finedge:
        try:
            resp = await execute_proxy_request("GET", f"peers/{sym}", {"group": "sector"}, None, rid)
            peer_symbols = [
                str(s).upper() for s in (resp.get("peers") if isinstance(resp, dict) else [])
                if str(s).upper() != sym
            ]
        except Exception as e:
            logger.warning(f"[PeerComparison] FinEdge peers/{sym} failed: {e}")
            peer_symbols = []

        if peer_symbols:
            result = await db.execute(
                select(CompanyMetric).where(CompanyMetric.symbol.in_(peer_symbols))
            )
            peer_rows = list(result.scalars().all())

        if not peer_rows:
            is_fallback = True

    if not use_finedge or is_fallback:
        peer_rows = await _peers_by_sector(db, effective_sector, sym, limit=limit)

    sectors_result = await db.execute(
        select(CompanyMetric.sector).where(CompanyMetric.sector.isnot(None)).distinct()
    )
    available_sectors = sorted({s for (s,) in sectors_result.all() if s})
    if effective_sector not in available_sectors:
        available_sectors = sorted(set(available_sectors) | {effective_sector})

    return {
        "symbol": sym,
        "resolvedSector": effective_sector,
        "isFallback": is_fallback,
        "availableSectors": available_sectors,
        "peers": [_to_peer_dict(r) for r in peer_rows[:limit]],
    }


def _sorted_periods(data) -> list:
    if not data or not isinstance(data.get("financials"), list):
        return []
    return sorted(data["financials"], key=lambda f: int(str(f.get("period_end", f.get("year", 0)))), reverse=True)


def _quarter_label(f: dict) -> str:
    period_end = f.get("period_end")
    if period_end:
        s = str(period_end)
        if len(s) == 8:
            year, month_num = s[:4], int(s[4:6])
            months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            return f"{months[month_num - 1]}'{year[2:]}"
    y = f.get("year")
    return f"Q'{str(y)[2:]}" if y else "N/A"


async def _fetch_quarterly_snapshot(sym: str, rid: str) -> dict:
    empty = {"symbol": sym, "quarter": None, "revenue": None, "netProfit": None, "revenueYoY": None, "profitYoY": None}
    try:
        data = await execute_proxy_request(
            "GET", f"financials/{sym}",
            {"statement_type": "s", "period": "quarterly", "statement_code": "pl"},
            None, rid,
        )
    except Exception as e:
        logger.warning(f"[PeerComparison] Quarterly financials failed for {sym}: {e}")
        return empty

    periods = _sorted_periods(data)
    if not periods:
        return empty

    latest = periods[0]
    revenue = latest.get("revenueFromOperations")
    net_profit = latest.get("profitLossForPeriod")

    revenue_yoy = profit_yoy = None
    if len(periods) > 4:
        yoy = periods[4]
        yoy_rev, yoy_pat = yoy.get("revenueFromOperations"), yoy.get("profitLossForPeriod")
        if revenue is not None and yoy_rev:
            revenue_yoy = round((revenue - yoy_rev) / abs(yoy_rev) * 100, 2)
        if net_profit is not None and yoy_pat:
            profit_yoy = round((net_profit - yoy_pat) / abs(yoy_pat) * 100, 2)

    return {
        "symbol": sym,
        "quarter": _quarter_label(latest),
        "revenue": round(revenue / 1e7, 2) if revenue is not None else None,
        "netProfit": round(net_profit / 1e7, 2) if net_profit is not None else None,
        "revenueYoY": revenue_yoy,
        "profitYoY": profit_yoy,
    }


@router.get("/company/{symbol}/peer-comparison/quarterly")
async def get_peer_comparison_quarterly(symbol: str, request: Request):
    rid = _req_id(request)
    raw_symbols = request.query_params.get("symbols", "")
    symbols = list(dict.fromkeys(s.strip().upper() for s in raw_symbols.split(",") if s.strip()))[:MAX_QUARTERLY_SYMBOLS]
    if not symbols:
        symbols = [symbol.upper()]

    sem = asyncio.Semaphore(QUARTERLY_CONCURRENCY)

    async def bound_fetch(sym: str) -> dict:
        async with sem:
            return await _fetch_quarterly_snapshot(sym, rid)

    quarters = await asyncio.gather(*(bound_fetch(s) for s in symbols))
    return {"symbol": symbol.upper(), "quarters": quarters}
