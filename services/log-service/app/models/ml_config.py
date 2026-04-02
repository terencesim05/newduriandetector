import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Boolean, BigInteger, DateTime
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class MLConfig(Base):
    __tablename__ = "ml_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(BigInteger, nullable=False)
    team_id = Column(UUID(as_uuid=True), nullable=True)

    # Which model to use (only random_forest for now, but extensible)
    model_type = Column(String(50), nullable=False, default="random_forest")

    # Master toggle — skip ML predictions entirely when False
    enabled = Column(Boolean, nullable=False, default=True)

    # Minimum ML confidence to consider an alert "ML-flagged"
    confidence_threshold = Column(Float, nullable=False, default=0.7)

    # ML confidence above this value triggers a score boost
    sensitivity = Column(Float, nullable=False, default=0.8)

    # How much to add to threat_score when ML flags an alert
    score_boost = Column(Float, nullable=False, default=0.2)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
