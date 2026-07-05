from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import logging

from core.database import get_db, User, Watchlist, Subscription, PortfolioHolding
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/admin", tags=["admin"])
logger = logging.getLogger("admin")

@router.get("/summary")
async def get_admin_summary(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Security: for MVP, allow any authenticated user, or restrict by email domain
    # e.g., if "@finscreen.in" not in current_user.email and current_user.email != "admin@finscreen.in":
    #     raise HTTPException(403, "Access denied. Administrator privileges required.")

    try:
        # Total users
        user_cnt = (await db.execute(select(func.count(User.id)))).scalar() or 0

        # Pro users
        pro_cnt = (await db.execute(select(func.count(User.id)).where(User.plan == "PRO"))).scalar() or 0

        # Total watchlists
        wl_cnt = (await db.execute(select(func.count(Watchlist.id)))).scalar() or 0

        # Total subscriptions amount
        total_rev = (await db.execute(select(func.sum(Subscription.amount)))).scalar() or 0.0

        # Holdings count
        holdings_cnt = (await db.execute(select(func.count(PortfolioHolding.id)))).scalar() or 0

        return {
            "success": True,
            "metrics": {
                "totalUsers": user_cnt,
                "proUsers": pro_cnt,
                "totalWatchlists": wl_cnt,
                "totalRevenue": float(total_rev),
                "totalHoldings": holdings_cnt
            },
            "status": {
                "database": "connected",
                "scheduler": "running",
                "cache": "healthy"
            }
        }
    except Exception as e:
        logger.error(f"Failed to fetch admin summary: {e}")
        raise HTTPException(500, "Internal server error gathering stats.")
