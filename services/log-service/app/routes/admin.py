from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import require_admin, CurrentUser
from app.models.alert import Alert
from app.models.activity import TeamActivity

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/system-health")
async def system_health(
    user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    db_ok = False
    try:
        await db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(
        select(func.count(Alert.id)).where(Alert.created_at >= today_start)
    )
    alerts_today = result.scalar() or 0

    result = await db.execute(select(func.count(Alert.id)))
    total_alerts = result.scalar() or 0

    return {
        'database': {'status': 'connected' if db_ok else 'disconnected', 'ok': db_ok},
        'fastapi': {'status': 'running', 'ok': True},
        'alerts_today': alerts_today,
        'total_alerts': total_alerts,
    }


@router.get("/alert-stats")
async def alert_stats(
    user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)

    result = await db.execute(select(func.count(Alert.id)))
    total = result.scalar() or 0

    result = await db.execute(
        select(func.count(Alert.id)).where(Alert.created_at >= today_start)
    )
    today = result.scalar() or 0

    result = await db.execute(
        select(func.count(Alert.id)).where(Alert.created_at >= week_ago)
    )
    this_week = result.scalar() or 0

    result = await db.execute(
        select(func.count(Alert.id)).where(Alert.is_blocked == True)
    )
    blocked = result.scalar() or 0

    result = await db.execute(
        select(func.count(Alert.id)).where(Alert.quarantine_status == 'pending')
    )
    quarantined = result.scalar() or 0

    return {
        'total_alerts': total,
        'alerts_today': today,
        'alerts_this_week': this_week,
        'blocked_alerts': blocked,
        'quarantined_alerts': quarantined,
    }


@router.get("/activity-log")
async def activity_log(
    user: CurrentUser = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
):
    result = await db.execute(
        select(TeamActivity)
        .order_by(TeamActivity.created_at.desc())
        .limit(limit)
    )
    activities = result.scalars().all()

    return [
        {
            'id': str(a.id),
            'user_id': a.user_id,
            'user_name': a.user_name,
            'team_id': str(a.team_id) if a.team_id else None,
            'action': a.action,
            'details': a.details,
            'timestamp': a.created_at.isoformat() if a.created_at else None,
        }
        for a in activities
    ]
