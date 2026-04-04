import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user, CurrentUser
from sqlalchemy import update

from app.models.alert import Alert
from app.models.lists import BlacklistEntry, WhitelistEntry
from app.schemas.lists import ListEntryCreate, BulkImport, WhitelistOut
from app.utils.scoping import apply_scope

router = APIRouter(prefix="/api/whitelist", tags=["whitelist"])


@router.get("", response_model=list[WhitelistOut])
async def list_whitelist(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = apply_scope(select(WhitelistEntry), WhitelistEntry, user)
    result = await db.execute(q.order_by(WhitelistEntry.created_at.desc()))
    return [WhitelistOut.model_validate(r) for r in result.scalars().all()]


@router.post("", response_model=WhitelistOut)
async def add_to_whitelist(
    body: ListEntryCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = apply_scope(select(WhitelistEntry), WhitelistEntry, user)
    existing = await db.execute(q.where(WhitelistEntry.value == body.value))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Entry already exists in whitelist")

    # Remove from blacklist if present
    bl_q = apply_scope(select(BlacklistEntry), BlacklistEntry, user)
    bl_result = await db.execute(bl_q.where(BlacklistEntry.value == body.value))
    bl_entry = bl_result.scalar_one_or_none()
    if bl_entry:
        await db.delete(bl_entry)

    entry = WhitelistEntry(
        entry_type=body.entry_type,
        value=body.value,
        reason=body.reason,
        added_by="manual",
        user_id=user.user_id,
        team_id=user.team_id,
    )
    db.add(entry)

    # Update existing alerts from this IP
    alert_q = update(Alert).where(Alert.source_ip == body.value).values(is_whitelisted=True, is_blocked=False, threat_score=0.0)
    if user.tier == "EXCLUSIVE" and user.team_id:
        alert_q = alert_q.where(Alert.team_id == user.team_id)
    else:
        alert_q = alert_q.where(Alert.user_id == user.user_id)
    await db.execute(alert_q)

    await db.commit()
    await db.refresh(entry)
    return WhitelistOut.model_validate(entry)


@router.post("/bulk", response_model=dict)
async def bulk_import_whitelist(
    body: BulkImport,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = apply_scope(select(WhitelistEntry.value), WhitelistEntry, user)
    existing_result = await db.execute(q)
    existing_values = {r for r in existing_result.scalars().all()}

    added = 0
    for item in body.entries:
        if item.value not in existing_values:
            entry = WhitelistEntry(
                entry_type=item.entry_type,
                value=item.value,
                reason=item.reason,
                added_by="bulk_import",
                user_id=user.user_id,
                team_id=user.team_id,
            )
            db.add(entry)
            existing_values.add(item.value)
            added += 1

    await db.commit()
    return {"added": added, "skipped": len(body.entries) - added}


@router.delete("/{entry_id}")
async def remove_from_whitelist(
    entry_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = apply_scope(select(WhitelistEntry), WhitelistEntry, user)
    result = await db.execute(q.where(WhitelistEntry.id == entry_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    await db.delete(entry)
    await db.commit()
    return {"deleted": True}
