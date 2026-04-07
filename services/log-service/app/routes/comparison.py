"""IDS engine comparison endpoints (Exclusive tier only).

Replays a sample PCAP through pre-computed Snort and Suricata outputs and
surfaces where the two engines agree, disagree, or each see something the
other missed. The point of the feature is the *disagreements*, not the
agreements — they reveal that "IDS detection" is not a single ground truth.
"""

import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user, CurrentUser
from app.models.comparison import ComparisonRun
from app.comparison.samples import list_samples, get_sample, load_engine_output
from app.comparison.correlator import correlate

router = APIRouter(prefix="/api/comparison", tags=["comparison"])


def require_exclusive(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if user.tier != "EXCLUSIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="IDS Engine Comparison is available on the Exclusive tier only.",
        )
    return user


# ── schemas ───────────────────────────────────────────────────────────────


class RunRequest(BaseModel):
    sample: str


class SampleOut(BaseModel):
    name: str
    label: str
    description: str


class RunOut(BaseModel):
    id: uuid.UUID
    sample_name: str
    sample_label: str
    snort_count: int
    suricata_count: int
    agreement_count: int
    snort_only_count: int
    suricata_only_count: int
    severity_disagreement_count: int
    matched_pairs: list
    created_at: str

    class Config:
        from_attributes = True


def _run_to_out(run: ComparisonRun) -> dict:
    return {
        "id": run.id,
        "sample_name": run.sample_name,
        "sample_label": run.sample_label,
        "snort_count": run.snort_count,
        "suricata_count": run.suricata_count,
        "agreement_count": run.agreement_count,
        "snort_only_count": run.snort_only_count,
        "suricata_only_count": run.suricata_only_count,
        "severity_disagreement_count": run.severity_disagreement_count,
        "matched_pairs": run.matched_pairs or [],
        "created_at": run.created_at.isoformat() if run.created_at else "",
    }


# ── endpoints ─────────────────────────────────────────────────────────────


@router.get("/samples")
async def get_samples(user: CurrentUser = Depends(require_exclusive)):
    return list_samples()


@router.post("/runs")
async def create_run(
    body: RunRequest,
    user: CurrentUser = Depends(require_exclusive),
    db: AsyncSession = Depends(get_db),
):
    sample = get_sample(body.sample)
    if not sample:
        raise HTTPException(status_code=404, detail=f"Unknown sample '{body.sample}'")

    try:
        snort_alerts = load_engine_output(sample["name"], "snort")
        suricata_alerts = load_engine_output(sample["name"], "suricata")
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))

    result = correlate(snort_alerts, suricata_alerts)

    team_uuid = uuid.UUID(user.team_id) if user.team_id else None
    run = ComparisonRun(
        user_id=user.user_id,
        team_id=team_uuid,
        sample_name=sample["name"],
        sample_label=sample["label"],
        snort_count=result["snort_count"],
        suricata_count=result["suricata_count"],
        agreement_count=result["agreement_count"],
        snort_only_count=result["snort_only_count"],
        suricata_only_count=result["suricata_only_count"],
        severity_disagreement_count=result["severity_disagreement_count"],
        matched_pairs=result["matched_pairs"],
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return _run_to_out(run)


@router.get("/runs")
async def list_runs(
    user: CurrentUser = Depends(require_exclusive),
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
            "sample_name": r.sample_name,
            "sample_label": r.sample_label,
            "snort_count": r.snort_count,
            "suricata_count": r.suricata_count,
            "agreement_count": r.agreement_count,
            "snort_only_count": r.snort_only_count,
            "suricata_only_count": r.suricata_only_count,
            "severity_disagreement_count": r.severity_disagreement_count,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in rows
    ]


@router.get("/runs/{run_id}")
async def get_run(
    run_id: uuid.UUID,
    user: CurrentUser = Depends(require_exclusive),
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
    user: CurrentUser = Depends(require_exclusive),
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
