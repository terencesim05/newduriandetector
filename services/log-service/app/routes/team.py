import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user, CurrentUser
from app.models.alert import Alert
from app.models.activity import TeamActivity
from app.schemas.alert import AlertOut
from app.utils.scoping import apply_scope

router = APIRouter(prefix="/api/team", tags=["team"])


class AssignBody(BaseModel):
    assigned_to: int
    assigned_name: str


class ActivityOut(BaseModel):
    id: uuid.UUID
    user_id: int
    user_name: str
    action: str
    details: str | None
    created_at: str

    model_config = {"from_attributes": True}


def _require_team(user: CurrentUser):
    if user.tier != "EXCLUSIVE" or not user.team_id:
        raise HTTPException(status_code=403, detail="Team features require EXCLUSIVE tier with a team")


async def _log_activity(db: AsyncSession, user: CurrentUser, action: str, details: str = ""):
    entry = TeamActivity(
        user_id=user.user_id,
        user_name=user.user_name,
        team_id=user.team_id,
        action=action,
        details=details,
    )
    db.add(entry)


@router.patch("/alerts/{alert_id}/assign", response_model=AlertOut)
async def assign_alert(
    alert_id: uuid.UUID,
    body: AssignBody,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_team(user)
    if not user.is_team_leader:
        raise HTTPException(status_code=403, detail="Only the team leader can assign alerts")

    q = apply_scope(select(Alert), Alert, user).where(Alert.id == alert_id)
    result = await db.execute(q)
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.assigned_to = body.assigned_to
    alert.assigned_name = body.assigned_name

    await _log_activity(db, user, "assigned_alert", f"Assigned alert to {body.assigned_name} ({alert.source_ip} - {alert.category.value})")
    await db.commit()
    await db.refresh(alert)
    return AlertOut.model_validate(alert)


@router.get("/activity")
async def get_team_activity(
    limit: int = Query(50, ge=1, le=200),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_team(user)

    q = (
        select(TeamActivity)
        .where(TeamActivity.team_id == user.team_id)
        .order_by(TeamActivity.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(q)
    entries = result.scalars().all()
    return [
        {
            "id": str(e.id),
            "user_id": e.user_id,
            "user_name": e.user_name,
            "action": e.action,
            "details": e.details,
            "created_at": e.created_at.isoformat() if e.created_at else "",
        }
        for e in entries
    ]


@router.get("/stats")
async def get_team_stats(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_team(user)

    from sqlalchemy import func
    from app.models.alert import Alert

    # Total alerts
    total_q = select(func.count()).where(Alert.team_id == user.team_id)
    total = (await db.execute(total_q)).scalar() or 0

    # Unassigned
    unassigned_q = select(func.count()).where(
        Alert.team_id == user.team_id, Alert.assigned_to.is_(None)
    )
    unassigned = (await db.execute(unassigned_q)).scalar() or 0

    return {
        "total_alerts": total,
        "unassigned": unassigned,
    }
