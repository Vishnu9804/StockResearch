import uuid

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from middleware.auth import AuthenticatedUser, get_current_user
from models.models import User


async def get_db_user(
    current_user: AuthenticatedUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    auth_id = uuid.UUID(current_user.id)

    result = await db.execute(select(User).where(User.auth_id == auth_id))
    user = result.scalar_one_or_none()
    if user is not None:
        return user

    name = current_user.email.split("@")[0]
    user = User(auth_id=auth_id, email=current_user.email, name=name)
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user
