import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user
from app.models.alert import Alert, QuarantineStatus
from app.models.lists import BlacklistEntry, WhitelistEntry
from app.schemas.alert import AlertOut

router = APIRouter(prefix="/api/quarantine", tags=["quarantine"])


class ReviewAction(BaseModel):
    notes: str | None = None


@router.get("", response_model=list[AlertOut])
async def list_quarantined(
    status: QuarantineStatus | None = Query(None),
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Alert).where(Alert.user_id == user_id)
    if status:
        q = q.where(Alert.quarantine_status == status)
    else:
        q = q.where(Alert.quarantine_status != QuarantineStatus.NONE)
    q = q.order_by(Alert.quarantined_at.desc())
    result = await db.execute(q)
    return [AlertOut.model_validate(r) for r in result.scalars().all()]


@router.get("/stats")
async def quarantine_stats(
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base = select(Alert.quarantine_status, func.count()).where(
        Alert.user_id == user_id,
        Alert.quarantine_status != QuarantineStatus.NONE,
    ).group_by(Alert.quarantine_status)
    result = await db.execute(base)
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
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    alert = await _get_quarantined_alert(alert_id, user_id, db)
    alert.quarantine_status = QuarantineStatus.RELEASED
    alert.reviewed_by = str(user_id)
    alert.review_notes = body.notes
    await db.commit()
    await db.refresh(alert)
    return AlertOut.model_validate(alert)


@router.post("/{alert_id}/block", response_model=AlertOut)
async def block_alert(
    alert_id: uuid.UUID,
    body: ReviewAction = ReviewAction(),
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    alert = await _get_quarantined_alert(alert_id, user_id, db)
    alert.quarantine_status = QuarantineStatus.BLOCKED
    alert.is_blocked = True
    alert.threat_score = 1.0
    alert.reviewed_by = str(user_id)
    alert.review_notes = body.notes

    # Auto-add source IP to blacklist
    existing = await db.execute(
        select(BlacklistEntry).where(
            BlacklistEntry.user_id == user_id,
            BlacklistEntry.value == alert.source_ip,
        )
    )
    if not existing.scalar_one_or_none():
        bl = BlacklistEntry(
            entry_type="IP",
            value=alert.source_ip,
            reason=f"Blocked from quarantine: {alert.category.value}",
            added_by="quarantine",
            user_id=user_id,
        )
        db.add(bl)

    await db.commit()
    await db.refresh(alert)
    return AlertOut.model_validate(alert)


@router.delete("/{alert_id}")
async def remove_from_quarantine(
    alert_id: uuid.UUID,
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    alert = await _get_quarantined_alert(alert_id, user_id, db)
    alert.quarantine_status = QuarantineStatus.NONE
    alert.quarantined_at = None
    await db.commit()
    return {"removed": True}


async def _get_quarantined_alert(alert_id: uuid.UUID, user_id: int, db: AsyncSession) -> Alert:
    result = await db.execute(
        select(Alert).where(Alert.id == alert_id, Alert.user_id == user_id)
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if alert.quarantine_status == QuarantineStatus.NONE:
        raise HTTPException(status_code=400, detail="Alert is not quarantined")
    return alert
