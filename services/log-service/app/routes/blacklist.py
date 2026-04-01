import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user, CurrentUser
from app.models.lists import BlacklistEntry
from app.schemas.lists import ListEntryCreate, BulkImport, BlacklistOut
from app.utils.scoping import apply_scope

router = APIRouter(prefix="/api/blacklist", tags=["blacklist"])


@router.get("", response_model=list[BlacklistOut])
async def list_blacklist(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = apply_scope(select(BlacklistEntry), BlacklistEntry, user)
    result = await db.execute(q.order_by(BlacklistEntry.created_at.desc()))
    return [BlacklistOut.model_validate(r) for r in result.scalars().all()]


@router.post("", response_model=BlacklistOut)
async def add_to_blacklist(
    body: ListEntryCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = apply_scope(select(BlacklistEntry), BlacklistEntry, user)
    existing = await db.execute(q.where(BlacklistEntry.value == body.value))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Entry already exists in blacklist")

    entry = BlacklistEntry(
        entry_type=body.entry_type,
        value=body.value,
        reason=body.reason,
        added_by="manual",
        user_id=user.user_id,
        team_id=user.team_id,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return BlacklistOut.model_validate(entry)


@router.post("/bulk", response_model=dict)
async def bulk_import_blacklist(
    body: BulkImport,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = apply_scope(select(BlacklistEntry.value), BlacklistEntry, user)
    existing_result = await db.execute(q)
    existing_values = {r for r in existing_result.scalars().all()}

    added = 0
    for item in body.entries:
        if item.value not in existing_values:
            entry = BlacklistEntry(
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
async def remove_from_blacklist(
    entry_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = apply_scope(select(BlacklistEntry), BlacklistEntry, user)
    result = await db.execute(q.where(BlacklistEntry.id == entry_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    await db.delete(entry)
    await db.commit()
    return {"deleted": True}
