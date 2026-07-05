from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
import logging

from core.database import get_db, SavedQuery
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/queries", tags=["queries"])
logger = logging.getLogger("queries")

class CreateQueryBody(BaseModel):
    queryText: str

def _query_dict(q: SavedQuery) -> dict:
    return {
        "id": q.id,
        "userId": q.user_id,
        "queryText": q.query_text,
        "createdAt": q.created_at.isoformat()
    }

@router.get("")
@router.get("/")
async def get_saved_queries(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(SavedQuery)
        .where(SavedQuery.user_id == current_user.id)
        .order_by(SavedQuery.created_at.desc())
    )
    return {"success": True, "queries": [_query_dict(q) for q in result.scalars().all()]}

@router.post("", status_code=201)
@router.post("/", status_code=201)
async def save_query(
    body: CreateQueryBody,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    text = body.queryText.strip()
    if not text:
        raise HTTPException(400, "Query text cannot be empty.")

    # Check duplicate
    stmt = select(SavedQuery).where(
        SavedQuery.user_id == current_user.id,
        SavedQuery.query_text == text
    )
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        return {"success": True, "message": "Query already saved."}

    query = SavedQuery(user_id=current_user.id, query_text=text)
    db.add(query)
    await db.commit()
    await db.refresh(query)
    return {"success": True, "query": _query_dict(query)}

@router.delete("/{query_id}")
async def delete_query(
    query_id: str,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(SavedQuery).where(
        SavedQuery.id == query_id,
        SavedQuery.user_id == current_user.id
    )
    res = await db.execute(stmt)
    query = res.scalar_one_or_none()
    if not query:
        raise HTTPException(404, "Saved query not found.")

    await db.delete(query)
    await db.commit()
    return {"success": True, "message": "Saved query deleted."}
