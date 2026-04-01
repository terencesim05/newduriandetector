import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user, CurrentUser
from app.models.alert import Alert, QuarantineStatus
from app.models.lists import BlacklistEntry
from app.schemas.alert import AlertOut
from app.utils.scoping import apply_scope

router = APIRouter(prefix="/api/quarantine", tags=["quarantine"])


class ReviewAction(BaseModel):
    notes: str | None = None


@router.get("", response_model=list[AlertOut])
async def list_quarantined(
    status: QuarantineStatus | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = apply_scope(select(Alert), Alert, user)
    if status:
        q = q.where(Alert.quarantine_status == status)
    else:
        q = q.where(Alert.quarantine_status != QuarantineStatus.NONE)
    q = q.order_by(Alert.quarantined_at.desc())
    result = await db.execute(q)
    return [AlertOut.model_validate(r) for r in result.scalars().all()]


@router.get("/stats")
async def quarantine_stats(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base_q = apply_scope(select(Alert.quarantine_status, func.count()), Alert, user)
    base_q = base_q.where(Alert.quarantine_status != QuarantineStatus.NONE)
    base_q = base_q.group_by(Alert.quarantine_status)
    result = await db.execute(base_q)
    counts = {row[0].value: row[1] for row in result.all()}
    return {
        "pending": counts.get("QUARANTINED", 0),
        "released": counts.get("RELEASED", 0),
        "blocked": counts.get("BLOCKED", 0),
        "total": sum(counts.values()),
    }


@router.post("/{alert_id}/release", response_model=AlertOut)
async def release_alert(
    alert_id: uuid.UUID,
    body: ReviewAction = ReviewAction(),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    alert = await _get_quarantined_alert(alert_id, user, db)
    alert.quarantine_status = QuarantineStatus.RELEASED
    alert.reviewed_by = str(user.user_id)
    alert.review_notes = body.notes
    await db.commit()
    await db.refresh(alert)
    return AlertOut.model_validate(alert)


@router.post("/{alert_id}/block", response_model=AlertOut)
async def block_alert(
    alert_id: uuid.UUID,
    body: ReviewAction = ReviewAction(),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    alert = await _get_quarantined_alert(alert_id, user, db)
    alert.quarantine_status = QuarantineStatus.BLOCKED
    alert.is_blocked = True
    alert.threat_score = 1.0
    alert.reviewed_by = str(user.user_id)
    alert.review_notes = body.notes

    # Auto-add source IP to blacklist (scoped)
    check_q = apply_scope(select(BlacklistEntry), BlacklistEntry, user)
    existing = await db.execute(check_q.where(BlacklistEntry.value == alert.source_ip))
    if not existing.scalar_one_or_none():
        bl = BlacklistEntry(
            entry_type="IP",
            value=alert.source_ip,
            reason=f"Blocked from quarantine: {alert.category.value}",
            added_by="quarantine",
            user_id=user.user_id,
            team_id=user.team_id,
        )
        db.add(bl)

    await db.commit()
    await db.refresh(alert)
    return AlertOut.model_validate(alert)


@router.delete("/{alert_id}")
async def remove_from_quarantine(
    alert_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    alert = await _get_quarantined_alert(alert_id, user, db)
    alert.quarantine_status = QuarantineStatus.NONE
    alert.quarantined_at = None
    await db.commit()
    return {"removed": True}


async def _get_quarantined_alert(alert_id: uuid.UUID, user: CurrentUser, db: AsyncSession) -> Alert:
    q = apply_scope(select(Alert), Alert, user)
    result = await db.execute(q.where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if alert.quarantine_status == QuarantineStatus.NONE:
        raise HTTPException(status_code=400, detail="Alert is not quarantined")
    return alert
