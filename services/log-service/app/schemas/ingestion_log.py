from __future__ import annotations
import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel
from app.models.alert import Severity, Category, IDSSource, QuarantineStatus


class IngestionLogOut(BaseModel):
    id: uuid.UUID
    batch_id: uuid.UUID
    upload_filename: str
    severity: Severity
    category: Category
    source_ip: str
    destination_ip: str
    source_port: int | None
    destination_port: int | None
    protocol: str | None
    threat_score: float
    ids_source: IDSSource
    raw_data: dict[str, Any] | None
    user_id: int
    team_id: uuid.UUID | None
    threat_intel: dict[str, Any] | None
    flagged_by_threatfox: str
    is_whitelisted: bool
    is_blocked: bool
    quarantine_status: QuarantineStatus
    quarantined_at: datetime | None
    reviewed_by: str | None
    review_notes: str | None
    ml_confidence: float | None
    geo_latitude: float | None
    geo_longitude: float | None
    geo_country: str | None
    detected_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class IngestionLogListResponse(BaseModel):
    logs: list[IngestionLogOut]
    total: int
    page: int
    page_size: int
