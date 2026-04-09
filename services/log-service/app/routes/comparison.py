"""IDS engine comparison endpoints (Exclusive tier only).

Compares real ingested alerts from Snort, Suricata, and Zeek within a
user-specified time range. Surfaces where the three engines agree, disagree,
or each detect something the others missed.
"""

import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user, CurrentUser
from app.models.alert import Alert, IDSSource
from app.models.comparison import ComparisonRun
from app.comparison.correlator import correlate
from app.utils.scoping import apply_scope

router = APIRouter(prefix="/api/comparison", tags=["comparison"])


def require_premium(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.tier not in ("PREMIUM", "EXCLUSIVE"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="IDS Engine Comparison is available on Premium and Exclusive tiers only.",
        )
    return user


# ── schemas ───────────────────────────────────────────────────────────────


class RunRequest(BaseModel):
    hours: int = 24  # time range to compare (last N hours)


class RunOut(BaseModel):
    id: uuid.UUID
    start_date: str | None
    end_date: str | None
    snort_count: int
    suricata_count: int
    zeek_count: int
    all_three_count: int
    snort_suricata_count: int
    snort_zeek_count: int
    suricata_zeek_count: int
    snort_only_count: int
    suricata_only_count: int
    zeek_only_count: int
    severity_disagreement_count: int
    matched_pairs: list
    created_at: str

    class Config:
        from_attributes = True


def _run_to_out(run: ComparisonRun) -> dict:
    return {
        "id": run.id,
        "start_date": run.start_date.isoformat() if run.start_date else None,
        "end_date": run.end_date.isoformat() if run.end_date else None,
        "snort_count": run.snort_count,
        "suricata_count": run.suricata_count,
        "zeek_count": run.zeek_count,
        "all_three_count": run.all_three_count,
        "snort_suricata_count": run.snort_suricata_count,
        "snort_zeek_count": run.snort_zeek_count,
        "suricata_zeek_count": run.suricata_zeek_count,
        "snort_only_count": run.snort_only_count,
        "suricata_only_count": run.suricata_only_count,
        "zeek_only_count": run.zeek_only_count,
        "severity_disagreement_count": run.severity_disagreement_count,
        "matched_pairs": run.matched_pairs or [],
        "created_at": run.created_at.isoformat() if run.created_at else "",
    }


def _alert_to_dict(alert: Alert) -> dict:
    """Convert an Alert ORM object to a dict the correlator understands."""
    # Extract signature from raw_data depending on IDS source
    raw = alert.raw_data or {}
    signature = ""
    if alert.ids_source == IDSSource.SURICATA:
        alert_data = raw.get("alert", {})
        signature = alert_data.get("signature", "") if isinstance(alert_data, dict) else ""
    elif alert.ids_source == IDSSource.SNORT:
        signature = raw.get("msg", "")
    elif alert.ids_source == IDSSource.ZEEK:
        signature = raw.get("note", "") or raw.get("msg", "")

    return {
        "id": str(alert.id),
        "src_ip": alert.source_ip,
        "dst_ip": alert.destination_ip,
        "src_port": alert.source_port,
        "dst_port": alert.destination_port,
        "protocol": alert.protocol,
        "severity": alert.severity.value if alert.severity else "",
        "category": alert.category.value if alert.category else "",
        "signature": signature,
        "threat_score": alert.threat_score,
        "timestamp": alert.detected_at.isoformat() if alert.detected_at else "",
        "ids_source": alert.ids_source.value if alert.ids_source else "",
    }


# ── endpoints ─────────────────────────────────────────────────────────────


@router.get("/stats")
async def get_engine_stats(
    user: CurrentUser = Depends(require_premium),
    db: AsyncSession = Depends(get_db),
):
    """Quick check of how many alerts exist per engine for the user."""
    q = select(Alert.ids_source, func.count(Alert.id)).group_by(Alert.ids_source)
    q = apply_scope(q, Alert, user)
    q = q.where(Alert.ids_source.in_([IDSSource.SNORT, IDSSource.SURICATA, IDSSource.ZEEK]))
    rows = (await db.execute(q)).all()
    counts = {r[0].value: r[1] for r in rows}
    return {
        "snort": counts.get("snort", 0),
        "suricata": counts.get("suricata", 0),
        "zeek": counts.get("zeek", 0),
    }


@router.post("/runs")
async def create_run(
    body: RunRequest,
    user: CurrentUser = Depends(require_premium),
    db: AsyncSession = Depends(get_db),
):
    """Run a three-way comparison on real ingested alerts within the given time range."""
    if body.hours < 1 or body.hours > 720:  # max 30 days
        raise HTTPException(status_code=400, detail="hours must be between 1 and 720")

    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(hours=body.hours)

    # Fetch alerts per engine (excluding Kismet)
    engine_alerts: dict[str, list[dict]] = {"snort": [], "suricata": [], "zeek": []}

    for source in [IDSSource.SNORT, IDSSource.SURICATA, IDSSource.ZEEK]:
        q = (
            select(Alert)
            .where(Alert.ids_source == source)
            .where(Alert.detected_at >= start_date)
            .where(Alert.detected_at <= end_date)
            .order_by(Alert.detected_at)
            .limit(5000)
        )
        q = apply_scope(q, Alert, user)
        rows = (await db.execute(q)).scalars().all()
        engine_alerts[source.value] = [_alert_to_dict(a) for a in rows]

    total = sum(len(v) for v in engine_alerts.values())
    if total == 0:
        raise HTTPException(
            status_code=404,
            detail=f"No Snort, Suricata, or Zeek alerts found in the last {body.hours} hours.",
        )

    # Need at least 2 engines with data
    engines_with_data = sum(1 for v in engine_alerts.values() if v)
    if engines_with_data < 2:
        raise HTTPException(
            status_code=400,
            detail="Need alerts from at least 2 engines (Snort, Suricata, Zeek) to compare. "
                   "Currently only have data from: "
                   + ", ".join(k.capitalize() for k, v in engine_alerts.items() if v) + ".",
        )

    result = correlate(
        snort_alerts=engine_alerts["snort"],
        suricata_alerts=engine_alerts["suricata"],
        zeek_alerts=engine_alerts["zeek"],
    )

    team_uuid = uuid.UUID(user.team_id) if user.team_id else None
    run = ComparisonRun(
        user_id=user.user_id,
        team_id=team_uuid,
        start_date=start_date,
        end_date=end_date,
        snort_count=result["snort_count"],
        suricata_count=result["suricata_count"],
        zeek_count=result["zeek_count"],
        all_three_count=result["all_three_count"],
        snort_suricata_count=result["snort_suricata_count"],
        snort_zeek_count=result["snort_zeek_count"],
        suricata_zeek_count=result["suricata_zeek_count"],
        snort_only_count=result["snort_only_count"],
        suricata_only_count=result["suricata_only_count"],
        zeek_only_count=result["zeek_only_count"],
        severity_disagreement_count=result["severity_disagreement_count"],
        matched_pairs=result["matched_pairs"],
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return _run_to_out(run)


@router.get("/runs")
async def list_runs(
    user: CurrentUser = Depends(require_premium),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(ComparisonRun)
        .where(ComparisonRun.user_id == user.user_id)
        .order_by(ComparisonRun.created_at.desc())
        .limit(50)
    )
    rows = (await db.execute(q)).scalars().all()
    # Strip matched_pairs from list view to keep payload small
    return [
        {
            "id": r.id,
            "start_date": r.start_date.isoformat() if r.start_date else None,
            "end_date": r.end_date.isoformat() if r.end_date else None,
            "snort_count": r.snort_count,
            "suricata_count": r.suricata_count,
            "zeek_count": r.zeek_count,
            "all_three_count": r.all_three_count,
            "snort_suricata_count": r.snort_suricata_count,
            "snort_zeek_count": r.snort_zeek_count,
            "suricata_zeek_count": r.suricata_zeek_count,
            "snort_only_count": r.snort_only_count,
            "suricata_only_count": r.suricata_only_count,
            "zeek_only_count": r.zeek_only_count,
            "severity_disagreement_count": r.severity_disagreement_count,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in rows
    ]


@router.get("/runs/{run_id}")
async def get_run(
    run_id: uuid.UUID,
    user: CurrentUser = Depends(require_premium),
    db: AsyncSession = Depends(get_db),
):
    q = select(ComparisonRun).where(
        ComparisonRun.id == run_id, ComparisonRun.user_id == user.user_id
    )
    run = (await db.execute(q)).scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Comparison run not found")
    return _run_to_out(run)


@router.delete("/runs/{run_id}")
async def delete_run(
    run_id: uuid.UUID,
    user: CurrentUser = Depends(require_premium),
    db: AsyncSession = Depends(get_db),
):
    q = delete(ComparisonRun).where(
        ComparisonRun.id == run_id, ComparisonRun.user_id == user.user_id
    )
    result = await db.execute(q)
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Comparison run not found")
    return {"detail": "Deleted"}
