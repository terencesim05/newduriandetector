import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, BigInteger, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class ComparisonRun(Base):
    __tablename__ = "comparison_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(BigInteger, nullable=False)
    team_id = Column(UUID(as_uuid=True), nullable=True)
    sample_name = Column(String(100), nullable=False)
    sample_label = Column(String(255), nullable=False)
    snort_count = Column(Integer, default=0)
    suricata_count = Column(Integer, default=0)
    agreement_count = Column(Integer, default=0)
    snort_only_count = Column(Integer, default=0)
    suricata_only_count = Column(Integer, default=0)
    severity_disagreement_count = Column(Integer, default=0)
    matched_pairs = Column(JSONB, default=list)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
