import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import set_committed_value

from core.database import get_db
from dependencies.db_user import get_db_user
from models.models import User, Watchlist, WatchlistItem
from schemas.watchlist import (
    MoveItemBody,
    WatchBody,
    WatchlistCreate,
    WatchlistItemCreate,
    WatchlistItemOut,
    WatchlistItemUpdate,
    WatchlistOut,
    WatchlistRename,
)

router = APIRouter(prefix="/api/watchlists", tags=["watchlist"])

DEFAULT_WATCHLIST_NAME = "My Watchlist"


async def _get_owned_watchlist(db: AsyncSession, watchlist_id: uuid.UUID, user_id: uuid.UUID) -> Watchlist:
    result = await db.execute(
        select(Watchlist)
        .options(selectinload(Watchlist.items))
        .where(Watchlist.id == watchlist_id, Watchlist.user_id == user_id)
    )
    watchlist = result.scalar_one_or_none()
    if watchlist is None:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    return watchlist


async def _get_owned_item(db: AsyncSession, item_id: uuid.UUID, user_id: uuid.UUID) -> WatchlistItem:
    result = await db.execute(
        select(WatchlistItem)
        .join(Watchlist, WatchlistItem.watchlist_id == Watchlist.id)
        .where(WatchlistItem.id == item_id, Watchlist.user_id == user_id)
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=404, detail="Watchlist item not found")
    return item


async def _get_or_create_default_watchlist(db: AsyncSession, user_id: uuid.UUID) -> Watchlist:
    result = await db.execute(
        select(Watchlist)
        .options(selectinload(Watchlist.items))
        .where(Watchlist.user_id == user_id, Watchlist.name == DEFAULT_WATCHLIST_NAME)
    )
    watchlist = result.scalar_one_or_none()
    if watchlist is not None:
        return watchlist

    watchlist = Watchlist(user_id=user_id, name=DEFAULT_WATCHLIST_NAME)
    db.add(watchlist)
    await db.flush()
    await db.refresh(watchlist)
    set_committed_value(watchlist, "items", [])
    return watchlist


@router.get("/")
async def list_watchlists(db: AsyncSession = Depends(get_db), db_user: User = Depends(get_db_user)):
    result = await db.execute(
        select(Watchlist).options(selectinload(Watchlist.items)).where(Watchlist.user_id == db_user.id)
    )
    watchlists = result.scalars().all()
    return {
        "success": True,
        "watchlists": [WatchlistOut.model_validate(wl).model_dump(by_alias=True) for wl in watchlists],
    }


@router.post("/", status_code=201)
async def create_watchlist(
    body: WatchlistCreate, db: AsyncSession = Depends(get_db), db_user: User = Depends(get_db_user)
):
    watchlist = Watchlist(user_id=db_user.id, name=body.name)
    db.add(watchlist)
    await db.flush()
    await db.refresh(watchlist)
    set_committed_value(watchlist, "items", [])
    return {"success": True, "watchlist": WatchlistOut.model_validate(watchlist).model_dump(by_alias=True)}


@router.put("/{watchlist_id}")
async def rename_watchlist(
    watchlist_id: uuid.UUID,
    body: WatchlistRename,
    db: AsyncSession = Depends(get_db),
    db_user: User = Depends(get_db_user),
):
    watchlist = await _get_owned_watchlist(db, watchlist_id, db_user.id)
    watchlist.name = body.name
    await db.flush()
    return {"success": True, "watchlist": WatchlistOut.model_validate(watchlist).model_dump(by_alias=True)}


@router.delete("/{watchlist_id}")
async def delete_watchlist(
    watchlist_id: uuid.UUID, db: AsyncSession = Depends(get_db), db_user: User = Depends(get_db_user)
):
    watchlist = await _get_owned_watchlist(db, watchlist_id, db_user.id)
    await db.delete(watchlist)
    return {"success": True}


@router.post("/{watchlist_id}/items", status_code=201)
async def add_item(
    watchlist_id: uuid.UUID,
    body: WatchlistItemCreate,
    db: AsyncSession = Depends(get_db),
    db_user: User = Depends(get_db_user),
):
    await _get_owned_watchlist(db, watchlist_id, db_user.id)
    item = WatchlistItem(
        watchlist_id=watchlist_id,
        symbol=body.symbol,
        company_name=body.company_name,
        target_price=body.target_price,
        alert_enabled=body.alert_enabled,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)
    return {"success": True, "item": WatchlistItemOut.model_validate(item).model_dump(by_alias=True)}


@router.put("/items/{item_id}")
async def update_item(
    item_id: uuid.UUID,
    body: WatchlistItemUpdate,
    db: AsyncSession = Depends(get_db),
    db_user: User = Depends(get_db_user),
):
    item = await _get_owned_item(db, item_id, db_user.id)
    if body.target_price is not None:
        item.target_price = body.target_price
    if body.alert_enabled is not None:
        item.alert_enabled = body.alert_enabled
    await db.flush()
    await db.refresh(item)
    return {"success": True, "item": WatchlistItemOut.model_validate(item).model_dump(by_alias=True)}


@router.delete("/items/{item_id}")
async def remove_item(item_id: uuid.UUID, db: AsyncSession = Depends(get_db), db_user: User = Depends(get_db_user)):
    item = await _get_owned_item(db, item_id, db_user.id)
    await db.delete(item)
    return {"success": True}


@router.put("/items/{item_id}/move")
async def move_item(
    item_id: uuid.UUID,
    body: MoveItemBody,
    db: AsyncSession = Depends(get_db),
    db_user: User = Depends(get_db_user),
):
    item = await _get_owned_item(db, item_id, db_user.id)
    await _get_owned_watchlist(db, body.target_watchlist_id, db_user.id)
    item.watchlist_id = body.target_watchlist_id
    await db.flush()
    await db.refresh(item)
    return {"success": True, "item": WatchlistItemOut.model_validate(item).model_dump(by_alias=True)}


@router.post("/watch", status_code=201)
async def watch_symbol(body: WatchBody, db: AsyncSession = Depends(get_db), db_user: User = Depends(get_db_user)):
    result = await db.execute(
        select(WatchlistItem)
        .join(Watchlist, WatchlistItem.watchlist_id == Watchlist.id)
        .where(Watchlist.user_id == db_user.id, WatchlistItem.symbol == body.symbol)
    )
    existing = result.scalars().first()

    if existing is not None:
        item = existing
        owning_watchlist = await _get_owned_watchlist(db, item.watchlist_id, db_user.id)
    else:
        owning_watchlist = await _get_or_create_default_watchlist(db, db_user.id)
        item = WatchlistItem(
            watchlist_id=owning_watchlist.id, symbol=body.symbol, company_name=body.company_name
        )
        db.add(item)
        await db.flush()
        await db.refresh(item)

    return {
        "success": True,
        "watchlist": WatchlistOut.model_validate(owning_watchlist).model_dump(by_alias=True),
        "item": WatchlistItemOut.model_validate(item).model_dump(by_alias=True),
    }


@router.delete("/watch/{symbol}")
async def unwatch_symbol(symbol: str, db: AsyncSession = Depends(get_db), db_user: User = Depends(get_db_user)):
    result = await db.execute(
        select(WatchlistItem)
        .join(Watchlist, WatchlistItem.watchlist_id == Watchlist.id)
        .where(Watchlist.user_id == db_user.id, WatchlistItem.symbol == symbol)
    )
    items = result.scalars().all()
    for item in items:
        await db.delete(item)
    return {"success": True, "removedCount": len(items)}
