import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user, CurrentUser
from app.models.alert import Alert
from app.models.incident import (
    Incident,
    IncidentAlert,
    IncidentNote,
    IncidentStatus,
    IncidentPriority,
)
from app.schemas.incident import (
    IncidentCreate,
    IncidentUpdate,
    IncidentOut,
    IncidentListResponse,
    NoteCreate,
    NoteOut,
    LinkAlertRequest,
)
from app.schemas.alert import AlertOut
from app.utils.scoping import apply_scope

router = APIRouter(prefix="/api/incidents", tags=["incidents"])

_PREMIUM_TIERS = {"PREMIUM", "EXCLUSIVE"}


def _require_premium(user: CurrentUser):
    if (user.tier or "free").upper() not in _PREMIUM_TIERS:
        raise HTTPException(status_code=403, detail="Incident management requires a Premium or Exclusive plan")


# ── helpers ──────────────────────────────────────────────────────────────

async def _get_incident_or_404(
    incident_id: uuid.UUID,
    user: CurrentUser,
    db: AsyncSession,
) -> Incident:
    query = apply_scope(
        select(Incident).where(Incident.id == incident_id), Incident, user
    )
    result = await db.execute(query)
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return incident


async def _alert_count(incident_id: uuid.UUID, db: AsyncSession) -> int:
    q = select(func.count()).select_from(IncidentAlert).where(
        IncidentAlert.incident_id == incident_id
    )
    return (await db.execute(q)).scalar() or 0


async def _notes_for(incident_id: uuid.UUID, db: AsyncSession) -> list[IncidentNote]:
    q = (
        select(IncidentNote)
        .where(IncidentNote.incident_id == incident_id)
        .order_by(IncidentNote.created_at.asc())
    )
    return list((await db.execute(q)).scalars().all())


def _incident_to_out(
    incident: Incident, alert_count: int, notes: list[IncidentNote]
) -> IncidentOut:
    data = {
        "id": incident.id,
        "title": incident.title,
        "description": incident.description,
        "status": incident.status,
        "priority": incident.priority,
        "created_by_id": incident.created_by_id,
        "created_by_name": incident.created_by_name,
        "user_id": incident.user_id,
        "team_id": incident.team_id,
        "created_at": incident.created_at,
        "updated_at": incident.updated_at,
        "alert_count": alert_count,
        "notes": [NoteOut.model_validate(n) for n in notes],
    }
    return IncidentOut(**data)


# ── CRUD routes ──────────────────────────────────────────────────────────

@router.post("", response_model=IncidentOut, status_code=status.HTTP_201_CREATED)
async def create_incident(
    body: IncidentCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_premium(user)
    incident = Incident(
        title=body.title,
        description=body.description,
        priority=body.priority,
        created_by_id=user.user_id,
        created_by_name=user.user_name or None,
        user_id=user.user_id,
        team_id=uuid.UUID(user.team_id) if user.team_id else None,
    )
    db.add(incident)
    await db.commit()
    await db.refresh(incident)
    return _incident_to_out(incident, alert_count=0, notes=[])


@router.get("", response_model=IncidentListResponse)
async def list_incidents(
    status_filter: IncidentStatus | None = Query(None, alias="status"),
    priority: IncidentPriority | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_premium(user)
    base = apply_scope(select(Incident), Incident, user)

    if status_filter:
        base = base.where(Incident.status == status_filter)
    if priority:
        base = base.where(Incident.priority == priority)

    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    offset = (page - 1) * page_size
    rows = (
        await db.execute(
            base.order_by(Incident.created_at.desc()).offset(offset).limit(page_size)
        )
    ).scalars().all()

    incidents_out = []
    for inc in rows:
        ac = await _alert_count(inc.id, db)
        notes = await _notes_for(inc.id, db)
        incidents_out.append(_incident_to_out(inc, ac, notes))

    return IncidentListResponse(
        incidents=incidents_out,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{incident_id}", response_model=IncidentOut)
async def get_incident(
    incident_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_premium(user)
    incident = await _get_incident_or_404(incident_id, user, db)
    ac = await _alert_count(incident.id, db)
    notes = await _notes_for(incident.id, db)
    return _incident_to_out(incident, ac, notes)


@router.patch("/{incident_id}", response_model=IncidentOut)
async def update_incident(
    incident_id: uuid.UUID,
    body: IncidentUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_premium(user)
    incident = await _get_incident_or_404(incident_id, user, db)

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(incident, field, value)

    incident.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(incident)

    ac = await _alert_count(incident.id, db)
    notes = await _notes_for(incident.id, db)
    return _incident_to_out(incident, ac, notes)


@router.delete("/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_incident(
    incident_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_premium(user)
    incident = await _get_incident_or_404(incident_id, user, db)
    await db.delete(incident)
    await db.commit()


# ── Notes ────────────────────────────────────────────────────────────────

@router.post("/{incident_id}/notes", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
async def add_note(
    incident_id: uuid.UUID,
    body: NoteCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_premium(user)
    await _get_incident_or_404(incident_id, user, db)

    note = IncidentNote(
        incident_id=incident_id,
        content=body.content,
        author_id=user.user_id,
        author_name=user.user_name or None,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return NoteOut.model_validate(note)


# ── Linked alerts ────────────────────────────────────────────────────────

@router.post("/{incident_id}/link-alert", status_code=status.HTTP_201_CREATED)
async def link_alert(
    incident_id: uuid.UUID,
    body: LinkAlertRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_premium(user)
    await _get_incident_or_404(incident_id, user, db)

    # Verify alert exists and belongs to user's scope
    alert_q = apply_scope(
        select(Alert).where(Alert.id == body.alert_id), Alert, user
    )
    alert = (await db.execute(alert_q)).scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")

    # Check if already linked
    existing = await db.execute(
        select(IncidentAlert).where(
            IncidentAlert.incident_id == incident_id,
            IncidentAlert.alert_id == body.alert_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Alert already linked")

    link = IncidentAlert(incident_id=incident_id, alert_id=body.alert_id)
    db.add(link)
    await db.commit()
    return {"detail": "Alert linked"}


@router.delete(
    "/{incident_id}/unlink-alert/{alert_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def unlink_alert(
    incident_id: uuid.UUID,
    alert_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_premium(user)
    await _get_incident_or_404(incident_id, user, db)

    result = await db.execute(
        delete(IncidentAlert).where(
            IncidentAlert.incident_id == incident_id,
            IncidentAlert.alert_id == alert_id,
        )
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")
    await db.commit()


@router.get("/{incident_id}/alerts", response_model=list[AlertOut])
async def list_linked_alerts(
    incident_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_premium(user)
    await _get_incident_or_404(incident_id, user, db)

    q = (
        select(Alert)
        .join(IncidentAlert, IncidentAlert.alert_id == Alert.id)
        .where(IncidentAlert.incident_id == incident_id)
        .order_by(Alert.detected_at.desc())
    )
    rows = (await db.execute(q)).scalars().all()
    return [AlertOut.model_validate(r) for r in rows]
