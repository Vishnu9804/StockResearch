"""
routers/payments.py
PayU India payment gateway integration.
Mirrors Express payments.ts exactly.
"""

import hashlib
import logging
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Form
from fastapi.responses import RedirectResponse, HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from core.database import get_db, User, Subscription
from core.config import settings
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/payments", tags=["payments"])
logger = logging.getLogger("payments")

PLAN_AMOUNTS = {
    "PRO": 999.0,
    "PREMIUM": 2499.0,
}

PLAN_DURATION_DAYS = {
    "PRO": 30,
    "PREMIUM": 365,
}


# ── PayU Hash helpers ─────────────────────────────────────────────────────────

def _generate_payu_hash(data: dict) -> str:
    """SHA512 hash: key|txnid|amount|productinfo|firstname|email|||||||||||salt"""
    hashstr = (
        f"{data['key']}|{data['txnid']}|{data['amount']}|{data['productinfo']}"
        f"|{data['firstname']}|{data['email']}|||||||||||{settings.PAYU_MERCHANT_SALT}"
    )
    return hashlib.sha512(hashstr.encode()).hexdigest()


def _verify_payu_hash(params: dict) -> bool:
    """Reverse hash for response verification: salt|status|||||||||||email|firstname|productinfo|amount|txnid|key"""
    reverse_str = (
        f"{settings.PAYU_MERCHANT_SALT}|{params.get('status')}|||||||||||"
        f"{params.get('email')}|{params.get('firstname')}|{params.get('productinfo')}"
        f"|{params.get('amount')}|{params.get('txnid')}|{settings.PAYU_MERCHANT_KEY}"
    )
    expected = hashlib.sha512(reverse_str.encode()).hexdigest()
    return expected == params.get("hash", "")


# ── Schemas ───────────────────────────────────────────────────────────────────

class InitiatePaymentBody(BaseModel):
    plan: str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/initiate")
async def initiate_payment(
    body: InitiatePaymentBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    plan = body.plan.upper()
    if plan not in PLAN_AMOUNTS:
        raise HTTPException(400, f"Invalid plan. Choose from: {', '.join(PLAN_AMOUNTS.keys())}")

    amount = PLAN_AMOUNTS[plan]
    txn_id = f"FS-{current_user.id[:8].upper()}-{int(datetime.now().timestamp())}"

    payu_data = {
        "key": settings.PAYU_MERCHANT_KEY,
        "txnid": txn_id,
        "amount": f"{amount:.2f}",
        "productinfo": f"FinScreen {plan} Plan",
        "firstname": current_user.name,
        "email": current_user.email,
        "phone": "9999999999",
        "surl": f"{settings.FRONTEND_URL}/api/payments/payu/success",
        "furl": f"{settings.FRONTEND_URL}/api/payments/payu/failure",
    }
    payu_data["hash"] = _generate_payu_hash(payu_data)

    return {
        "success": True,
        "payuData": payu_data,
        "checkoutUrl": settings.PAYU_CHECKOUT_URL
    }


@router.post("/payu/success")
async def payu_success(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """PayU posts form data to this URL on successful payment."""
    form = await request.form()
    params = dict(form)

    if not _verify_payu_hash(params):
        logger.error(f"[PayU] Hash mismatch for txn {params.get('txnid')}")
        return RedirectResponse(f"{settings.FRONTEND_URL}/payment/failure?reason=hash_mismatch", status_code=302)

    if params.get("status") != "success":
        return RedirectResponse(f"{settings.FRONTEND_URL}/payment/failure?txnid={params.get('txnid')}", status_code=302)

    # Extract plan from productinfo: "FinScreen PRO Plan" → "PRO"
    product_info = params.get("productinfo", "")
    plan = "PRO"
    for p in PLAN_AMOUNTS:
        if p in product_info.upper():
            plan = p
            break

    # Find user by email
    result = await db.execute(select(User).where(User.email == params.get("email")))
    user = result.scalar_one_or_none()
    if not user:
        logger.error(f"[PayU] User not found for email {params.get('email')}")
        return RedirectResponse(f"{settings.FRONTEND_URL}/payment/failure", status_code=302)

    # Upgrade user plan
    user.plan = plan
    end_date = datetime.now(timezone.utc) + timedelta(days=PLAN_DURATION_DAYS.get(plan, 30))

    db.add(Subscription(
        user_id=user.id,
        plan=plan,
        status="active",
        end_date=end_date,
        payu_txn_id=params.get("mihpayid"),
        payu_order_id=params.get("txnid"),
        amount=float(params.get("amount", 0))
    ))
    await db.commit()

    logger.info(f"[PayU] Payment success — user {user.email} upgraded to {plan}")
    return RedirectResponse(f"{settings.FRONTEND_URL}/payment/success?plan={plan}", status_code=302)


@router.post("/payu/failure")
async def payu_failure(request: Request):
    form = await request.form()
    txn_id = dict(form).get("txnid", "")
    logger.warning(f"[PayU] Payment failed for txnid: {txn_id}")
    return RedirectResponse(f"{settings.FRONTEND_URL}/payment/failure?txnid={txn_id}", status_code=302)


@router.get("/status")
async def get_subscription_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Subscription)
        .where(Subscription.user_id == current_user.id)
        .order_by(Subscription.created_at.desc())
        .limit(1)
    )
    sub = result.scalar_one_or_none()

    return {
        "success": True,
        "plan": current_user.plan,
        "subscription": {
            "id": sub.id, "plan": sub.plan, "status": sub.status,
            "startDate": sub.start_date.isoformat(),
            "endDate": sub.end_date.isoformat() if sub.end_date else None,
            "amount": sub.amount
        } if sub else None
    }
