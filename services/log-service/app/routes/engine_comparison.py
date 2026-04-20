"""Cross-IDS engine comparison analytics.

Aggregations over Alert.ids_source so users can see per-engine stats, which
source_ips multiple engines agree on, pairwise overlap, and what each engine
catches alone.
"""

import re
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, case, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user, CurrentUser
from app.models.alert import Alert, IDSSource, Severity
from app.utils.scoping import apply_scope

router = APIRouter(prefix="/api/analytics", tags=["engine-comparison"])

_WINDOW_RE = re.compile(r"^(\d+)([mhd])$")
_UNIT = {"m": "minutes", "h": "hours", "d": "days"}

ENGINES = [e.value for e in IDSSource]  # ["suricata", "zeek", "snort", "kismet"]

# Numeric rank so we can MAX() severity across grouped rows.
_SEVERITY_RANK = case(
    (Alert.severity == Severity.CRITICAL, 4),
    (Alert.severity == Severity.HIGH, 3),
    (Alert.severity == Severity.MEDIUM, 2),
    (Alert.severity == Severity.LOW, 1),
    else_=0,
)
_RANK_TO_SEVERITY = {4: "CRITICAL", 3: "HIGH", 2: "MEDIUM", 1: "LOW", 0: None}


def _parse_window(window: str) -> datetime:
    """Parse '5m' / '1h' / '24h' / '7d' → an absolute start datetime (UTC)."""
    m = _WINDOW_RE.match(window.strip().lower())
    if not m:
        raise HTTPException(
            status_code=400,
            detail="Invalid window. Use formats like '5m', '1h', '24h', '7d'.",
        )
    value, unit = int(m.group(1)), m.group(2)
    delta = timedelta(**{_UNIT[unit]: value})
    return datetime.now(timezone.utc) - delta


def _scoped_recent(user: CurrentUser, start: datetime):
    return apply_scope(select(Alert), Alert, user).where(Alert.detected_at >= start)


@router.get("/engine-stats")
async def engine_stats(
    window: str = Query("1h"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Per-engine summary: alert volume, unique IPs, avg score, severity mix."""
    start = _parse_window(window)
    scoped = _scoped_recent(user, start).subquery()

    q = (
        select(
            scoped.c.ids_source.label("ids_source"),
            func.count().label("alert_count"),
            func.count(distinct(scoped.c.source_ip)).label("unique_ips"),
            func.avg(scoped.c.threat_score).label("avg_score"),
            func.count().filter(scoped.c.severity == Severity.LOW).label("low"),
            func.count().filter(scoped.c.severity == Severity.MEDIUM).label("medium"),
            func.count().filter(scoped.c.severity == Severity.HIGH).label("high"),
            func.count().filter(scoped.c.severity == Severity.CRITICAL).label("critical"),
        )
        .group_by(scoped.c.ids_source)
    )
    rows = (await db.execute(q)).all()

    by_engine = {
        (r.ids_source.value if hasattr(r.ids_source, "value") else r.ids_source): {
            "alert_count": r.alert_count,
            "unique_ips": r.unique_ips,
            "avg_score": round(float(r.avg_score or 0.0), 3),
            "severity": {
                "LOW": r.low, "MEDIUM": r.medium, "HIGH": r.high, "CRITICAL": r.critical,
            },
        }
        for r in rows
    }

    # Zero-fill engines with no alerts so the UI always renders 4 cards.
    return {
        "window": window,
        "engines": [
            {
                "ids_source": eng,
                **by_engine.get(eng, {
                    "alert_count": 0,
                    "unique_ips": 0,
                    "avg_score": 0.0,
                    "severity": {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0},
                }),
            }
            for eng in ENGINES
        ],
    }


@router.get("/engine-consensus")
async def engine_consensus(
    window: str = Query("1h"),
    min_engines: int = Query(2, ge=2, le=4),
    limit: int = Query(100, ge=1, le=500),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Source IPs flagged by ≥ min_engines distinct engines in the window."""
    start = _parse_window(window)
    scoped = _scoped_recent(user, start).subquery()

    engine_count = func.count(distinct(scoped.c.ids_source))

    q = (
        select(
            scoped.c.source_ip.label("source_ip"),
            func.array_agg(distinct(scoped.c.ids_source)).label("engines"),
            engine_count.label("engine_count"),
            func.count().label("alert_count"),
            func.max(_SEVERITY_RANK).label("max_severity_rank"),
            func.min(scoped.c.detected_at).label("first_seen"),
            func.max(scoped.c.detected_at).label("last_seen"),
        )
        .group_by(scoped.c.source_ip)
        .having(engine_count >= min_engines)
        .order_by(engine_count.desc(), func.count().desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).all()

    def _clean_engines(engines):
        out = []
        for e in engines or []:
            out.append(e.value if hasattr(e, "value") else e)
        return sorted(set(out))

    return {
        "window": window,
        "min_engines": min_engines,
        "results": [
            {
                "source_ip": r.source_ip,
                "engines": _clean_engines(r.engines),
                "engine_count": r.engine_count,
                "alert_count": r.alert_count,
                "max_severity": _RANK_TO_SEVERITY.get(int(r.max_severity_rank or 0)),
                "first_seen": r.first_seen.isoformat() if r.first_seen else None,
                "last_seen": r.last_seen.isoformat() if r.last_seen else None,
            }
            for r in rows
        ],
    }


@router.get("/engine-overlap")
async def engine_overlap(
    window: str = Query("1h"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pairwise matrix: how many source_ips are shared between each pair of engines.

    Diagonal (engine, engine) = total unique source_ips that engine flagged.
    """
    start = _parse_window(window)

    # Distinct (ids_source, source_ip) pairs within the window.
    pair = (
        apply_scope(
            select(Alert.ids_source.label("ids_source"), Alert.source_ip.label("source_ip"))
            .where(Alert.detected_at >= start)
            .distinct(),
            Alert,
            user,
        )
    ).subquery()

    a = pair.alias("a")
    b = pair.alias("b")

    q = (
        select(
            a.c.ids_source.label("engine_a"),
            b.c.ids_source.label("engine_b"),
            func.count().label("shared_ips"),
        )
        .select_from(a.join(b, a.c.source_ip == b.c.source_ip))
        .group_by(a.c.ids_source, b.c.ids_source)
    )
    rows = (await db.execute(q)).all()

    def _v(x):
        return x.value if hasattr(x, "value") else x

    # Dense matrix so the UI renders a clean heatmap without holes.
    matrix = {ea: {eb: 0 for eb in ENGINES} for ea in ENGINES}
    for r in rows:
        ea, eb = _v(r.engine_a), _v(r.engine_b)
        if ea in matrix and eb in matrix[ea]:
            matrix[ea][eb] = r.shared_ips

    return {
        "window": window,
        "engines": ENGINES,
        "matrix": matrix,
    }


@router.get("/engine-unique")
async def engine_unique(
    window: str = Query("1h"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """For each engine: alerts on source_ips that NO other engine flagged in the window."""
    start = _parse_window(window)

    # IPs flagged by exactly one engine.
    ip_counts = (
        apply_scope(
            select(
                Alert.source_ip.label("source_ip"),
                func.count(distinct(Alert.ids_source)).label("n"),
            ).where(Alert.detected_at >= start),
            Alert,
            user,
        )
        .group_by(Alert.source_ip)
        .having(func.count(distinct(Alert.ids_source)) == 1)
    ).subquery()

    scoped = _scoped_recent(user, start).subquery()

    q = (
        select(
            scoped.c.ids_source.label("ids_source"),
            func.count().label("alert_count"),
            func.count(distinct(scoped.c.source_ip)).label("unique_ips"),
        )
        .select_from(scoped.join(ip_counts, scoped.c.source_ip == ip_counts.c.source_ip))
        .group_by(scoped.c.ids_source)
    )
    rows = (await db.execute(q)).all()

    by_engine = {
        (r.ids_source.value if hasattr(r.ids_source, "value") else r.ids_source): {
            "alert_count": r.alert_count,
            "unique_ips": r.unique_ips,
        }
        for r in rows
    }

    return {
        "window": window,
        "engines": [
            {
                "ids_source": eng,
                **by_engine.get(eng, {"alert_count": 0, "unique_ips": 0}),
            }
            for eng in ENGINES
        ],
    }
