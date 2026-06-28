from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import logging

from core.database import get_db, SavedScreen, Notification
from services.finedge_service import execute_proxy_request

router = APIRouter(prefix="/api/screener", tags=["screener"])
logger = logging.getLogger("screener")

GUEST_USER_ID = "guest"

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
async def run_screener(body: RunScreenerBody, request: Request):
    rid = request.headers.get("x-request-id", "screener")
    try:
        return await execute_proxy_request("POST", "screener/run", {}, {"query": body.query}, rid)
    except Exception as e:
        logger.warning(f"[Screener] FinEdge screener failed: {e}")
        raise HTTPException(502, "Screener service temporarily unavailable.")

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
async def mark_read(notif_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Notification).where(Notification.id == notif_id))
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(404, "Notification not found.")
    notif.read = True
    await db.commit()
    return {"success": True, "notification": _notif_dict(notif)}

@router.patch("/notifications/read-all")
async def mark_all_read(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Notification).where(Notification.read == False))
    for notif in result.scalars().all():
        notif.read = True
    await db.commit()
    return {"success": True, "message": "All notifications marked as read."}
