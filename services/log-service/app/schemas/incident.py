from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, Field
from app.models.incident import IncidentStatus, IncidentPriority


# --- Create / Update ---

class IncidentCreate(BaseModel):
    title: str = Field(..., max_length=255)
    description: str | None = None
    priority: IncidentPriority = IncidentPriority.MEDIUM


class IncidentUpdate(BaseModel):
    title: str | None = Field(None, max_length=255)
    description: str | None = None
    status: IncidentStatus | None = None
    priority: IncidentPriority | None = None


class NoteCreate(BaseModel):
    content: str


class LinkAlertRequest(BaseModel):
    alert_id: uuid.UUID


# --- Read ---

class NoteOut(BaseModel):
    id: uuid.UUID
    incident_id: uuid.UUID
    content: str
    author_id: int
    author_name: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class IncidentOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    status: IncidentStatus
    priority: IncidentPriority
    created_by_id: int
    created_by_name: str | None
    user_id: int
    team_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    alert_count: int = 0
    notes: list[NoteOut] = []

    model_config = {"from_attributes": True}


class IncidentListResponse(BaseModel):
    incidents: list[IncidentOut]
    total: int
    page: int
    page_size: int
