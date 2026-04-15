import csv
import io
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user, require_admin, CurrentUser
from app.models.alert import Alert
from app.models.ml_config import MLConfig
from app.schemas.ml_config import MLConfigOut, MLConfigUpdate
from app.utils.scoping import apply_scope

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ml-config", tags=["ml-config"])


async def _get_or_create_config(db: AsyncSession, user: CurrentUser) -> MLConfig:
    """Return the user's/team's ML config, creating a default one if none exists."""
    q = apply_scope(select(MLConfig), MLConfig, user)
    result = await db.execute(q)
    config = result.scalars().first()
    if config is None:
        config = MLConfig(
            user_id=user.user_id,
            team_id=user.team_id,
        )
        db.add(config)
        await db.flush()
    return config


@router.get("", response_model=MLConfigOut)
async def get_ml_config(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tier = (user.tier or "free").upper()
    if tier not in ("PREMIUM", "EXCLUSIVE"):
        raise HTTPException(status_code=403, detail="ML configuration requires Premium or Exclusive tier")
    config = await _get_or_create_config(db, user)
    await db.commit()
    return MLConfigOut.model_validate(config)


@router.put("", response_model=MLConfigOut)
async def update_ml_config(
    body: MLConfigUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tier = (user.tier or "free").upper()
    if tier not in ("PREMIUM", "EXCLUSIVE"):
        raise HTTPException(status_code=403, detail="ML configuration requires Premium or Exclusive tier")

    config = await _get_or_create_config(db, user)

    if body.model_type is not None:
        config.model_type = body.model_type
    if body.enabled is not None:
        config.enabled = body.enabled
    if body.confidence_threshold is not None:
        config.confidence_threshold = body.confidence_threshold
    if body.sensitivity is not None:
        config.sensitivity = body.sensitivity
    if body.score_boost is not None:
        config.score_boost = body.score_boost

    config.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(config)
    return MLConfigOut.model_validate(config)


# ── Encoding maps (must match generate_training_data.py) ──
_SEVERITY_ENC = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
_CATEGORY_ENC = {
    "OTHER": 1, "ANOMALY": 2, "PORT_SCAN": 3, "DDOS": 4,
    "BRUTE_FORCE": 5, "XSS": 6, "MALWARE": 7,
    "PRIVILEGE_ESCALATION": 8, "DATA_EXFILTRATION": 9,
    "SQL_INJECTION": 10, "COMMAND_INJECTION": 10,
}
_IDS_SOURCE_ENC = {"suricata": 1, "zeek": 2, "snort": 3, "kismet": 4}
_PROTOCOL_ENC = {"TCP": 1, "UDP": 2, "ICMP": 3, "HTTP": 4, "802.11": 5}

FEATURES = [
    "severity", "category", "alert_count_last_hour",
    "source_port", "destination_port",
    "ids_source", "protocol", "has_threat_intel",
]


def _label_alert(alert: Alert) -> int | None:
    """Derive is_threat label from alert state. Returns None if ambiguous."""
    if alert.is_blocked or alert.quarantine_status == "BLOCKED":
        return 1
    if alert.threat_score is not None and alert.threat_score >= 0.7:
        return 1
    if alert.is_whitelisted:
        return 0
    if alert.threat_score is not None and alert.threat_score < 0.3:
        return 0
    return None  # ambiguous — skip


@router.get("/export-training-data")
async def export_training_data(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export labeled alerts as CSV for ML training."""
    tier = (user.tier or "free").upper()
    if tier not in ("PREMIUM", "EXCLUSIVE") and not user.is_admin:
        raise HTTPException(status_code=403, detail="Export requires Premium or Exclusive tier")

    q = apply_scope(select(Alert), Alert, user)
    result = await db.execute(q)
    alerts = result.scalars().all()

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=FEATURES + ["is_threat"])
    writer.writeheader()

    count = 0
    for alert in alerts:
        label = _label_alert(alert)
        if label is None:
            continue
        writer.writerow({
            "severity": _SEVERITY_ENC.get(alert.severity, 2),
            "category": _CATEGORY_ENC.get(alert.category, 1),
            "alert_count_last_hour": 1,
            "source_port": alert.source_port or 0,
            "destination_port": alert.destination_port or 0,
            "ids_source": _IDS_SOURCE_ENC.get(alert.ids_source, 0),
            "protocol": _PROTOCOL_ENC.get((alert.protocol or "").upper(), 0),
            "has_threat_intel": 1 if alert.flagged_by_threatfox == "true" else 0,
            "is_threat": label,
        })
        count += 1

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="training_data_export_{count}.csv"',
            "X-Total-Samples": str(count),
        },
    )


@router.post("/retrain")
async def retrain_models(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrain ML models using real alert data (supplemented with synthetic if needed)."""
    if not user.is_admin and (user.tier or "").upper() != "EXCLUSIVE":
        raise HTTPException(status_code=403, detail="Retraining requires admin or Exclusive tier")

    import pandas as pd
    import os

    # 1. Export real data
    q = apply_scope(select(Alert), Alert, user)
    result = await db.execute(q)
    alerts = result.scalars().all()

    rows = []
    for alert in alerts:
        label = _label_alert(alert)
        if label is None:
            continue
        rows.append({
            "severity": _SEVERITY_ENC.get(alert.severity, 2),
            "category": _CATEGORY_ENC.get(alert.category, 1),
            "alert_count_last_hour": 1,
            "source_port": alert.source_port or 0,
            "destination_port": alert.destination_port or 0,
            "ids_source": _IDS_SOURCE_ENC.get(alert.ids_source, 0),
            "protocol": _PROTOCOL_ENC.get((alert.protocol or "").upper(), 0),
            "has_threat_intel": 1 if alert.flagged_by_threatfox == "true" else 0,
            "is_threat": label,
        })

    real_count = len(rows)

    # 2. Supplement with synthetic if < 100 real samples
    if real_count < 100:
        from app.ml.generate_training_data import main as generate_synthetic, OUTPUT_PATH
        generate_synthetic()
        synthetic_df = pd.read_csv(OUTPUT_PATH)
        rows.extend(synthetic_df.to_dict("records"))

    # 3. Save combined training data
    models_dir = os.path.join(os.path.dirname(__file__), "..", "ml", "..", "..", "models")
    models_dir = os.path.normpath(models_dir)
    data_path = os.path.join(models_dir, "training_data.csv")

    df = pd.DataFrame(rows)
    df.to_csv(data_path, index=False)

    # 4. Train models
    from app.ml.train_model import main as train_all
    train_all()

    # 5. Clear predictor cache so new models are loaded
    from app.ml.predictor import clear_cache
    clear_cache()

    return {
        "status": "success",
        "real_samples": real_count,
        "total_samples": len(rows),
        "supplemented_with_synthetic": real_count < 100,
        "models_retrained": ["random_forest", "neural_network", "isolation_forest"],
    }
