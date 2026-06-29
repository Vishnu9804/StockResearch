from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from core.database import get_db, User, Portfolio, PortfolioHolding
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])

# ─── Pydantic Schemas ────────────────────────────────────────────────────────

class CreatePortfolioBody(BaseModel):
    name: str

class AddHoldingBody(BaseModel):
    symbol: str
    companyName: str
    quantity: float
    avgBuyPrice: float
    buyDate: Optional[str] = None

class UpdateHoldingBody(BaseModel):
    quantity: Optional[float] = None
    avgBuyPrice: Optional[float] = None

# ─── Helper Mappers ─────────────────────────────────────────────────────────

def _portfolio_dict(p: Portfolio) -> dict:
    return {
        "id": p.id,
        "userId": p.user_id,
        "name": p.name,
        "createdAt": p.created_at.isoformat()
    }

def _holding_dict(h: PortfolioHolding) -> dict:
    return {
        "id": h.id,
        "portfolioId": h.portfolio_id,
        "symbol": h.symbol,
        "companyName": h.company_name,
        "quantity": h.quantity,
        "avgBuyPrice": h.avg_buy_price,
        "buyDate": h.buy_date.isoformat() if h.buy_date else None,
        "createdAt": h.created_at.isoformat()
    }

# ─── Portfolio CRUD ───────────────────────────────────────────────────────────

@router.get("")
async def get_portfolios(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Portfolio).where(Portfolio.user_id == current_user.id).order_by(Portfolio.created_at.desc())
    )
    portfolios = result.scalars().all()
    return {"success": True, "portfolios": [_portfolio_dict(p) for p in portfolios]}

@router.post("", status_code=201)
async def create_portfolio(
    body: CreatePortfolioBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not body.name.strip():
        raise HTTPException(400, "Portfolio name cannot be empty.")
    
    p = Portfolio(user_id=current_user.id, name=body.name.strip())
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return {"success": True, "portfolio": _portfolio_dict(p)}

@router.delete("/{portfolio_id}")
async def delete_portfolio(
    portfolio_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Portfolio).where(Portfolio.id == portfolio_id, Portfolio.user_id == current_user.id)
    )
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Portfolio not found or unauthorized.")
    
    await db.delete(p)
    await db.commit()
    return {"success": True}

# ─── Holdings CRUD ────────────────────────────────────────────────────────────

@router.get("/{portfolio_id}/holdings")
async def get_holdings(
    portfolio_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Verify portfolio ownership
    p_res = await db.execute(
        select(Portfolio).where(Portfolio.id == portfolio_id, Portfolio.user_id == current_user.id)
    )
    p = p_res.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Portfolio not found or unauthorized.")
        
    result = await db.execute(
        select(PortfolioHolding).where(PortfolioHolding.portfolio_id == portfolio_id).order_by(PortfolioHolding.created_at.desc())
    )
    holdings = result.scalars().all()
    return {"success": True, "holdings": [_holding_dict(h) for h in holdings]}

@router.post("/{portfolio_id}/holdings", status_code=201)
async def add_holding(
    portfolio_id: str,
    body: AddHoldingBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    p_res = await db.execute(
        select(Portfolio).where(Portfolio.id == portfolio_id, Portfolio.user_id == current_user.id)
    )
    p = p_res.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Portfolio not found or unauthorized.")
        
    buy_dt = None
    if body.buyDate:
        try:
            buy_dt = datetime.fromisoformat(body.buyDate.replace("Z", "+00:00"))
        except ValueError:
            # Fallback if standard format YYYY-MM-DD
            try:
                buy_dt = datetime.strptime(body.buyDate, "%Y-%m-%d")
            except ValueError:
                pass

    h = PortfolioHolding(
        portfolio_id=portfolio_id,
        symbol=body.symbol.strip().upper(),
        company_name=body.companyName.strip(),
        quantity=body.quantity,
        avg_buy_price=body.avgBuyPrice,
        buy_date=buy_dt
    )
    db.add(h)
    await db.commit()
    await db.refresh(h)
    return {"success": True, "holding": _holding_dict(h)}

@router.put("/{portfolio_id}/holdings/{holding_id}")
async def update_holding(
    portfolio_id: str,
    holding_id: str,
    body: UpdateHoldingBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    p_res = await db.execute(
        select(Portfolio).where(Portfolio.id == portfolio_id, Portfolio.user_id == current_user.id)
    )
    p = p_res.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Portfolio not found or unauthorized.")
        
    h_res = await db.execute(
        select(PortfolioHolding).where(PortfolioHolding.id == holding_id, PortfolioHolding.portfolio_id == portfolio_id)
    )
    h = h_res.scalar_one_or_none()
    if not h:
        raise HTTPException(404, "Holding not found.")

    if body.quantity is not None:
        h.quantity = body.quantity
    if body.avgBuyPrice is not None:
        h.avg_buy_price = body.avgBuyPrice

    await db.commit()
    await db.refresh(h)
    return {"success": True, "holding": _holding_dict(h)}

@router.delete("/{portfolio_id}/holdings/{holding_id}")
async def delete_holding(
    portfolio_id: str,
    holding_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    p_res = await db.execute(
        select(Portfolio).where(Portfolio.id == portfolio_id, Portfolio.user_id == current_user.id)
    )
    p = p_res.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "Portfolio not found or unauthorized.")
        
    h_res = await db.execute(
        select(PortfolioHolding).where(PortfolioHolding.id == holding_id, PortfolioHolding.portfolio_id == portfolio_id)
    )
    h = h_res.scalar_one_or_none()
    if not h:
        raise HTTPException(404, "Holding not found.")

    await db.delete(h)
    await db.commit()
    return {"success": True}
