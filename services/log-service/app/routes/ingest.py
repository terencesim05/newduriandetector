from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user
from app.models.alert import Alert
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

router = APIRouter(prefix="/api/logs", tags=["ingestion"])


async def _load_list_entries(db: AsyncSession, model, user_id: int):
    result = await db.execute(select(model).where(model.user_id == user_id))
    return result.scalars().all()


def _check_list(ip: str, entries) -> object | None:
    """Return the first matching list entry, or None."""
    for entry in entries:
        if matches_entry(ip, entry.entry_type.value, entry.value):
            return entry
    return None


@router.post("/ingest", response_model=IngestResponse)
async def ingest_alerts(
    body: IngestRequest,
    user_id: int = Depends(get_current_user),
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

    # Load user's whitelist and blacklist once
    whitelist = await _load_list_entries(db, WhitelistEntry, user_id)
    blacklist = await _load_list_entries(db, BlacklistEntry, user_id)

    rows: list[Alert] = []
    for alert in normalised:
        score = calculate_threat_score(alert.severity, alert.category)
        is_whitelisted = False
        is_blocked = False
        flagged = "false"
        threat_intel = None

        # --- Priority 1: Whitelist ---
        wl_match = _check_list(alert.source_ip, whitelist)
        if wl_match:
            is_whitelisted = True
            score = 0.0
            # Bump trust count
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

                    # Auto-blacklist: add to blacklist if not already there
                    if not _check_list(alert.source_ip, blacklist):
                        new_bl = BlacklistEntry(
                            entry_type="IP",
                            value=alert.source_ip,
                            reason=f"ThreatFox: {threat_data.get('malware', 'unknown')} ({threat_data.get('threat_type', 'unknown')})",
                            added_by="threatfox",
                            user_id=user_id,
                        )
                        db.add(new_bl)
                        blacklist.append(new_bl)  # update in-memory list
                    is_blocked = True

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
            user_id=user_id,
            team_id=alert.team_id,
            detected_at=alert.detected_at,
            threat_intel=threat_intel,
            flagged_by_threatfox=flagged,
            is_whitelisted=is_whitelisted,
            is_blocked=is_blocked,
        )
        rows.append(row)

    db.add_all(rows)
    await db.commit()

    return IngestResponse(ingested=len(rows), message="Alerts ingested successfully")
