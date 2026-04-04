"""File upload endpoint — parses IDS log files, runs them through the
processing pipeline, and stores results in the ingestion_logs table.
Does NOT touch the alerts table."""

import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user, CurrentUser
from app.models.alert import QuarantineStatus
from app.models.ingestion_log import IngestionLog
from app.models.lists import BlacklistEntry, WhitelistEntry
from app.schemas.alert import (
    IngestRequest,
    AlertIngest,
    SuricataAlert,
    ZeekAlert,
    SnortAlert,
    KismetAlert,
)
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
from app.ml.predictor import predict_threat
from app.utils.geoip import lookup_ip_location
from app.models.ml_config import MLConfig

router = APIRouter(prefix="/api/upload", tags=["upload"])

MAX_FILE_SIZE = 10 * 1024 * 1024
QUARANTINE_THRESHOLD = 0.7
AUTO_BLOCK_THRESHOLD = 0.9


# ── File parsers ──────────────────────────────────────────────────────

def _parse_suricata_file(text: str) -> list[dict]:
    alerts = []
    for line in text.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
            if obj.get("event_type") == "alert" or "alert" in obj:
                alerts.append({
                    "timestamp": obj.get("timestamp", ""),
                    "src_ip": obj.get("src_ip", "0.0.0.0"),
                    "dest_ip": obj.get("dest_ip", "0.0.0.0"),
                    "src_port": obj.get("src_port"),
                    "dest_port": obj.get("dest_port"),
                    "proto": obj.get("proto"),
                    "alert": obj.get("alert", {}),
                })
        except json.JSONDecodeError:
            continue
    return alerts


def _parse_zeek_file(text: str) -> list[dict]:
    alerts = []
    fields = None
    for line in text.strip().splitlines():
        line = line.strip()
        if line.startswith("#fields"):
            fields = line.split("\t")[1:]
            continue
        if line.startswith("#") or not line:
            continue
        if fields is None:
            fields = ["ts", "uid", "id.orig_h", "id.orig_p", "id.resp_h", "id.resp_p",
                       "fuid", "file_mime_type", "file_desc", "proto", "note", "msg",
                       "sub", "src", "dst", "p", "n", "peer_descr", "actions",
                       "suppress_for"]
        values = line.split("\t")
        row = {}
        for i, f in enumerate(fields):
            if i < len(values) and values[i] != "-":
                row[f] = values[i]
        try:
            alert = {
                "ts": float(row.get("ts", 0)),
                "id.orig_h": row.get("id.orig_h", "0.0.0.0"),
                "id.resp_h": row.get("id.resp_h", "0.0.0.0"),
                "proto": row.get("proto"),
                "note": row.get("note", ""),
                "msg": row.get("msg", ""),
            }
            orig_p = row.get("id.orig_p")
            resp_p = row.get("id.resp_p")
            if orig_p and orig_p.isdigit():
                alert["id.orig_p"] = int(orig_p)
            if resp_p and resp_p.isdigit():
                alert["id.resp_p"] = int(resp_p)
            alerts.append(alert)
        except (ValueError, TypeError):
            continue
    return alerts


def _parse_snort_file(text: str) -> list[dict]:
    alerts = []
    for line in text.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
            alerts.append({
                "timestamp": obj.get("timestamp", ""),
                "src": obj.get("src", obj.get("src_addr", "0.0.0.0")),
                "dst": obj.get("dst", obj.get("dst_addr", "0.0.0.0")),
                "sport": obj.get("sport", obj.get("src_port")),
                "dport": obj.get("dport", obj.get("dst_port")),
                "proto": obj.get("proto"),
                "classtype": obj.get("classtype", ""),
                "priority": obj.get("priority", 3),
                "msg": obj.get("msg", ""),
            })
        except json.JSONDecodeError:
            continue
    return alerts


def _parse_kismet_file(text: str) -> list[dict]:
    alerts = []
    try:
        data = json.loads(text)
        if isinstance(data, list):
            for obj in data:
                alerts.append({
                    "kismet_device_base_name": obj.get("kismet.device.base.name", ""),
                    "kismet_alert_header": obj.get("kismet.alert.header", ""),
                    "kismet_alert_text": obj.get("kismet.alert.text", ""),
                    "kismet_alert_timestamp": obj.get("kismet.alert.timestamp", 0.0),
                    "kismet_alert_source_mac": obj.get("kismet.alert.source_mac", "00:00:00:00:00:00"),
                    "kismet_alert_dest_mac": obj.get("kismet.alert.dest_mac", "00:00:00:00:00:00"),
                })
            return alerts
    except json.JSONDecodeError:
        pass
    for line in text.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
            alerts.append({
                "kismet_device_base_name": obj.get("kismet.device.base.name", ""),
                "kismet_alert_header": obj.get("kismet.alert.header", ""),
                "kismet_alert_text": obj.get("kismet.alert.text", ""),
                "kismet_alert_timestamp": obj.get("kismet.alert.timestamp", 0.0),
                "kismet_alert_source_mac": obj.get("kismet.alert.source_mac", "00:00:00:00:00:00"),
                "kismet_alert_dest_mac": obj.get("kismet.alert.dest_mac", "00:00:00:00:00:00"),
            })
        except json.JSONDecodeError:
            continue
    return alerts


PARSERS = {
    "suricata": ("suricata_alerts", _parse_suricata_file),
    "zeek": ("zeek_alerts", _parse_zeek_file),
    "snort": ("snort_alerts", _parse_snort_file),
    "kismet": ("kismet_alerts", _parse_kismet_file),
}


# ── Helpers ───────────────────────────────────────────────────────────

async def _load_list_entries(db: AsyncSession, model, user: CurrentUser):
    q = apply_scope(select(model), model, user)
    result = await db.execute(q)
    return result.scalars().all()


def _check_list(ip: str, entries) -> object | None:
    for entry in entries:
        if matches_entry(ip, entry.entry_type.value, entry.value):
            return entry
    return None


# ── Upload endpoint ───────────────────────────────────────────────────

@router.post("")
async def upload_ids_log(
    file: UploadFile = File(...),
    ids_source: str = Form(...),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if ids_source.lower() not in PARSERS:
        raise HTTPException(status_code=400, detail=f"Unsupported IDS source: {ids_source}. Must be one of: {', '.join(PARSERS.keys())}")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")

    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded text.")

    field_name, parser = PARSERS[ids_source.lower()]
    parsed = parser(text)

    if not parsed:
        raise HTTPException(status_code=400, detail=f"No valid alerts found in file. Make sure the file is a valid {ids_source} log format.")

    # Normalise parsed entries
    ingest_body = IngestRequest(**{field_name: parsed})
    normalised: list[AlertIngest] = []
    if ingest_body.suricata_alerts:
        normalised.extend(normalize_suricata(a) for a in ingest_body.suricata_alerts)
    if ingest_body.zeek_alerts:
        normalised.extend(normalize_zeek(a) for a in ingest_body.zeek_alerts)
    if ingest_body.snort_alerts:
        normalised.extend(normalize_snort(a) for a in ingest_body.snort_alerts)
    if ingest_body.kismet_alerts:
        normalised.extend(normalize_kismet(a) for a in ingest_body.kismet_alerts)

    # Load lists and ML config
    whitelist = await _load_list_entries(db, WhitelistEntry, user)
    blacklist = await _load_list_entries(db, BlacklistEntry, user)

    ml_q = apply_scope(select(MLConfig), MLConfig, user)
    ml_config = (await db.execute(ml_q)).scalars().first()
    ml_enabled = ml_config.enabled if ml_config else True
    ml_sensitivity = ml_config.sensitivity if ml_config else 0.8
    ml_score_boost = ml_config.score_boost if ml_config else 0.2
    ml_model_type = ml_config.model_type if ml_config else "random_forest"

    batch_id = uuid.uuid4()
    rows: list[IngestionLog] = []

    for alert in normalised:
        score = calculate_threat_score(alert.severity, alert.category)
        is_whitelisted = False
        is_blocked = False
        flagged = "false"
        threat_intel = None
        q_status = QuarantineStatus.NONE
        q_at = None

        # Whitelist
        wl_match = _check_list(alert.source_ip, whitelist)
        if wl_match:
            is_whitelisted = True
            score = 0.0
        else:
            # Blacklist
            bl_match = _check_list(alert.source_ip, blacklist)
            if bl_match:
                is_blocked = True
                score = 1.0
            else:
                # ThreatFox
                threat_data = await check_ip_reputation(alert.source_ip)
                if threat_data:
                    flagged = "true"
                    threat_intel = threat_data
                    confidence = threat_data.get("confidence_level", 50)
                    score = max(score, 0.9 + (confidence / 1000))
                    score = min(score, 1.0)
                    is_blocked = True

                # Score-based
                if not is_blocked:
                    score = round(score, 3)
                    if score >= AUTO_BLOCK_THRESHOLD:
                        is_blocked = True
                    elif score >= QUARANTINE_THRESHOLD:
                        q_status = QuarantineStatus.QUARANTINED
                        q_at = datetime.now(timezone.utc)

        # ML prediction
        ml_confidence = None
        if not is_whitelisted and ml_enabled:
            prediction = predict_threat(
                severity=alert.severity.value if hasattr(alert.severity, 'value') else alert.severity,
                category=alert.category.value if hasattr(alert.category, 'value') else alert.category,
                alert_count_last_hour=1,
                source_port=alert.source_port or 0,
                destination_port=alert.destination_port or 0,
                model_type=ml_model_type,
            )
            if prediction:
                ml_confidence = prediction["confidence"]
                if prediction["confidence"] > ml_sensitivity and not is_blocked:
                    score = min(score + ml_score_boost, 1.0)
                    score = round(score, 3)
                    if score >= AUTO_BLOCK_THRESHOLD and not is_blocked:
                        is_blocked = True
                    elif score >= QUARANTINE_THRESHOLD and q_status == QuarantineStatus.NONE:
                        q_status = QuarantineStatus.QUARANTINED
                        q_at = datetime.now(timezone.utc)

        # GeoIP
        geo_lat = geo_lon = None
        geo_country = None
        geo = await lookup_ip_location(alert.source_ip)
        if geo:
            geo_lat = geo["latitude"]
            geo_lon = geo["longitude"]
            geo_country = geo["country"]

        rows.append(IngestionLog(
            batch_id=batch_id,
            upload_filename=file.filename or "unknown",
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
        ))

    db.add_all(rows)
    await db.commit()

    return {
        "batch_id": str(batch_id),
        "parsed": len(parsed),
        "ingested": len(rows),
        "message": f"Successfully processed {len(rows)} log entries from {ids_source} file.",
        "filename": file.filename,
    }
