from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user, CurrentUser
from app.models.alert import Alert, Severity, Category
from app.schemas.alert import AlertOut, AlertListResponse
from app.utils.scoping import apply_scope

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=AlertListResponse)
async def list_alerts(
    severity: Severity | None = Query(None),
    category: Category | None = Query(None),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    assignment: str | None = Query(None),  # "mine", "unassigned", or None for all
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base = apply_scope(select(Alert), Alert, user)

    if severity:
        base = base.where(Alert.severity == severity)
    if category:
        base = base.where(Alert.category == category)
    if start_date:
        base = base.where(Alert.detected_at >= start_date)
    if end_date:
        base = base.where(Alert.detected_at <= end_date)
    if assignment == "mine":
        base = base.where(Alert.assigned_to == user.user_id)
    elif assignment == "unassigned":
        base = base.where(Alert.assigned_to.is_(None))

    count_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    offset = (page - 1) * page_size
    rows = (
        await db.execute(
            base.order_by(Alert.detected_at.desc()).offset(offset).limit(page_size)
        )
    ).scalars().all()

    return AlertListResponse(
        alerts=[AlertOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        page_size=page_size,
    )
