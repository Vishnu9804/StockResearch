from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from pydantic import BaseModel
from typing import Optional
import logging
import re

from core.database import get_db, SavedScreen, Notification, CompanyMetric
from services.finedge_service import execute_proxy_request

router = APIRouter(prefix="/api/screener", tags=["screener"])
logger = logging.getLogger("screener")

GUEST_USER_ID = "guest"

FIELD_MAP = {
    "marketcap": CompanyMetric.market_cap,
    "marketcapitalization": CompanyMetric.market_cap,
    "pe": CompanyMetric.pe,
    "peratio": CompanyMetric.pe,
    "pricetoearning": CompanyMetric.pe,
    "pricetoearnings": CompanyMetric.pe,
    "pb": CompanyMetric.pb,
    "pbratio": CompanyMetric.pb,
    "pricetobook": CompanyMetric.pb,
    "divyield": CompanyMetric.dividend_yield,
    "dividendyield": CompanyMetric.dividend_yield,
    "dividendpayout": CompanyMetric.dividend_yield,
    "roe": CompanyMetric.roe,
    "returnonequity": CompanyMetric.roe,
    "roce": CompanyMetric.roce,
    "returnoncapitalemployed": CompanyMetric.roce,
    "debttoequity": CompanyMetric.debt_to_equity,
    "debtoequity": CompanyMetric.debt_to_equity,
    "de": CompanyMetric.debt_to_equity,
    "deratio": CompanyMetric.debt_to_equity,
    "salesgrowth3y": CompanyMetric.sales_growth_3y,
    "profitgrowth3y": CompanyMetric.profit_growth_3y,
    "netprofitmargin": CompanyMetric.net_profit_margin,
    "ebitdamargin": CompanyMetric.ebitda_margin,
    "promoterholding": CompanyMetric.promoter_holding,
    "fiiholding": CompanyMetric.fii_holding,
    "currentratio": CompanyMetric.current_ratio,
    "interestcoverage": CompanyMetric.interest_coverage,
    "cmp": CompanyMetric.cmp,
    "price": CompanyMetric.cmp,
    "eps": CompanyMetric.eps,
    "bookvalue": CompanyMetric.book_value,
    "rsi14": CompanyMetric.rsi14,
    "beta": CompanyMetric.beta,
    "sector": CompanyMetric.sector,
    "industry": CompanyMetric.industry,
}

def parse_and_build_filters(query_text: str):
    filters = []
    if not query_text or not query_text.strip():
        return filters
        
    tokens = re.split(r"\bAND\b", query_text, flags=re.IGNORECASE)
    
    for token in tokens:
        token = token.strip()
        if not token:
            continue
            
        between_match = re.match(
            r"^([\w\s]+)\s+between\s+([\d.]+)\s+and\s+([\d.]+)$", token, re.IGNORECASE
        )
        if between_match:
            field_name = between_match.group(1).strip().lower().replace(" ", "")
            val1 = float(between_match.group(2))
            val2 = float(between_match.group(3))
            col = FIELD_MAP.get(field_name)
            if col is not None:
                filters.append(col.between(val1, val2))
            continue
            
        # Match string comparison: e.g. sector = 'Banks' or sector = "Banks" or sector = Banks
        str_match = re.match(r"^([\w\s]+)\s*(=|!=|like)\s*['\"]?([\w\s&,()\-//]+)['\"]?$", token, re.IGNORECASE)
        if str_match:
            field_name = str_match.group(1).strip().lower().replace(" ", "")
            op = str_match.group(2).lower()
            val = str_match.group(3).strip()
            col = FIELD_MAP.get(field_name)
            if col is not None and field_name in ["sector", "industry"]:
                if op == "=":
                    filters.append(col == val)
                elif op == "!=":
                    filters.append(col != val)
                elif op == "like":
                    filters.append(col.ilike(f"%{val}%"))
                continue
            
        op_match = re.match(r"^([\w\s]+)\s*(>=|<=|>|<|=|!=)\s*([\d.]+)$", token, re.IGNORECASE)
        if op_match:
            field_name = op_match.group(1).strip().lower().replace(" ", "")
            op = op_match.group(2)
            val = float(op_match.group(3))
            col = FIELD_MAP.get(field_name)
            if col is not None:
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
            
    return filters

class RunScreenerBody(BaseModel):
    query: str

class SaveScreenBody(BaseModel):
    name: str
    description: Optional[str] = None
    queryText: str
    alertEnabled: bool = False
    alertFrequency: str = "IMMEDIATE"

def _screen_dict(s: SavedScreen) -> dict:
    return {
        "id": s.id, "userId": s.user_id, "name": s.name,
        "description": s.description, "queryText": s.query_text,
        "alertEnabled": s.alert_enabled, "alertFrequency": s.alert_frequency,
        "createdAt": s.created_at.isoformat(), "updatedAt": s.updated_at.isoformat()
    }

def _notif_dict(n: Notification) -> dict:
    return {
        "id": n.id, "type": n.type, "title": n.title,
        "body": n.body, "read": n.read,
        "symbol": n.symbol, "actionUrl": n.action_url,
        "createdAt": n.created_at.isoformat()
    }

@router.post("/run")
async def run_screener(body: RunScreenerBody, db: AsyncSession = Depends(get_db)):
    try:
        stmt = select(CompanyMetric)
        filters = parse_and_build_filters(body.query)
        if filters:
            stmt = stmt.where(and_(*filters))
            
        result = await db.execute(stmt)
        companies = result.scalars().all()
        
        results = []
        for c in companies:
            results.append({
                "symbol": c.symbol,
                "name": c.name,
                "sector": c.sector,
                "marketCap": c.market_cap,
                "pe": c.pe,
                "pb": c.pb,
                "dividendYield": c.dividend_yield,
                "roe": c.roe,
                "roce": c.roce,
                "debtToEquity": c.debt_to_equity,
                "salesGrowth3Y": c.sales_growth_3y,
                "profitGrowth3Y": c.profit_growth_3y,
                "netProfitMargin": c.net_profit_margin,
                "ebitdaMargin": c.ebitda_margin,
                "promoterHolding": c.promoter_holding,
                "fiiHolding": c.fii_holding,
                "currentRatio": c.current_ratio,
                "interestCoverage": c.interest_coverage,
                "cmp": c.cmp,
                "changePct": c.change_pct,
                "high52w": c.high_52w,
                "low52w": c.low_52w,
                "eps": c.eps,
                "bookValue": c.book_value,
                "rsi14": c.rsi14,
                "beta": c.beta
            })
            
        return {"success": True, "results": results, "data": results}
    except Exception as e:
        logger.error(f"[Screener] Local screener query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={"error": True, "message": f"Failed to run screener query: {str(e)}"})

@router.get("/saved")
async def get_saved_screens(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SavedScreen).order_by(SavedScreen.created_at.desc())
    )
    return {"success": True, "screens": [_screen_dict(s) for s in result.scalars().all()]}

@router.post("/saved", status_code=201)
async def save_screen(body: SaveScreenBody, db: AsyncSession = Depends(get_db)):
    if not body.name or not body.queryText:
        raise HTTPException(400, "Please provide screen name and query filters.")
    screen = SavedScreen(
        user_id=GUEST_USER_ID, name=body.name,
        description=body.description, query_text=body.queryText,
        alert_enabled=body.alertEnabled, alert_frequency=body.alertFrequency
    )
    db.add(screen)
    await db.commit()
    await db.refresh(screen)
    return {"success": True, "screen": _screen_dict(screen)}

@router.delete("/saved/{screen_id}")
async def delete_screen(screen_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SavedScreen).where(SavedScreen.id == screen_id))
    screen = result.scalar_one_or_none()
    if not screen:
        raise HTTPException(404, "Saved screen not found.")
    await db.delete(screen)
    await db.commit()
    return {"success": True, "message": "Saved screen deleted successfully."}

@router.get("/notifications")
async def get_notifications(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Notification).order_by(Notification.created_at.desc()).limit(50)
    )
    notifs = result.scalars().all()
    unread = sum(1 for n in notifs if not n.read)
    return {"success": True, "notifications": [_notif_dict(n) for n in notifs], "unreadCount": unread}

@router.patch("/notifications/{notif_id}/read")
@router.put("/notifications/{notif_id}/read")
async def mark_read(notif_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Notification).where(Notification.id == notif_id))
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(404, "Notification not found.")
    notif.read = True
    await db.commit()
    return {"success": True, "notification": _notif_dict(notif)}

@router.patch("/notifications/read-all")
@router.put("/notifications/read-all")
async def mark_all_read(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Notification).where(Notification.read == False))
    for notif in result.scalars().all():
        notif.read = True
    await db.commit()
    return {"success": True, "message": "All notifications marked as read."}
