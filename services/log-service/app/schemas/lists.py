from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel
from app.models.lists import EntryType


class ListEntryCreate(BaseModel):
    entry_type: EntryType
    value: str
    reason: str | None = None


class BulkImport(BaseModel):
    entries: list[ListEntryCreate]


class BlacklistOut(BaseModel):
    id: uuid.UUID
    entry_type: EntryType
    value: str
    reason: str | None
    added_by: str
    user_id: int
    team_id: uuid.UUID | None
    block_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class WhitelistOut(BaseModel):
    id: uuid.UUID
    entry_type: EntryType
    value: str
    reason: str | None
    added_by: str
    user_id: int
    team_id: uuid.UUID | None
    trust_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ListResponse(BaseModel):
    entries: list[BlacklistOut] | list[WhitelistOut]
    total: int
