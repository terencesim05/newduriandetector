import uuid
import secrets
from datetime import datetime, timezone
from sqlalchemy import Column, String, BigInteger, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


def generate_api_key() -> str:
    """Generate a random API key prefixed with 'dd_' for easy identification."""
    return f"dd_{secrets.token_urlsafe(32)}"


class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key = Column(String(64), unique=True, nullable=False, default=generate_api_key)
    label = Column(String(100), nullable=False)
    user_id = Column(BigInteger, nullable=False)
    team_id = Column(UUID(as_uuid=True), nullable=True)
    tier = Column(String(20), nullable=False, default="FREE")
    is_active = Column(Boolean, nullable=False, default=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
