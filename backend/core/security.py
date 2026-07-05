from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from core.config import settings


def generate_access_token(user_id: str, plan: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": user_id, "plan": plan, "exp": expire, "type": "access"},
        settings.JWT_ACCESS_SECRET,
        algorithm="HS256"
    )


def generate_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": "refresh"},
        settings.JWT_REFRESH_SECRET,
        algorithm="HS256"
    )


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_ACCESS_SECRET, algorithms=["HS256"])


def decode_refresh_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_REFRESH_SECRET, algorithms=["HS256"])
