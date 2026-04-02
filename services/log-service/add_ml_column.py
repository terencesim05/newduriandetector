"""
One-time migration: adds ml_confidence column and ml_configs table.
Run: python add_ml_column.py
"""

import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Load .env from project root (same as the app does)
env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL", "")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)


async def migrate():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        await conn.execute(text(
            "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS ml_confidence FLOAT"
        ))
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS ml_configs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id BIGINT NOT NULL,
                team_id UUID,
                model_type VARCHAR(50) NOT NULL DEFAULT 'random_forest',
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                confidence_threshold FLOAT NOT NULL DEFAULT 0.7,
                sensitivity FLOAT NOT NULL DEFAULT 0.8,
                score_boost FLOAT NOT NULL DEFAULT 0.2,
                created_at TIMESTAMPTZ DEFAULT now(),
                updated_at TIMESTAMPTZ DEFAULT now()
            )
        """))
    await engine.dispose()
    print("Done — ml_confidence column + ml_configs table created.")


if __name__ == "__main__":
    asyncio.run(migrate())
