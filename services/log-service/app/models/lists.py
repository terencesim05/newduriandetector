import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import Column, String, BigInteger, Integer, DateTime, Enum, Text
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class EntryType(str, enum.Enum):
    IP = "IP"
    DOMAIN = "DOMAIN"
    CIDR = "CIDR"


class BlacklistEntry(Base):
    __tablename__ = "blacklist"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entry_type = Column(Enum(EntryType, name="entry_type", create_constraint=False), nullable=False)
    value = Column(String(255), nullable=False)
    reason = Column(Text, nullable=True)
    added_by = Column(String(50), nullable=False, default="manual")  # manual, threatfox, auto
    user_id = Column(BigInteger, nullable=False)
    block_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class WhitelistEntry(Base):
    __tablename__ = "whitelist"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entry_type = Column(Enum(EntryType, name="entry_type", create_constraint=False), nullable=False)
    value = Column(String(255), nullable=False)
    reason = Column(Text, nullable=True)
    added_by = Column(String(50), nullable=False, default="manual")
    user_id = Column(BigInteger, nullable=False)
    trust_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
