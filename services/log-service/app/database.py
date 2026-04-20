from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

engine = create_async_engine(settings.async_database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session() as session:
        yield session


_STARTUP_INDEXES = [
    "CREATE INDEX IF NOT EXISTS ix_alerts_source_ip_detected_at ON alerts (source_ip, detected_at)",
    "CREATE INDEX IF NOT EXISTS ix_alerts_ids_source_detected_at ON alerts (ids_source, detected_at)",
]


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for stmt in _STARTUP_INDEXES:
            await conn.execute(text(stmt))
