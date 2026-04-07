import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load .env from project root if present (local dev). In production, real env vars are used.
root_env = Path(__file__).resolve().parents[3] / ".env"
if root_env.exists():
    load_dotenv(root_env)


class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")
    THREATFOX_AUTH_KEY: str = os.getenv("THREATFOX_AUTH_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    ALGORITHM: str = "HS256"

    @property
    def async_database_url(self) -> str:
        url = self.DATABASE_URL
        # Render/Heroku hand out `postgres://` — SQLAlchemy 2.x rejects it.
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url


settings = Settings()
