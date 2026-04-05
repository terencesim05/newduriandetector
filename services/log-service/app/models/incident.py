import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import Column, String, BigInteger, DateTime, Enum, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class IncidentStatus(str, enum.Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class IncidentPriority(str, enum.Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(
        Enum(IncidentStatus, name="incident_status", create_constraint=False),
        nullable=False,
        default=IncidentStatus.OPEN,
    )
    priority = Column(
        Enum(IncidentPriority, name="incident_priority", create_constraint=False),
        nullable=False,
        default=IncidentPriority.MEDIUM,
    )
    created_by_id = Column(BigInteger, nullable=False)
    created_by_name = Column(String(100), nullable=True)
    user_id = Column(BigInteger, nullable=False)
    team_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class IncidentAlert(Base):
    __tablename__ = "incident_alerts"

    incident_id = Column(
        UUID(as_uuid=True),
        ForeignKey("incidents.id", ondelete="CASCADE"),
        primary_key=True,
    )
    alert_id = Column(
        UUID(as_uuid=True),
        ForeignKey("alerts.id", ondelete="CASCADE"),
        primary_key=True,
    )
    added_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class IncidentNote(Base):
    __tablename__ = "incident_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id = Column(
        UUID(as_uuid=True),
        ForeignKey("incidents.id", ondelete="CASCADE"),
        nullable=False,
    )
    content = Column(Text, nullable=False)
    author_id = Column(BigInteger, nullable=False)
    author_name = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
