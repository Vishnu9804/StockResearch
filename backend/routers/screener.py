import re
import uuid

from fastapi import APIRouter, Request, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import select, and_, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
import logging
import time
from core.database import get_db
from dependencies.db_user import get_db_user
from models.models import User, SavedQuery, CompanyMetric
from schemas.saved_query import SavedQueryCreate, SavedQueryUpdate, SavedQueryOut

router = APIRouter(prefix="/api/screener", tags=["screener"])
logger = logging.getLogger("screener")

class RunScreenerBody(BaseModel):
    query: str
    page: int = 1
    limit: int = 25

def _req_id(request: Request) -> str:
    return request.headers.get("x-request-id", f"req_{int(time.time() * 1000)}")


# FinEdge has no working screener endpoint of its own (`/screener/run` returns
# an empty 200 for any path, including nonexistent ones — confirmed by hand).
# Screening instead filters the local `company_metrics` cache, which is kept
# in sync from FinEdge's real endpoints by services/metrics_sync.py.
FIELD_MAP: dict[str, str] = {
    "marketcap": "market_cap",
    "pe": "pe", "peratio": "pe",
    "pb": "pb", "pbratio": "pb",
    "divyield": "dividend_yield", "dividendyield": "dividend_yield",
    "roe": "roe",
    "roce": "roce",
    "netmargin": "net_profit_margin", "netprofitmargin": "net_profit_margin",
    "ebitdamargin": "ebitda_margin",
    "deratio": "debt_to_equity", "de": "debt_to_equity", "debttoequity": "debt_to_equity",
    "currentratio": "current_ratio",
    "interestcoverage": "interest_coverage",
    "cmp": "cmp", "price": "cmp",
    "changepct": "change_pct", "change": "change_pct",
    "high52w": "high_52w",
    "low52w": "low_52w",
    "volume": "volume",
    "eps": "eps",
    "bookvalue": "book_value",
    "sector": "sector",
    "industry": "industry",
}
STRING_FIELDS = {"sector", "industry"}


def _normalize_field(raw: str) -> str | None:
    key = raw.strip().lower().replace(" ", "").replace("_", "")
    return FIELD_MAP.get(key)


def parse_query_to_filters(query_text: str) -> list:
    filters = []
    if not query_text or not query_text.strip():
        return filters

    for token in re.split(r"\bAND\b", query_text, flags=re.IGNORECASE):
        token = token.strip()
        if not token:
            continue

        between_match = re.match(
            r"^([\w\s]+?)\s+between\s+(-?[\d.]+)\s+and\s+(-?[\d.]+)$", token, re.IGNORECASE
        )
        if between_match:
            field = _normalize_field(between_match.group(1))
            if field and field not in STRING_FIELDS:
                col = getattr(CompanyMetric, field)
                filters.append(col.between(float(between_match.group(2)), float(between_match.group(3))))
            continue

        op_match = re.match(r"^([\w\s]+?)\s*(>=|<=|>|<|=|!=)\s*(-?[\d.]+)$", token)
        if op_match:
            field = _normalize_field(op_match.group(1))
            if field and field not in STRING_FIELDS:
                col = getattr(CompanyMetric, field)
                op, val = op_match.group(2), float(op_match.group(3))
                if op == ">":
                    filters.append(col > val)
                elif op == ">=":
                    filters.append(col >= val)
                elif op == "<":
                    filters.append(col < val)
                elif op == "<=":
                    filters.append(col <= val)
                elif op == "=":
                    filters.append(col == val)
                elif op == "!=":
                    filters.append(col != val)
            continue

        str_match = re.match(r"^([\w\s]+?)\s*(=|!=|like)\s*['\"]?([\w\s&,()\-/]+?)['\"]?$", token, re.IGNORECASE)
        if str_match:
            field = _normalize_field(str_match.group(1))
            if field and field in STRING_FIELDS:
                col = getattr(CompanyMetric, field)
                op, val = str_match.group(2).lower(), str_match.group(3).strip()
                if op == "=":
                    filters.append(col.ilike(val))
                elif op == "!=":
                    filters.append(col.isnot(None) & (col != val))
                elif op == "like":
                    filters.append(col.ilike(f"%{val}%"))
            continue

    return filters


def _metric_dict(r: CompanyMetric) -> dict:
    def f(v):
        return float(v) if v is not None else 0

    return {
        "symbol": r.symbol,
        "name": r.name,
        "sector": r.sector or "Other",
        "marketCap": f(r.market_cap),
        "pe": f(r.pe),
        "pb": f(r.pb),
        "dividendYield": f(r.dividend_yield),
        "roe": f(r.roe),
        "roce": f(r.roce),
        "debtToEquity": f(r.debt_to_equity),
        "netProfitMargin": f(r.net_profit_margin),
        "ebitdaMargin": f(r.ebitda_margin),
        "currentRatio": f(r.current_ratio),
        "interestCoverage": f(r.interest_coverage),
        "cmp": f(r.cmp),
        "changePct": f(r.change_pct),
        "high52w": f(r.high_52w),
        "low52w": f(r.low_52w),
        "eps": f(r.eps),
        "bookValue": f(r.book_value),
    }


@router.post("/run")
async def run_screener(body: RunScreenerBody, db: AsyncSession = Depends(get_db)):
    try:
        filters = parse_query_to_filters(body.query)
        base_stmt = select(CompanyMetric)
        if filters:
            base_stmt = base_stmt.where(and_(*filters))

        total = (await db.execute(select(sa_func.count()).select_from(base_stmt.subquery()))).scalar_one()

        # Summary stats must reflect every matching company, not just the
        # current page — computed with SQL aggregates over the full filtered
        # set. Companies still missing a given field (not yet fundamentals-
        # synced) are excluded from that stat's calculation, and we track
        # how many were available vs. missing so the UI can say so plainly.
        agg_select = select(
            sa_func.count().filter(CompanyMetric.pe > 0),
            sa_func.avg(CompanyMetric.pe).filter(CompanyMetric.pe > 0),
            sa_func.count().filter(CompanyMetric.market_cap.isnot(None)),
            sa_func.sum(CompanyMetric.market_cap),
            sa_func.count().filter(CompanyMetric.roce.isnot(None)),
            sa_func.percentile_cont(0.5).within_group(CompanyMetric.roce.asc()).filter(CompanyMetric.roce.isnot(None)),
        )
        if filters:
            agg_select = agg_select.where(and_(*filters))
        pe_available, avg_pe, mcap_available, total_market_cap, roce_available, median_roce = (
            await db.execute(agg_select)
        ).one()

        # Sector lead only makes sense over companies whose sector is actually
        # known — companies not yet synced have no sector yet, so they're
        # excluded here rather than being silently lumped into "Other".
        sector_stmt = select(CompanyMetric.sector, sa_func.count().label("cnt")).where(CompanyMetric.sector.isnot(None))
        if filters:
            sector_stmt = sector_stmt.where(and_(*filters))
        sector_stmt = sector_stmt.group_by(CompanyMetric.sector).order_by(sa_func.count().desc()).limit(2)
        sector_rows = (await db.execute(sector_stmt)).all()
        # sector_rows only holds the top 2 groups — get the true "known sector" total separately.
        sector_total_stmt = select(sa_func.count()).select_from(CompanyMetric).where(CompanyMetric.sector.isnot(None))
        if filters:
            sector_total_stmt = sector_total_stmt.where(and_(*filters))
        sector_available = (await db.execute(sector_total_stmt)).scalar_one()
        sector_breakdown = [
            {
                "sector": sector,
                "count": count,
                "pct": round(count / total * 100, 1) if total else 0,
            }
            for sector, count in sector_rows
        ]

        def coverage(available: int) -> dict:
            return {"available": available, "missing": max(total - available, 0)}

        page = max(1, body.page)
        limit = max(1, min(200, body.limit))
        stmt = (
            base_stmt.order_by(CompanyMetric.market_cap.desc().nulls_last())
            .offset((page - 1) * limit)
            .limit(limit)
        )
        rows = (await db.execute(stmt)).scalars().all()

        return {
            "success": True,
            "results": [_metric_dict(r) for r in rows],
            "total": total,
            "page": page,
            "limit": limit,
            "aggregates": {
                "avgPE": round(float(avg_pe), 2) if avg_pe is not None else None,
                "avgPECoverage": coverage(pe_available),
                "totalMarketCap": round(float(total_market_cap), 2) if total_market_cap is not None else None,
                "totalMarketCapCoverage": coverage(mcap_available),
                "medianROCE": round(float(median_roce), 2) if median_roce is not None else None,
                "medianROCECoverage": coverage(roce_available),
                "sectorBreakdown": sector_breakdown,
                "sectorCoverage": coverage(sector_available),
            },
        }
    except Exception as e:
        logger.error(f"[Screener] Local query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={"error": True, "message": "Failed to run screener query."})


async def _get_owned_saved_query(db: AsyncSession, query_id: uuid.UUID, user_id: uuid.UUID) -> SavedQuery:
    result = await db.execute(
        select(SavedQuery).where(SavedQuery.id == query_id, SavedQuery.user_id == user_id)
    )
    saved = result.scalar_one_or_none()
    if saved is None:
        raise HTTPException(status_code=404, detail="Saved screen not found")
    return saved


@router.get("/saved")
async def list_saved_queries(db: AsyncSession = Depends(get_db), db_user: User = Depends(get_db_user)):
    result = await db.execute(
        select(SavedQuery).where(SavedQuery.user_id == db_user.id).order_by(SavedQuery.created_at.desc())
    )
    saved_queries = result.scalars().all()
    return {
        "success": True,
        "screens": [SavedQueryOut.model_validate(q).model_dump(by_alias=True) for q in saved_queries],
    }


@router.get("/saved/{query_id}")
async def get_saved_query(
    query_id: uuid.UUID, db: AsyncSession = Depends(get_db), db_user: User = Depends(get_db_user)
):
    saved = await _get_owned_saved_query(db, query_id, db_user.id)
    return {"success": True, "screen": SavedQueryOut.model_validate(saved).model_dump(by_alias=True)}


@router.post("/saved", status_code=201)
async def create_saved_query(
    body: SavedQueryCreate, db: AsyncSession = Depends(get_db), db_user: User = Depends(get_db_user)
):
    saved = SavedQuery(
        user_id=db_user.id,
        name=body.name,
        query_text=body.query_text,
        alert_enabled=body.alert_enabled,
        alert_frequency=body.alert_frequency,
    )
    db.add(saved)
    await db.flush()
    await db.refresh(saved)
    return {"success": True, "screen": SavedQueryOut.model_validate(saved).model_dump(by_alias=True)}


@router.put("/saved/{query_id}")
async def update_saved_query(
    query_id: uuid.UUID,
    body: SavedQueryUpdate,
    db: AsyncSession = Depends(get_db),
    db_user: User = Depends(get_db_user),
):
    saved = await _get_owned_saved_query(db, query_id, db_user.id)
    if body.name is not None:
        saved.name = body.name
    if body.query_text is not None:
        saved.query_text = body.query_text
    if body.alert_enabled is not None:
        saved.alert_enabled = body.alert_enabled
    if body.alert_frequency is not None:
        saved.alert_frequency = body.alert_frequency
    await db.flush()
    await db.refresh(saved)
    return {"success": True, "screen": SavedQueryOut.model_validate(saved).model_dump(by_alias=True)}


@router.delete("/saved/{query_id}")
async def delete_saved_query(
    query_id: uuid.UUID, db: AsyncSession = Depends(get_db), db_user: User = Depends(get_db_user)
):
    saved = await _get_owned_saved_query(db, query_id, db_user.id)
    await db.delete(saved)
    return {"success": True}