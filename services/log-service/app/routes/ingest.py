from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user, require_active_subscription, CurrentUser
from app.models.alert import Alert, QuarantineStatus
from app.models.lists import BlacklistEntry, WhitelistEntry
from app.schemas.alert import IngestRequest, IngestResponse, AlertIngest
from app.services.normalizer import (
    normalize_suricata,
    normalize_zeek,
    normalize_snort,
    normalize_kismet,
)
from app.services.scoring import calculate_threat_score
from app.utils.threat_intel import check_ip_reputation
from app.utils.matcher import matches_entry
from app.utils.scoping import apply_scope
from app.utils.rule_engine import evaluate_rules
from app.ml.predictor import predict_threat
from app.utils.geoip import lookup_ip_location
from app.models.ml_config import MLConfig
from app.utils.scoping import apply_scope as scope_query

router = APIRouter(prefix="/api/logs", tags=["ingestion"])

QUARANTINE_THRESHOLD = 0.7
AUTO_BLOCK_THRESHOLD = 0.9


async def _load_list_entries(db: AsyncSession, model, user: CurrentUser):
    q = apply_scope(select(model), model, user)
    result = await db.execute(q)
    return result.scalars().all()


def _check_list(ip: str, entries) -> object | None:
    for entry in entries:
        if matches_entry(ip, entry.entry_type.value, entry.value):
            return entry
    return None


@router.post("/ingest", response_model=IngestResponse)
async def ingest_alerts(
    body: IngestRequest,
    user: CurrentUser = Depends(require_active_subscription),
    db: AsyncSession = Depends(get_db),
):
    normalised: list[AlertIngest] = []

    if body.alerts:
        normalised.extend(body.alerts)
    if body.suricata_alerts:
        normalised.extend(normalize_suricata(a) for a in body.suricata_alerts)
    if body.zeek_alerts:
        normalised.extend(normalize_zeek(a) for a in body.zeek_alerts)
    if body.snort_alerts:
        normalised.extend(normalize_snort(a) for a in body.snort_alerts)
    if body.kismet_alerts:
        normalised.extend(normalize_kismet(a) for a in body.kismet_alerts)

    if not normalised:
        raise HTTPException(status_code=400, detail="No alerts provided")

    whitelist = await _load_list_entries(db, WhitelistEntry, user)
    blacklist = await _load_list_entries(db, BlacklistEntry, user)

    # --- Load ML config (defaults if none exists) ---
    ml_q = scope_query(select(MLConfig), MLConfig, user)
    ml_config = (await db.execute(ml_q)).scalars().first()
    ml_enabled = ml_config.enabled if ml_config else True
    ml_sensitivity = ml_config.sensitivity if ml_config else 0.8
    ml_score_boost = ml_config.score_boost if ml_config else 0.2
    ml_model_type = ml_config.model_type if ml_config else "random_forest"

    rows: list[Alert] = []
    for alert in normalised:
        score = calculate_threat_score(alert.severity, alert.category)
        is_whitelisted = False
        is_blocked = False
        flagged = "false"
        threat_intel = None
        q_status = QuarantineStatus.NONE
        q_at = None

        # --- Priority 1: Whitelist ---
        wl_match = _check_list(alert.source_ip, whitelist)
        if wl_match:
            is_whitelisted = True
            score = 0.0
            wl_match.trust_count += 1
        else:
            # --- Priority 2: Blacklist ---
            bl_match = _check_list(alert.source_ip, blacklist)
            if bl_match:
                is_blocked = True
                score = 1.0
                bl_match.block_count += 1
            else:
                # --- Priority 3: ThreatFox ---
                threat_data = await check_ip_reputation(alert.source_ip)
                if threat_data:
                    flagged = "true"
                    threat_intel = threat_data
                    confidence = threat_data.get("confidence_level", 50)
                    score = max(score, 0.9 + (confidence / 1000))
                    score = min(score, 1.0)
                    raw = alert.raw_data or {}
                    raw["threatfox"] = threat_data
                    alert.raw_data = raw

                    if not _check_list(alert.source_ip, blacklist):
                        new_bl = BlacklistEntry(
                            entry_type="IP",
                            value=alert.source_ip,
                            reason=f"ThreatFox: {threat_data.get('malware', 'unknown')} ({threat_data.get('threat_type', 'unknown')})",
                            added_by="threatfox",
                            user_id=user.user_id,
                            team_id=user.team_id,
                        )
                        db.add(new_bl)
                        blacklist.append(new_bl)
                    is_blocked = True

                # --- Priority 4: Score-based decision ---
                if not is_blocked:
                    score = round(score, 3)
                    if score >= AUTO_BLOCK_THRESHOLD:
                        is_blocked = True
                        if not _check_list(alert.source_ip, blacklist):
                            new_bl = BlacklistEntry(
                                entry_type="IP",
                                value=alert.source_ip,
                                reason=f"Auto-blocked: threat_score {score} >= {AUTO_BLOCK_THRESHOLD}",
                                added_by="auto",
                                user_id=user.user_id,
                                team_id=user.team_id,
                            )
                            db.add(new_bl)
                            blacklist.append(new_bl)
                    elif score >= QUARANTINE_THRESHOLD:
                        q_status = QuarantineStatus.QUARANTINED
                        q_at = datetime.now(timezone.utc)

        # --- ML prediction ---
        ml_confidence = None
        if not is_whitelisted and ml_enabled:
            prediction = predict_threat(
                severity=alert.severity.value if hasattr(alert.severity, 'value') else alert.severity,
                category=alert.category.value if hasattr(alert.category, 'value') else alert.category,
                alert_count_last_hour=1,
                source_port=alert.source_port or 0,
                destination_port=alert.destination_port or 0,
                ids_source=alert.ids_source.value if hasattr(alert.ids_source, 'value') else (alert.ids_source or ""),
                protocol=alert.protocol or "",
                has_threat_intel=1 if flagged == "true" else 0,
                model_type=ml_model_type,
            )
            if prediction:
                ml_confidence = prediction["confidence"]
                if prediction["confidence"] > ml_sensitivity and not is_blocked:
                    score = min(score + ml_score_boost, 1.0)
                    score = round(score, 3)
                    if score >= AUTO_BLOCK_THRESHOLD and not is_blocked:
                        is_blocked = True
                        if not _check_list(alert.source_ip, blacklist):
                            new_bl = BlacklistEntry(
                                entry_type="IP",
                                value=alert.source_ip,
                                reason=f"Auto-blocked: ML confidence {ml_confidence} boosted score to {score}",
                                added_by="auto",
                                user_id=user.user_id,
                                team_id=user.team_id,
                            )
                            db.add(new_bl)
                            blacklist.append(new_bl)
                    elif score >= QUARANTINE_THRESHOLD and q_status == QuarantineStatus.NONE:
                        q_status = QuarantineStatus.QUARANTINED
                        q_at = datetime.now(timezone.utc)

        # --- GeoIP lookup ---
        geo_lat = None
        geo_lon = None
        geo_country = None
        geo = await lookup_ip_location(alert.source_ip)
        if geo:
            geo_lat = geo["latitude"]
            geo_lon = geo["longitude"]
            geo_country = geo["country"]

        row = Alert(
            severity=alert.severity,
            category=alert.category,
            source_ip=alert.source_ip,
            destination_ip=alert.destination_ip,
            source_port=alert.source_port,
            destination_port=alert.destination_port,
            protocol=alert.protocol,
            threat_score=round(score, 3),
            ids_source=alert.ids_source,
            raw_data=alert.raw_data,
            user_id=user.user_id,
            team_id=user.team_id,
            detected_at=alert.detected_at,
            threat_intel=threat_intel,
            flagged_by_threatfox=flagged,
            is_whitelisted=is_whitelisted,
            is_blocked=is_blocked,
            quarantine_status=q_status,
            quarantined_at=q_at,
            ml_confidence=ml_confidence,
            geo_latitude=geo_lat,
            geo_longitude=geo_lon,
            geo_country=geo_country,
        )
        rows.append(row)

    db.add_all(rows)
    await db.flush()  # persist rows so rule engine COUNT queries include them

    # --- Rule Engine: evaluate custom rules ---
    for row in rows:
        if not row.is_whitelisted and not row.is_blocked:
            await evaluate_rules(row, user, db)

    await db.commit()

    return IngestResponse(ingested=len(rows), message="Alerts ingested successfully")
