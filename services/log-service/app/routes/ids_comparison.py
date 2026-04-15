"""IDS Cross-Comparison analytics — compare detection across Suricata, Zeek, Snort, and Kismet."""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, case, literal_column
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import array_agg

from app.database import get_db
from app.auth import get_current_user, CurrentUser
from app.models.alert import Alert, IDSSource
from app.utils.scoping import apply_scope

router = APIRouter(prefix="/api/ids-comparison", tags=["ids-comparison"])

ALL_IDS = [s.value for s in IDSSource]


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


# ── 1. Summary: per-IDS totals, avg score, severity & category breakdown ──

@router.get("/summary")
async def ids_summary(
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    severity: str | None = Query(None),
    category: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    scoped = _base_query(user, severity, category, start_date, end_date).subquery()

    # Per-IDS totals and avg score
    totals_q = (
        select(
            scoped.c.ids_source.label("ids_source"),
            func.count().label("total"),
            func.avg(scoped.c.threat_score).label("avg_score"),
        )
        .group_by(scoped.c.ids_source)
    )
    totals = (await db.execute(totals_q)).all()

    # Per-IDS severity breakdown
    sev_q = (
        select(
            scoped.c.ids_source.label("ids_source"),
            scoped.c.severity.label("severity"),
            func.count().label("count"),
        )
        .group_by(scoped.c.ids_source, scoped.c.severity)
    )
    sev_rows = (await db.execute(sev_q)).all()

    # Per-IDS category breakdown
    cat_q = (
        select(
            scoped.c.ids_source.label("ids_source"),
            scoped.c.category.label("category"),
            func.count().label("count"),
        )
        .group_by(scoped.c.ids_source, scoped.c.category)
    )
    cat_rows = (await db.execute(cat_q)).all()

    # Build response
    result = {}
    for r in totals:
        result[r.ids_source] = {
            "ids_source": r.ids_source,
            "total": r.total,
            "avg_score": round(float(r.avg_score or 0), 3),
            "severities": {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0},
            "categories": {},
        }
    for r in sev_rows:
        if r.ids_source in result:
            result[r.ids_source]["severities"][r.severity] = r.count
    for r in cat_rows:
        if r.ids_source in result:
            result[r.ids_source]["categories"][r.category] = r.count

    return list(result.values())


# ── 2. Detection Overlap: same (src_ip, dst_ip) seen by multiple IDS ──

@router.get("/detection-overlap")
async def detection_overlap(
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    severity: str | None = Query(None),
    category: str | None = Query(None),
    time_window_minutes: int = Query(5, ge=1, le=60),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not start_date:
        start_date = datetime.now(timezone.utc) - timedelta(days=7)

    scoped = _base_query(user, severity, category, start_date, end_date).subquery()

    # Bucket alerts by (source_ip, dest_ip, time_bucket) and collect distinct IDS sources
    bucket_unit = f"{time_window_minutes} minutes"
    time_bucket = func.date_trunc(literal_column(f"'{bucket_unit}'"), scoped.c.detected_at)

    grouped = (
        select(
            scoped.c.source_ip.label("source_ip"),
            scoped.c.destination_ip.label("destination_ip"),
            time_bucket.label("time_bucket"),
            func.array_agg(func.distinct(scoped.c.ids_source)).label("ids_sources"),
            func.count(func.distinct(scoped.c.ids_source)).label("ids_count"),
            func.count().label("alert_count"),
        )
        .group_by(scoped.c.source_ip, scoped.c.destination_ip, time_bucket)
    ).subquery()

    # Get overlap events (detected by 2+ IDS)
    overlap_q = (
        select(grouped)
        .where(grouped.c.ids_count >= 2)
        .order_by(grouped.c.alert_count.desc())
        .limit(50)
    )
    overlap_rows = (await db.execute(overlap_q)).all()

    # Get unique-per-IDS counts
    unique_q = (
        select(grouped)
        .where(grouped.c.ids_count == 1)
    )
    unique_rows = (await db.execute(unique_q)).all()

    unique_counts = {}
    for ids in ALL_IDS:
        unique_counts[ids] = 0
    for r in unique_rows:
        sources = r.ids_sources
        if sources and len(sources) == 1:
            unique_counts[sources[0]] = unique_counts.get(sources[0], 0) + 1

    # Count total events and overlap events
    total_q = select(func.count()).select_from(grouped)
    total_events = (await db.execute(total_q)).scalar() or 0

    overlap_count = len(overlap_rows)

    # Build pairwise overlap matrix
    pair_matrix = {}
    for ids_a in ALL_IDS:
        pair_matrix[ids_a] = {}
        for ids_b in ALL_IDS:
            pair_matrix[ids_a][ids_b] = 0

    for r in overlap_rows:
        sources = r.ids_sources or []
        for i, a in enumerate(sources):
            for b in sources[i + 1:]:
                pair_matrix[a][b] += 1
                pair_matrix[b][a] += 1

    return {
        "overlaps": [
            {
                "source_ip": r.source_ip,
                "destination_ip": r.destination_ip,
                "time_bucket": r.time_bucket.isoformat() if r.time_bucket else None,
                "ids_sources": r.ids_sources,
                "alert_count": r.alert_count,
            }
            for r in overlap_rows
        ],
        "unique_detections": unique_counts,
        "overlap_count": overlap_count,
        "total_events": total_events,
        "pair_matrix": pair_matrix,
    }


# ── 3. Accuracy Matrix: per-IDS quality metrics ──

@router.get("/accuracy-matrix")
async def accuracy_matrix(
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
            scoped.c.ids_source.label("ids_source"),
            func.count().label("total"),
            func.avg(scoped.c.threat_score).label("avg_threat_score"),
            func.avg(scoped.c.ml_confidence).label("avg_ml_confidence"),
            func.sum(case(
                (scoped.c.severity.in_(["HIGH", "CRITICAL"]), 1),
                else_=0,
            )).label("high_critical_count"),
            func.sum(case(
                (scoped.c.is_whitelisted == True, 1),
                else_=0,
            )).label("whitelisted_count"),
            func.sum(case(
                (scoped.c.is_blocked == True, 1),
                else_=0,
            )).label("blocked_count"),
            func.sum(case(
                (scoped.c.quarantine_status == "QUARANTINED", 1),
                else_=0,
            )).label("quarantined_count"),
        )
        .group_by(scoped.c.ids_source)
    )
    rows = (await db.execute(q)).all()

    return [
        {
            "ids_source": r.ids_source,
            "total": r.total,
            "avg_threat_score": round(float(r.avg_threat_score or 0), 3),
            "avg_ml_confidence": round(float(r.avg_ml_confidence or 0), 3),
            "high_critical_ratio": round(int(r.high_critical_count or 0) / max(r.total, 1), 3),
            "whitelist_ratio": round(int(r.whitelisted_count or 0) / max(r.total, 1), 3),
            "blocked_count": int(r.blocked_count or 0),
            "quarantined_count": int(r.quarantined_count or 0),
        }
        for r in rows
    ]


# ── 4. Timeline: alerts over time broken down by IDS source ──

@router.get("/timeline")
async def ids_timeline(
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    severity: str | None = Query(None),
    category: str | None = Query(None),
    days: int = Query(7, ge=1, le=90),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not start_date:
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
    if not end_date:
        end_date = datetime.now(timezone.utc)

    delta = end_date - start_date
    trunc = "hour" if delta.days <= 3 else "day"

    scoped = _base_query(user, severity, category, start_date, end_date).subquery()
    q = (
        select(
            func.date_trunc(trunc, scoped.c.detected_at).label("bucket"),
            scoped.c.ids_source.label("ids_source"),
            func.count().label("count"),
        )
        .group_by("bucket", scoped.c.ids_source)
        .order_by("bucket")
    )
    rows = (await db.execute(q)).all()

    # Pivot: {time, suricata, zeek, snort, kismet}
    buckets: dict[str, dict] = {}
    for r in rows:
        key = r.bucket.isoformat()
        if key not in buckets:
            buckets[key] = {"time": key}
            for ids in ALL_IDS:
                buckets[key][ids] = 0
        buckets[key][r.ids_source] = r.count

    return list(buckets.values())


# ── 5. Category by IDS: which categories each IDS detects ──

@router.get("/category-by-ids")
async def category_by_ids(
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    severity: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    scoped = _base_query(user, severity, None, start_date, end_date).subquery()
    q = (
        select(
            scoped.c.category.label("category"),
            scoped.c.ids_source.label("ids_source"),
            func.count().label("count"),
        )
        .group_by(scoped.c.category, scoped.c.ids_source)
        .order_by(scoped.c.category)
    )
    rows = (await db.execute(q)).all()

    # Pivot: {category, suricata, zeek, snort, kismet}
    categories: dict[str, dict] = {}
    for r in rows:
        if r.category not in categories:
            categories[r.category] = {"category": r.category}
            for ids in ALL_IDS:
                categories[r.category][ids] = 0
        categories[r.category][r.ids_source] = r.count

    return list(categories.values())
