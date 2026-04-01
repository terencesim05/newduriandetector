import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, BigInteger, Boolean, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class RuleType(str, enum.Enum):
    RATE_LIMIT = "RATE_LIMIT"
    CATEGORY_MATCH = "CATEGORY_MATCH"
    FAILED_LOGIN = "FAILED_LOGIN"


class Rule(Base):
    __tablename__ = "rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    description = Column(String(500), nullable=True)
    rule_type = Column(Enum(RuleType, name="rule_type", create_constraint=False), nullable=False)
    conditions = Column(JSONB, nullable=False)
    actions = Column(JSONB, nullable=False)
    priority = Column(Integer, nullable=False, default=5)
    enabled = Column(Boolean, nullable=False, default=True)
    trigger_count = Column(Integer, nullable=False, default=0)
    user_id = Column(BigInteger, nullable=False)
    team_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
