from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from core.config import settings


class Base(DeclarativeBase):
    pass


# pool_pre_ping validates a pooled connection before handing it out, so a
# connection Supabase silently closed while idle is transparently replaced
# instead of surfacing as a random error under load. pool_recycle proactively
# retires connections older than 30 min for the same reason.
engine = create_async_engine(
    settings.DATABASE_URL,
    connect_args={"ssl": "require"},
    pool_pre_ping=True,
    pool_recycle=1800,
)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
