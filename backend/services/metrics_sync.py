"""
services/metrics_sync.py
Populates/refreshes the local `company_metrics` table from FinEdge's real,
working endpoints. FinEdge has no functional screener endpoint of its own
(`/screener/run` returns an empty 200 for any path, including nonexistent
ones) so the screener filters against this local cache instead.

Two independent syncs:
  - sync_quote_data(): one bulk /quote call covers market cap/price/52w/
    volume for the entire universe (~6600 symbols).
  - sync_fundamentals_batch(): per-symbol calls (ratios + price-ratios +
    profile) for a batch of symbols, prioritized by market cap. Expensive
    (5 calls/symbol) so it's run in small batches on a schedule rather than
    all at once.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from models.models import CompanyMetric
from services.finedge_service import execute_proxy_request

logger = logging.getLogger("metrics_sync")

_FUNDAMENTALS_CONCURRENCY = 3


def _pct(val: Any) -> float | None:
    """FinEdge ratio fractions (0.0774) -> percent (7.74). Already-percent
    values (>1) are left as-is."""
    if val is None:
        return None
    try:
        v = float(val)
    except (TypeError, ValueError):
        return None
    return v * 100 if 0 < v <= 1 else v


def _num(val: Any) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


async def sync_quote_data(db: AsyncSession) -> int:
    """Bulk-syncs market cap/price/52w-range/volume for every symbol FinEdge
    quotes, in a single API call. Returns the number of rows upserted."""
    rid = "metrics_sync_quote"
    quotes = await execute_proxy_request("GET", "quote", {}, None, rid)
    symbols_list = await execute_proxy_request("GET", "stock-symbols", {}, None, rid)

    if not isinstance(quotes, dict):
        logger.warning("[MetricsSync] Unexpected /quote shape, aborting quote sync")
        return 0

    name_by_symbol = {}
    if isinstance(symbols_list, list):
        for s in symbols_list:
            sym = s.get("symbol")
            if sym:
                name_by_symbol[sym] = s.get("name") or sym

    now = datetime.now(timezone.utc)
    rows = []
    for symbol, q in quotes.items():
        if not isinstance(q, dict):
            continue
        rows.append({
            "symbol": symbol,
            "name": name_by_symbol.get(symbol, symbol),
            "cmp": _num(q.get("current_price")),
            "change_pct": _num(str(q.get("change", "")).replace("%", "")) if q.get("change") is not None else None,
            "market_cap": _num(q.get("market_cap")),
            "high_52w": _num(q.get("high52")),
            "low_52w": _num(q.get("low52")),
            "volume": _num(q.get("volume")),
            "quote_synced_at": now,
            "updated_at": now,
        })

    if not rows:
        return 0

    # asyncpg caps bound parameters per statement at 32767 — chunk the upsert
    # (11 columns/row) well under that ceiling.
    chunk_size = 500
    for i in range(0, len(rows), chunk_size):
        chunk = rows[i : i + chunk_size]
        stmt = pg_insert(CompanyMetric).values(chunk)
        stmt = stmt.on_conflict_do_update(
            index_elements=["symbol"],
            set_={
                "name": stmt.excluded.name,
                "cmp": stmt.excluded.cmp,
                "change_pct": stmt.excluded.change_pct,
                "market_cap": stmt.excluded.market_cap,
                "high_52w": stmt.excluded.high_52w,
                "low_52w": stmt.excluded.low_52w,
                "volume": stmt.excluded.volume,
                "quote_synced_at": stmt.excluded.quote_synced_at,
                "updated_at": stmt.excluded.updated_at,
            },
        )
        await db.execute(stmt)
    await db.commit()
    logger.info(f"[MetricsSync] Quote sync upserted {len(rows)} rows")
    return len(rows)


async def _fetch_fundamentals(symbol: str, rid: str) -> dict[str, Any]:
    results = await asyncio.gather(
        execute_proxy_request("GET", f"ratios/{symbol}", {"statement_type": "s", "ratio_type": "pr"}, None, rid),
        execute_proxy_request("GET", f"ratios/{symbol}", {"statement_type": "s", "ratio_type": "le"}, None, rid),
        execute_proxy_request("GET", f"ratios/{symbol}", {"statement_type": "s", "ratio_type": "li"}, None, rid),
        execute_proxy_request("GET", f"daily-price-ratios/{symbol}", {"statement_type": "s"}, None, rid),
        execute_proxy_request("GET", f"company-profile/{symbol}", {}, None, rid),
        return_exceptions=True,
    )
    pr_data, le_data, li_data, price_ratios_data, profile_data = results

    def latest(data, list_key="ratios"):
        if isinstance(data, Exception) or not data:
            return None
        items = data.get(list_key)
        if not isinstance(items, list) or not items:
            return None
        return sorted(items, key=lambda r: r.get("year", 0), reverse=True)[0]

    pr = latest(pr_data)
    le = latest(le_data)
    li = latest(li_data)
    price_ratios = latest(price_ratios_data, "price_ratios")
    profile = profile_data if not isinstance(profile_data, Exception) else None

    out: dict[str, Any] = {}
    if pr:
        out["roe"] = _pct(pr.get("returnOnEquity"))
        out["roce"] = _pct(pr.get("returnOnCapital"))
        out["net_profit_margin"] = _pct(pr.get("netMargin"))
        out["ebitda_margin"] = _pct(pr.get("ebitdaMargin"))
    if le:
        out["debt_to_equity"] = _num(le.get("totalDebtToEquity"))
    if li:
        out["current_ratio"] = _num(li.get("currentRatio"))
        out["interest_coverage"] = _num(li.get("interestCoverage"))
    if price_ratios:
        out["pe"] = _num(price_ratios.get("pe"))
        out["pb"] = _num(price_ratios.get("pb"))
    if profile:
        out["sector"] = profile.get("sector") or profile.get("macro_sector")
        out["industry"] = profile.get("industry")

    return out


async def sync_fundamentals_batch(db: AsyncSession, batch_size: int = 100) -> int:
    """Enriches a batch of symbols (oldest/never-synced fundamentals first,
    prioritized by market cap) with ratios/valuation/sector data. Returns the
    number of symbols enriched."""
    result = await db.execute(
        select(CompanyMetric)
        .where(CompanyMetric.market_cap.isnot(None))
        .order_by(CompanyMetric.fundamentals_synced_at.asc().nulls_first(), CompanyMetric.market_cap.desc())
        .limit(batch_size)
    )
    targets = result.scalars().all()
    if not targets:
        return 0

    sem = asyncio.Semaphore(_FUNDAMENTALS_CONCURRENCY)
    rid = "metrics_sync_fundamentals"

    async def enrich_one(row: CompanyMetric):
        async with sem:
            try:
                data = await _fetch_fundamentals(row.symbol, rid)
            except Exception as e:
                logger.warning(f"[MetricsSync] Fundamentals fetch failed for {row.symbol}: {e}")
                data = {}
            return row, data

    enriched = await asyncio.gather(*(enrich_one(r) for r in targets))

    now = datetime.now(timezone.utc)
    for row, data in enriched:
        for field, value in data.items():
            setattr(row, field, value)
        row.fundamentals_synced_at = now
        row.updated_at = now

    await db.commit()
    logger.info(f"[MetricsSync] Fundamentals sync enriched {len(enriched)} symbols")
    return len(enriched)
