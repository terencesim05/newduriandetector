import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, BigInteger, Boolean, DateTime, Enum, Text, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class Severity(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Category(str, enum.Enum):
    SQL_INJECTION = "SQL_INJECTION"
    DDOS = "DDOS"
    MALWARE = "MALWARE"
    BRUTE_FORCE = "BRUTE_FORCE"
    PORT_SCAN = "PORT_SCAN"
    XSS = "XSS"
    COMMAND_INJECTION = "COMMAND_INJECTION"
    PRIVILEGE_ESCALATION = "PRIVILEGE_ESCALATION"
    DATA_EXFILTRATION = "DATA_EXFILTRATION"
    ANOMALY = "ANOMALY"
    OTHER = "OTHER"


class IDSSource(str, enum.Enum):
    SURICATA = "suricata"
    ZEEK = "zeek"
    SNORT = "snort"
    KISMET = "kismet"


class QuarantineStatus(str, enum.Enum):
    NONE = "NONE"
    QUARANTINED = "QUARANTINED"
    RELEASED = "RELEASED"
    BLOCKED = "BLOCKED"


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
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
    assigned_to = Column(BigInteger, nullable=True)
    assigned_name = Column(String(100), nullable=True)
    ml_confidence = Column(Float, nullable=True)
    geo_latitude = Column(Float, nullable=True)
    geo_longitude = Column(Float, nullable=True)
    geo_country = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_alerts_source_ip_detected_at", "source_ip", "detected_at"),
        Index("ix_alerts_ids_source_detected_at", "ids_source", "detected_at"),
    )


class DismissedAlert(Base):
    """Tracks which alerts a user has dismissed from the live feed."""
    __tablename__ = "dismissed_alerts"

    user_id = Column(BigInteger, primary_key=True)
    alert_id = Column(UUID(as_uuid=True), primary_key=True)
    dismissed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
