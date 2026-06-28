from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from core.database import get_db, Watchlist, WatchlistItem

router = APIRouter(prefix="/api/watchlists", tags=["watchlists"])

# Hardcoded guest user id since auth is removed
GUEST_USER_ID = "guest"

class CreateWatchlistBody(BaseModel):
    name: str

class AddItemBody(BaseModel):
    symbol: str
    targetPrice: Optional[float] = None
    alertEnabled: bool = False

class UpdateItemBody(BaseModel):
    targetPrice: Optional[float] = None
    alertEnabled: Optional[bool] = None

def _wl_dict(wl: Watchlist) -> dict:
    return {
        "id": wl.id, "userId": wl.user_id, "name": wl.name,
        "createdAt": wl.created_at.isoformat(), "updatedAt": wl.updated_at.isoformat(),
        "items": [_item_dict(i) for i in (wl.items or [])]
    }

def _item_dict(item: WatchlistItem) -> dict:
    return {
        "id": item.id, "watchlistId": item.watchlist_id,
        "symbol": item.symbol, "targetPrice": item.target_price,
        "alertEnabled": item.alert_enabled,
        "createdAt": item.created_at.isoformat()
    }

@router.get("")
async def get_watchlists(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Watchlist).order_by(Watchlist.created_at.desc())
    )
    watchlists = result.scalars().all()
    for wl in watchlists:
        items_result = await db.execute(
            select(WatchlistItem).where(WatchlistItem.watchlist_id == wl.id)
        )
        wl.items = items_result.scalars().all()
    return {"success": True, "watchlists": [_wl_dict(w) for w in watchlists]}

@router.post("", status_code=201)
async def create_watchlist(body: CreateWatchlistBody, db: AsyncSession = Depends(get_db)):
    if not body.name.strip():
        raise HTTPException(400, "Please provide a valid watchlist name.")
    wl = Watchlist(user_id=GUEST_USER_ID, name=body.name.strip())
    wl.items = []
    db.add(wl)
    await db.commit()
    await db.refresh(wl)
    return {"success": True, "watchlist": _wl_dict(wl)}

@router.post("/{watchlist_id}/items", status_code=201)
async def add_item(watchlist_id: str, body: AddItemBody, db: AsyncSession = Depends(get_db)):
    if not body.symbol:
        raise HTTPException(400, "Please specify a company stock symbol.")
    result = await db.execute(select(Watchlist).where(Watchlist.id == watchlist_id))
    wl = result.scalar_one_or_none()
    if not wl:
        raise HTTPException(404, "Watchlist not found.")
    existing = await db.execute(
        select(WatchlistItem).where(
            WatchlistItem.watchlist_id == watchlist_id,
            WatchlistItem.symbol == body.symbol.upper()
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Stock already exists inside this watchlist.")
    item = WatchlistItem(
        watchlist_id=watchlist_id, symbol=body.symbol.upper(),
        target_price=body.targetPrice, alert_enabled=body.alertEnabled
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return {"success": True, "item": _item_dict(item)}

@router.patch("/items/{item_id}")
async def update_item(item_id: str, body: UpdateItemBody, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WatchlistItem).where(WatchlistItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Watchlist item not found.")
    if body.targetPrice is not None:
        item.target_price = body.targetPrice
    if body.alertEnabled is not None:
        item.alert_enabled = body.alertEnabled
    await db.commit()
    await db.refresh(item)
    return {"success": True, "item": _item_dict(item)}

@router.delete("/items/{item_id}")
async def delete_item(item_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WatchlistItem).where(WatchlistItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Watchlist item not found.")
    await db.delete(item)
    await db.commit()
    return {"success": True, "message": "Stock removed from watchlist successfully."}

@router.delete("/{watchlist_id}")
async def delete_watchlist(watchlist_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Watchlist).where(Watchlist.id == watchlist_id))
    wl = result.scalar_one_or_none()
    if not wl:
        raise HTTPException(404, "Watchlist not found.")
    await db.delete(wl)
    await db.commit()
    return {"success": True, "message": "Watchlist deleted successfully."}
