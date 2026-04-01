from __future__ import annotations
import uuid
from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field
from app.models.rule import RuleType


class RuleCreate(BaseModel):
    name: str = Field(max_length=200)
    description: str | None = None
    rule_type: RuleType
    conditions: dict[str, Any]
    actions: dict[str, Any]
    priority: int = Field(default=5, ge=1, le=10)
    enabled: bool = True


class RuleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    conditions: dict[str, Any] | None = None
    actions: dict[str, Any] | None = None
    priority: int | None = Field(default=None, ge=1, le=10)
    enabled: bool | None = None


class RuleOut(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    rule_type: RuleType
    conditions: dict[str, Any]
    actions: dict[str, Any]
    priority: int
    enabled: bool
    trigger_count: int
    user_id: int
    team_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class RuleTestResult(BaseModel):
    rule_id: uuid.UUID
    alerts_matched: int
    sample_matches: list[dict[str, Any]]
