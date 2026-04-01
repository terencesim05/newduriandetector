from __future__ import annotations
import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field, field_validator
from app.models.alert import Severity, Category, IDSSource, QuarantineStatus


# --- Ingest schemas (accept various IDS formats) ---

class AlertIngest(BaseModel):
    """Normalised alert coming from any IDS."""
    severity: Severity
    category: Category
    source_ip: str
    destination_ip: str
    source_port: int | None = None
    destination_port: int | None = None
    protocol: str | None = None
    ids_source: IDSSource
    raw_data: dict[str, Any] | None = None
    detected_at: datetime
    team_id: uuid.UUID | None = None


class SuricataAlert(BaseModel):
    """Raw Suricata EVE JSON alert."""
    timestamp: str
    src_ip: str
    dest_ip: str
    src_port: int | None = None
    dest_port: int | None = None
    proto: str | None = None
    alert: dict[str, Any] = {}
    # full raw payload kept in raw_data


class ZeekAlert(BaseModel):
    """Raw Zeek notice log entry."""
    ts: float
    id_orig_h: str = Field(alias="id.orig_h", default="0.0.0.0")
    id_resp_h: str = Field(alias="id.resp_h", default="0.0.0.0")
    id_orig_p: int | None = Field(alias="id.orig_p", default=None)
    id_resp_p: int | None = Field(alias="id.resp_p", default=None)
    proto: str | None = None
    note: str = ""
    msg: str = ""

    model_config = {"populate_by_name": True}


class SnortAlert(BaseModel):
    """Raw Snort alert."""
    timestamp: str
    src: str
    dst: str
    sport: int | None = None
    dport: int | None = None
    proto: str | None = None
    classtype: str = ""
    priority: int = 3
    msg: str = ""


class KismetAlert(BaseModel):
    """Raw Kismet alert."""
    kismet_device_base_name: str = ""
    kismet_alert_header: str = ""
    kismet_alert_text: str = ""
    kismet_alert_timestamp: float = 0.0
    kismet_alert_source_mac: str = "00:00:00:00:00:00"
    kismet_alert_dest_mac: str = "00:00:00:00:00:00"


class IngestRequest(BaseModel):
    """Accepts either pre-normalised or raw IDS alerts."""
    alerts: list[AlertIngest] | None = None
    suricata_alerts: list[SuricataAlert] | None = None
    zeek_alerts: list[ZeekAlert] | None = None
    snort_alerts: list[SnortAlert] | None = None
    kismet_alerts: list[KismetAlert] | None = None

    @field_validator("*", mode="before")
    @classmethod
    def empty_list_to_none(cls, v: Any) -> Any:
        if isinstance(v, list) and len(v) == 0:
            return None
        return v


class IngestResponse(BaseModel):
    ingested: int
    message: str


# --- Query schemas ---

class AlertOut(BaseModel):
    id: uuid.UUID
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
    assigned_to: int | None
    assigned_name: str | None
    detected_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class AlertListResponse(BaseModel):
    alerts: list[AlertOut]
    total: int
    page: int
    page_size: int
