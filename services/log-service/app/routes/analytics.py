from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user, CurrentUser
from app.models.alert import Alert
from app.utils.scoping import apply_scope

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _base_query(user: CurrentUser, severity: str | None, category: str | None,
                start_date: datetime | None, end_date: datetime | None):
    """Build a scoped, filtered base query."""
    base = apply_scope(select(Alert), Alert, user)
    if severity:
        base = base.where(Alert.severity == severity)
    if category:
        base = base.where(Alert.category == category)
    if start_date:
        base = base.where(Alert.detected_at >= start_date)
    if end_date:
        base = base.where(Alert.detected_at <= end_date)
    return base


@router.get("/time-series")
async def time_series(
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    severity: str | None = Query(None),
    category: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not start_date:
        start_date = datetime.now(timezone.utc) - timedelta(hours=24)
    if not end_date:
        end_date = datetime.now(timezone.utc)

    delta = end_date - start_date
    scoped = _base_query(user, severity, category, start_date, end_date).subquery()
    q = (
        select(
            func.date_trunc("hour" if delta.days <= 3 else "day", scoped.c.detected_at).label("bucket"),
            func.count().label("count"),
        )
        .group_by("bucket")
        .order_by("bucket")
    )

    rows = (await db.execute(q)).all()
    return [{"time": r.bucket.isoformat(), "count": r.count} for r in rows]


@router.get("/category-distribution")
async def category_distribution(
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    severity: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    scoped = _base_query(user, severity, None, start_date, end_date).subquery()
    q = (
        select(scoped.c.category.label("category"), func.count().label("count"))
        .group_by(scoped.c.category)
        .order_by(func.count().desc())
    )
    rows = (await db.execute(q)).all()
    return [{"category": r.category, "count": r.count} for r in rows]


@router.get("/top-sources")
async def top_sources(
    limit: int = Query(10, ge=1, le=50),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    severity: str | None = Query(None),
    category: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    scoped = _base_query(user, severity, category, start_date, end_date).subquery()
    q = (
        select(scoped.c.source_ip.label("source_ip"), func.count().label("count"))
        .group_by(scoped.c.source_ip)
        .order_by(func.count().desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).all()
    return [{"source_ip": r.source_ip, "count": r.count} for r in rows]


@router.get("/severity-trends")
async def severity_trends(
    days: int = Query(7, ge=1, le=90),
    category: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    start = datetime.now(timezone.utc) - timedelta(days=days)
    scoped = _base_query(user, None, category, start, None).subquery()

    trunc = "hour" if days <= 3 else "day"
    q = (
        select(
            func.date_trunc(trunc, scoped.c.detected_at).label("bucket"),
            scoped.c.severity.label("severity"),
            func.count().label("count"),
        )
        .group_by("bucket", scoped.c.severity)
        .order_by("bucket")
    )
    rows = (await db.execute(q)).all()

    # Pivot into {time, LOW, MEDIUM, HIGH, CRITICAL}
    buckets: dict[str, dict] = {}
    for r in rows:
        key = r.bucket.isoformat()
        if key not in buckets:
            buckets[key] = {"time": key, "LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
        buckets[key][r.severity] = r.count

    return list(buckets.values())


@router.get("/geo-map")
async def geo_map(
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    severity: str | None = Query(None),
    category: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    scoped = _base_query(user, severity, category, start_date, end_date).subquery()
    q = (
        select(
            scoped.c.geo_latitude.label("latitude"),
            scoped.c.geo_longitude.label("longitude"),
            scoped.c.geo_country.label("country"),
            func.count().label("alert_count"),
            func.avg(scoped.c.threat_score).label("avg_score"),
        )
        .where(scoped.c.geo_latitude.isnot(None))
        .group_by(scoped.c.geo_latitude, scoped.c.geo_longitude, scoped.c.geo_country)
        .order_by(func.count().desc())
    )
    rows = (await db.execute(q)).all()
    return [
        {
            "latitude": float(r.latitude),
            "longitude": float(r.longitude),
            "country": r.country or "Unknown",
            "alert_count": r.alert_count,
            "avg_score": round(float(r.avg_score), 3),
        }
        for r in rows
    ]
