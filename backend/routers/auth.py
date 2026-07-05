from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
import hashlib
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta, timezone

from core.database import get_db, User, Session as DBSession
from core.security import generate_access_token, generate_refresh_token
from core.config import settings
from middleware.auth import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

REFRESH_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60  # seconds
ACCESS_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    rememberMe: bool = False


# ── Helpers ───────────────────────────────────────────────────────────────────

def _set_auth_cookies(response: Response, access_token: str, refresh_token: str, max_age: int):
    secure = settings.ENVIRONMENT == "production"
    response.set_cookie("accessToken", access_token, httponly=True, secure=secure,
                        samesite="strict", max_age=ACCESS_MAX_AGE)
    response.set_cookie("refreshToken", refresh_token, httponly=True, secure=secure,
                        samesite="strict", max_age=max_age)


def _user_dict(user: User) -> dict:
    return {"id": user.id, "email": user.email, "name": user.name, "plan": user.plan}


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/signup", status_code=201)
async def signup(body: SignupRequest, response: Response, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "An account with this email already exists.")

    user = User(
        email=body.email,
        name=body.name,
        password_hash=hash_password(body.password),
        plan="FREE"
    )
    db.add(user)
    await db.flush()  # get user.id without committing

    access_token = generate_access_token(user.id, user.plan)
    refresh_token = generate_refresh_token(user.id)

    db.add(DBSession(
        user_id=user.id,
        refresh_token=refresh_token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    ))
    await db.commit()

    _set_auth_cookies(response, access_token, refresh_token, REFRESH_MAX_AGE)
    return {"success": True, "message": "Account created successfully.", "user": _user_dict(user), "accessToken": access_token}


@router.post("/login")
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    # Auto-register/bypass for the specified test user credentials
    if body.email == "free@finscreen.in" and body.password == "free@finscreen.in":
        result = await db.execute(select(User).where(User.email == "free@finscreen.in"))
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                email="free@finscreen.in",
                name="Free User",
                password_hash=hash_password("free@finscreen.in"),
                plan="FREE"
            )
            db.add(user)
            await db.commit()
            # Refetch to ensure session gets user id
            result = await db.execute(select(User).where(User.email == "free@finscreen.in"))
            user = result.scalar_one()
    else:
        result = await db.execute(select(User).where(User.email == body.email))
        user = result.scalar_one_or_none()

    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password.")

    expiry_days = 30 if body.rememberMe else settings.REFRESH_TOKEN_EXPIRE_DAYS
    max_age = expiry_days * 24 * 60 * 60

    access_token = generate_access_token(user.id, user.plan)
    refresh_token = generate_refresh_token(user.id)

    db.add(DBSession(
        user_id=user.id,
        refresh_token=refresh_token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=expiry_days)
    ))
    await db.commit()

    _set_auth_cookies(response, access_token, refresh_token, max_age)
    return {"success": True, "message": "Logged in successfully.", "user": _user_dict(user), "accessToken": access_token}


@router.get("/profile")
async def profile(current_user: User = Depends(get_current_user)):
    return {"success": True, "user": _user_dict(current_user)}


@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    refresh_token = request.cookies.get("refreshToken")
    if refresh_token:
        await db.execute(delete(DBSession).where(DBSession.refresh_token == refresh_token))
        await db.commit()

    response.delete_cookie("accessToken")
    response.delete_cookie("refreshToken")
    return {"success": True, "message": "Logged out successfully."}
