"""Routes for querying and acting on ingestion log entries."""

import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user, CurrentUser
from app.models.alert import Severity, Category, QuarantineStatus
from app.models.ingestion_log import IngestionLog
from app.models.lists import BlacklistEntry, WhitelistEntry
from app.schemas.ingestion_log import IngestionLogOut, IngestionLogListResponse
from app.utils.scoping import apply_scope

router = APIRouter(prefix="/api/ingestion-logs", tags=["ingestion-logs"])


class ReviewAction(BaseModel):
    notes: str | None = None


@router.get("", response_model=IngestionLogListResponse)
async def list_logs(
    severity: Severity | None = Query(None),
    category: Category | None = Query(None),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    batch_id: uuid.UUID | None = Query(None),
    quarantine_status: QuarantineStatus | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base = apply_scope(select(IngestionLog), IngestionLog, user)
    if severity:
        base = base.where(IngestionLog.severity == severity)
    if category:
        base = base.where(IngestionLog.category == category)
    if start_date:
        base = base.where(IngestionLog.detected_at >= start_date)
    if end_date:
        base = base.where(IngestionLog.detected_at <= end_date)
    if batch_id:
        base = base.where(IngestionLog.batch_id == batch_id)
    if quarantine_status:
        base = base.where(IngestionLog.quarantine_status == quarantine_status)

    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    offset = (page - 1) * page_size
    rows = (
        await db.execute(
            base.order_by(IngestionLog.detected_at.desc()).offset(offset).limit(page_size)
        )
    ).scalars().all()

    return IngestionLogListResponse(
        logs=[IngestionLogOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/batches")
async def list_batches(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all upload batches for this user."""
    base = apply_scope(
        select(
            IngestionLog.batch_id,
            IngestionLog.upload_filename,
            IngestionLog.ids_source,
            func.count().label("count"),
            func.min(IngestionLog.created_at).label("uploaded_at"),
        ),
        IngestionLog, user,
    ).group_by(
        IngestionLog.batch_id,
        IngestionLog.upload_filename,
        IngestionLog.ids_source,
    ).order_by(func.min(IngestionLog.created_at).desc())

    result = await db.execute(base)
    return [
        {
            "batch_id": str(row.batch_id),
            "filename": row.upload_filename,
            "ids_source": row.ids_source.value,
            "count": row.count,
            "uploaded_at": row.uploaded_at.isoformat(),
        }
        for row in result.all()
    ]


# ── Actions on individual logs ────────────────────────────────────────

async def _get_log(log_id: uuid.UUID, user: CurrentUser, db: AsyncSession) -> IngestionLog:
    q = apply_scope(select(IngestionLog), IngestionLog, user)
    result = await db.execute(q.where(IngestionLog.id == log_id))
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Ingestion log not found")
    return log


@router.post("/{log_id}/block", response_model=IngestionLogOut)
async def block_log(
    log_id: uuid.UUID = Path(...),
    body: ReviewAction = ReviewAction(),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    log = await _get_log(log_id, user, db)
    log.is_blocked = True
    log.threat_score = 1.0
    log.reviewed_by = str(user.user_id)
    log.review_notes = body.notes
    if log.quarantine_status == QuarantineStatus.QUARANTINED:
        log.quarantine_status = QuarantineStatus.BLOCKED

    # Add source IP to blacklist
    check_q = apply_scope(select(BlacklistEntry), BlacklistEntry, user)
    existing = await db.execute(check_q.where(BlacklistEntry.value == log.source_ip))
    if not existing.scalar_one_or_none():
        db.add(BlacklistEntry(
            entry_type="IP",
            value=log.source_ip,
            reason=f"Blocked from ingestion log: {log.category.value}",
            added_by="ingestion",
            user_id=user.user_id,
            team_id=user.team_id,
        ))

    await db.commit()
    await db.refresh(log)
    return IngestionLogOut.model_validate(log)


@router.post("/{log_id}/trust", response_model=IngestionLogOut)
async def trust_log(
    log_id: uuid.UUID = Path(...),
    body: ReviewAction = ReviewAction(),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    log = await _get_log(log_id, user, db)
    log.is_whitelisted = True
    log.threat_score = 0.0
    log.reviewed_by = str(user.user_id)
    log.review_notes = body.notes
    if log.quarantine_status == QuarantineStatus.QUARANTINED:
        log.quarantine_status = QuarantineStatus.RELEASED

    # Add source IP to whitelist
    check_q = apply_scope(select(WhitelistEntry), WhitelistEntry, user)
    existing = await db.execute(check_q.where(WhitelistEntry.value == log.source_ip))
    if not existing.scalar_one_or_none():
        db.add(WhitelistEntry(
            entry_type="IP",
            value=log.source_ip,
            reason=f"Trusted from ingestion log",
            added_by="ingestion",
            user_id=user.user_id,
            team_id=user.team_id,
        ))

    await db.commit()
    await db.refresh(log)
    return IngestionLogOut.model_validate(log)


@router.post("/{log_id}/release", response_model=IngestionLogOut)
async def release_log(
    log_id: uuid.UUID = Path(...),
    body: ReviewAction = ReviewAction(),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    log = await _get_log(log_id, user, db)
    if log.quarantine_status != QuarantineStatus.QUARANTINED:
        raise HTTPException(status_code=400, detail="Log is not quarantined")
    log.quarantine_status = QuarantineStatus.RELEASED
    log.reviewed_by = str(user.user_id)
    log.review_notes = body.notes
    await db.commit()
    await db.refresh(log)
    return IngestionLogOut.model_validate(log)
