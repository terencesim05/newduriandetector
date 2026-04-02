from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user, CurrentUser
from app.models.ml_config import MLConfig
from app.schemas.ml_config import MLConfigOut, MLConfigUpdate
from app.utils.scoping import apply_scope

router = APIRouter(prefix="/api/ml-config", tags=["ml-config"])


async def _get_or_create_config(db: AsyncSession, user: CurrentUser) -> MLConfig:
    """Return the user's/team's ML config, creating a default one if none exists."""
    q = apply_scope(select(MLConfig), MLConfig, user)
    result = await db.execute(q)
    config = result.scalars().first()
    if config is None:
        config = MLConfig(
            user_id=user.user_id,
            team_id=user.team_id,
        )
        db.add(config)
        await db.flush()
    return config


@router.get("", response_model=MLConfigOut)
async def get_ml_config(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tier = (user.tier or "free").upper()
    if tier not in ("PREMIUM", "EXCLUSIVE"):
        raise HTTPException(status_code=403, detail="ML configuration requires Premium or Exclusive tier")
    config = await _get_or_create_config(db, user)
    await db.commit()
    return MLConfigOut.model_validate(config)


@router.put("", response_model=MLConfigOut)
async def update_ml_config(
    body: MLConfigUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tier = (user.tier or "free").upper()
    if tier not in ("PREMIUM", "EXCLUSIVE"):
        raise HTTPException(status_code=403, detail="ML configuration requires Premium or Exclusive tier")

    config = await _get_or_create_config(db, user)

    if body.model_type is not None:
        config.model_type = body.model_type
    if body.enabled is not None:
        config.enabled = body.enabled
    if body.confidence_threshold is not None:
        config.confidence_threshold = body.confidence_threshold
    if body.sensitivity is not None:
        config.sensitivity = body.sensitivity
    if body.score_boost is not None:
        config.score_boost = body.score_boost

    config.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(config)
    return MLConfigOut.model_validate(config)
