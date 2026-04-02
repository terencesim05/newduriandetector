from __future__ import annotations
import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class MLConfigOut(BaseModel):
    id: uuid.UUID
    model_type: str
    enabled: bool
    confidence_threshold: float
    sensitivity: float
    score_boost: float
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MLConfigUpdate(BaseModel):
    model_type: str | None = Field(None, pattern=r"^(random_forest|isolation_forest|neural_network)$")
    enabled: bool | None = None
    confidence_threshold: float | None = Field(None, ge=0.0, le=1.0)
    sensitivity: float | None = Field(None, ge=0.0, le=1.0)
    score_boost: float | None = Field(None, ge=0.0, le=0.5)
