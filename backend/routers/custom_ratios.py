import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.db_user import get_db_user
from models.models import CustomRatio, User
from schemas.custom_ratio import (
    CustomRatioCreate, CustomRatioOut, CustomRatioUpdate, EvaluateFormulaBody,
)
from services.custom_ratio_engine import FormulaError, evaluate_formula, validate_formula_syntax

router = APIRouter(prefix="/api/custom-ratios", tags=["custom-ratios"])


def _req_id(request: Request) -> str:
    return request.headers.get("x-request-id", f"req_{int(time.time() * 1000)}")


async def _get_owned_ratio(db: AsyncSession, ratio_id: uuid.UUID, user_id: uuid.UUID) -> CustomRatio:
    result = await db.execute(
        select(CustomRatio).where(CustomRatio.id == ratio_id, CustomRatio.user_id == user_id)
    )
    ratio = result.scalar_one_or_none()
    if ratio is None:
        raise HTTPException(status_code=404, detail="Custom ratio not found")
    return ratio


@router.get("/")
async def list_custom_ratios(db: AsyncSession = Depends(get_db), db_user: User = Depends(get_db_user)):
    result = await db.execute(
        select(CustomRatio).where(CustomRatio.user_id == db_user.id).order_by(CustomRatio.updated_at.desc())
    )
    ratios = result.scalars().all()
    return {
        "success": True,
        "ratios": [CustomRatioOut.model_validate(r).model_dump(by_alias=True) for r in ratios],
    }


@router.post("/", status_code=201)
async def create_custom_ratio(
    body: CustomRatioCreate, db: AsyncSession = Depends(get_db), db_user: User = Depends(get_db_user)
):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Ratio name is required.")
    try:
        validate_formula_syntax(body.formula)
    except FormulaError as e:
        raise HTTPException(status_code=400, detail=str(e))

    ratio = CustomRatio(user_id=db_user.id, name=name, formula=body.formula, description=body.description)
    db.add(ratio)
    await db.flush()
    await db.refresh(ratio)
    return {"success": True, "ratio": CustomRatioOut.model_validate(ratio).model_dump(by_alias=True)}


@router.put("/{ratio_id}")
async def update_custom_ratio(
    ratio_id: uuid.UUID,
    body: CustomRatioUpdate,
    db: AsyncSession = Depends(get_db),
    db_user: User = Depends(get_db_user),
):
    ratio = await _get_owned_ratio(db, ratio_id, db_user.id)
    if body.formula is not None:
        try:
            validate_formula_syntax(body.formula)
        except FormulaError as e:
            raise HTTPException(status_code=400, detail=str(e))
        ratio.formula = body.formula
    if body.name is not None:
        name = body.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Ratio name is required.")
        ratio.name = name
    if body.description is not None:
        ratio.description = body.description
    await db.flush()
    await db.refresh(ratio)
    return {"success": True, "ratio": CustomRatioOut.model_validate(ratio).model_dump(by_alias=True)}


@router.delete("/{ratio_id}")
async def delete_custom_ratio(
    ratio_id: uuid.UUID, db: AsyncSession = Depends(get_db), db_user: User = Depends(get_db_user)
):
    ratio = await _get_owned_ratio(db, ratio_id, db_user.id)
    await db.delete(ratio)
    return {"success": True}


@router.post("/evaluate")
async def evaluate_custom_ratio(body: EvaluateFormulaBody, request: Request):
    """Live preview: resolves the formula's variables from the same FinEdge-backed
    company profile the company page uses, then safely evaluates the arithmetic."""
    if not body.symbol or not body.symbol.strip():
        raise HTTPException(status_code=400, detail="A ticker symbol is required to preview a formula.")
    rid = _req_id(request)
    try:
        return await evaluate_formula(body.formula, body.symbol, rid)
    except FormulaError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Live data temporarily unavailable for this symbol. Please try again.",
        )
