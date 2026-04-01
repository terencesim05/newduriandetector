import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, BigInteger, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class TeamActivity(Base):
    __tablename__ = "team_activity"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(BigInteger, nullable=False)
    user_name = Column(String(100), nullable=False)
    team_id = Column(UUID(as_uuid=True), nullable=False)
    action = Column(String(50), nullable=False)  # assigned_alert, blocked_ip, released_quarantine, created_rule, etc.
    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
