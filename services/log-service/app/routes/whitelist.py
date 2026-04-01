import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user
from app.models.lists import WhitelistEntry
from app.schemas.lists import ListEntryCreate, BulkImport, WhitelistOut

router = APIRouter(prefix="/api/whitelist", tags=["whitelist"])


@router.get("", response_model=list[WhitelistOut])
async def list_whitelist(
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WhitelistEntry)
        .where(WhitelistEntry.user_id == user_id)
        .order_by(WhitelistEntry.created_at.desc())
    )
    return [WhitelistOut.model_validate(r) for r in result.scalars().all()]


@router.post("", response_model=WhitelistOut)
async def add_to_whitelist(
    body: ListEntryCreate,
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(WhitelistEntry).where(
            WhitelistEntry.user_id == user_id,
            WhitelistEntry.value == body.value,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Entry already exists in whitelist")

    entry = WhitelistEntry(
        entry_type=body.entry_type,
        value=body.value,
        reason=body.reason,
        added_by="manual",
        user_id=user_id,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return WhitelistOut.model_validate(entry)


@router.post("/bulk", response_model=dict)
async def bulk_import_whitelist(
    body: BulkImport,
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing_result = await db.execute(
        select(WhitelistEntry.value).where(WhitelistEntry.user_id == user_id)
    )
    existing_values = {r for r in existing_result.scalars().all()}

    added = 0
    for item in body.entries:
        if item.value not in existing_values:
            entry = WhitelistEntry(
                entry_type=item.entry_type,
                value=item.value,
                reason=item.reason,
                added_by="bulk_import",
                user_id=user_id,
            )
            db.add(entry)
            existing_values.add(item.value)
            added += 1

    await db.commit()
    return {"added": added, "skipped": len(body.entries) - added}


@router.delete("/{entry_id}")
async def remove_from_whitelist(
    entry_id: uuid.UUID,
    user_id: int = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WhitelistEntry).where(
            WhitelistEntry.id == entry_id,
            WhitelistEntry.user_id == user_id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    await db.delete(entry)
    await db.commit()
    return {"deleted": True}
