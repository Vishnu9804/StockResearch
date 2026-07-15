from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database import get_db
from dependencies.db_user import get_db_user
from models.models import Portfolio, User
from schemas.portfolio import PortfolioOut

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.get("/")
async def get_portfolios(db: AsyncSession = Depends(get_db), db_user: User = Depends(get_db_user)):
    result = await db.execute(
        select(Portfolio).options(selectinload(Portfolio.holdings)).where(Portfolio.user_id == db_user.id)
    )
    portfolios = result.scalars().all()
    return {
        "success": True,
        "hasPortfolio": len(portfolios) > 0,
        "portfolios": [PortfolioOut.model_validate(p).model_dump(by_alias=True) for p in portfolios],
    }
