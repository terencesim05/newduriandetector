import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, BigInteger, Boolean, DateTime, Enum, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base
from app.models.alert import Severity, Category, IDSSource, QuarantineStatus


class IngestionLog(Base):
    __tablename__ = "ingestion_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id = Column(UUID(as_uuid=True), nullable=False)
    upload_filename = Column(String(255), nullable=False)
    severity = Column(Enum(Severity, name="alert_severity", create_constraint=False), nullable=False)
    category = Column(Enum(Category, name="alert_category", create_constraint=False), nullable=False)
    source_ip = Column(String(45), nullable=False)
    destination_ip = Column(String(45), nullable=False)
    source_port = Column(Integer, nullable=True)
    destination_port = Column(Integer, nullable=True)
    protocol = Column(String(20), nullable=True)
    threat_score = Column(Float, nullable=False, default=0.0)
    ids_source = Column(Enum(IDSSource, name="ids_source_type", create_constraint=False), nullable=False)
    raw_data = Column(JSONB, nullable=True)
    user_id = Column(BigInteger, nullable=False)
    team_id = Column(UUID(as_uuid=True), nullable=True)
    detected_at = Column(DateTime(timezone=True), nullable=False)
    threat_intel = Column(JSONB, nullable=True)
    flagged_by_threatfox = Column(String(10), nullable=False, default="false")
    is_whitelisted = Column(Boolean, nullable=False, default=False)
    is_blocked = Column(Boolean, nullable=False, default=False)
    quarantine_status = Column(Enum(QuarantineStatus, name="quarantine_status", create_constraint=False), nullable=False, default=QuarantineStatus.NONE)
    quarantined_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by = Column(String(100), nullable=True)
    review_notes = Column(Text, nullable=True)
    ml_confidence = Column(Float, nullable=True)
    geo_latitude = Column(Float, nullable=True)
    geo_longitude = Column(Float, nullable=True)
    geo_country = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
