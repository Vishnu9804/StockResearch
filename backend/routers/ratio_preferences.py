from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.db_user import get_db_user
from models.models import User, UserRatioPreference
from schemas.ratio_preference import RatioPreferenceAdd, RatioPreferenceOut

router = APIRouter(prefix="/api/ratio-preferences", tags=["ratio-preferences"])


@router.get("/")
async def list_ratio_preferences(db: AsyncSession = Depends(get_db), db_user: User = Depends(get_db_user)):
    result = await db.execute(
        select(UserRatioPreference).where(UserRatioPreference.user_id == db_user.id)
    )
    prefs = result.scalars().all()
    return {
        "success": True,
        "ratioKeys": [p.ratio_key for p in prefs],
        "preferences": [RatioPreferenceOut.model_validate(p).model_dump(by_alias=True) for p in prefs],
    }


@router.post("/", status_code=201)
async def add_ratio_preferences(
    body: RatioPreferenceAdd, db: AsyncSession = Depends(get_db), db_user: User = Depends(get_db_user)
):
    keys = [k for k in dict.fromkeys(body.ratio_keys) if k]
    if keys:
        stmt = pg_insert(UserRatioPreference).values(
            [{"user_id": db_user.id, "ratio_key": k} for k in keys]
        ).on_conflict_do_nothing(index_elements=["user_id", "ratio_key"])
        await db.execute(stmt)
        await db.flush()

    result = await db.execute(
        select(UserRatioPreference).where(UserRatioPreference.user_id == db_user.id)
    )
    prefs = result.scalars().all()
    return {"success": True, "ratioKeys": [p.ratio_key for p in prefs]}


@router.delete("/{ratio_key}")
async def remove_ratio_preference(
    ratio_key: str, db: AsyncSession = Depends(get_db), db_user: User = Depends(get_db_user)
):
    result = await db.execute(
        select(UserRatioPreference).where(
            UserRatioPreference.user_id == db_user.id, UserRatioPreference.ratio_key == ratio_key
        )
    )
    pref = result.scalar_one_or_none()
    if pref is not None:
        await db.delete(pref)
    return {"success": True}
