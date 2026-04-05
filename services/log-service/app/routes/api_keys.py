"""API key management — generate, list, and revoke keys for IDS watcher auth."""

import uuid
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user, CurrentUser
from app.models.api_key import APIKey, generate_api_key

router = APIRouter(prefix="/api/api-keys", tags=["api-keys"])


class CreateKeyRequest(BaseModel):
    label: str


class APIKeyOut(BaseModel):
    id: uuid.UUID
    label: str
    key_preview: str
    is_active: bool
    last_used_at: str | None
    created_at: str

    model_config = {"from_attributes": True}


@router.post("")
async def create_api_key(
    body: CreateKeyRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a new API key. The full key is only shown once."""
    raw_key = generate_api_key()
    key_row = APIKey(
        key=raw_key,
        label=body.label,
        user_id=user.user_id,
        team_id=user.team_id,
        tier=user.tier,
    )
    db.add(key_row)
    await db.commit()
    await db.refresh(key_row)
    return {
        "id": str(key_row.id),
        "label": key_row.label,
        "key": raw_key,
        "message": "Save this key — it won't be shown again.",
    }


@router.get("")
async def list_api_keys(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all API keys for the current user (keys are masked)."""
    result = await db.execute(
        select(APIKey).where(APIKey.user_id == user.user_id).order_by(APIKey.created_at.desc())
    )
    keys = result.scalars().all()
    return [
        {
            "id": str(k.id),
            "label": k.label,
            "key_preview": k.key[:7] + "..." + k.key[-4:],
            "is_active": k.is_active,
            "last_used_at": k.last_used_at.isoformat() if k.last_used_at else None,
            "created_at": k.created_at.isoformat(),
        }
        for k in keys
    ]


@router.delete("/{key_id}")
async def revoke_api_key(
    key_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke an API key (soft delete — marks inactive)."""
    result = await db.execute(
        select(APIKey).where(APIKey.id == key_id, APIKey.user_id == user.user_id)
    )
    key_row = result.scalar_one_or_none()
    if not key_row:
        raise HTTPException(status_code=404, detail="API key not found")
    key_row.is_active = False
    await db.commit()
    return {"revoked": True}
