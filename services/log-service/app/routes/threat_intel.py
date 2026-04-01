import logging
import httpx
from fastapi import APIRouter, Depends, Query
from app.auth import get_current_user, CurrentUser
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/threat-intel", tags=["threat-intel"])

THREATFOX_API = "https://threatfox-api.abuse.ch/api/v1/"


@router.get("/recent")
async def get_recent_iocs(
    days: int = Query(7, ge=1, le=30),
    limit: int = Query(100, ge=1, le=500),
    user: CurrentUser = Depends(get_current_user),
):
    """Fetch the latest IOCs from ThreatFox."""
    if not settings.THREATFOX_AUTH_KEY:
        return {"iocs": [], "total": 0, "error": "ThreatFox API key not configured"}

    try:
        headers = {"Auth-Key": settings.THREATFOX_AUTH_KEY}
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                THREATFOX_API,
                json={"query": "get_iocs", "days": days},
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("ThreatFox get_iocs failed: %s", exc)
        return {"iocs": [], "total": 0, "error": str(exc)}

    if data.get("query_status") != "ok" or not data.get("data"):
        return {"iocs": [], "total": 0}

    raw_iocs = data["data"][:limit]
    iocs = []
    for ioc in raw_iocs:
        iocs.append({
            "id": ioc.get("id"),
            "ioc": ioc.get("ioc"),
            "ioc_type": ioc.get("ioc_type"),
            "threat_type": ioc.get("threat_type"),
            "malware": ioc.get("malware_printable"),
            "confidence_level": ioc.get("confidence_level", 0),
            "first_seen": ioc.get("first_seen_utc"),
            "last_seen": ioc.get("last_seen_utc"),
            "reference": ioc.get("reference"),
            "reporter": ioc.get("reporter"),
            "tags": ioc.get("tags") or [],
        })

    return {"iocs": iocs, "total": len(iocs)}


@router.get("/search")
async def search_ioc(
    term: str = Query(..., min_length=1),
    user: CurrentUser = Depends(get_current_user),
):
    """Search ThreatFox for a specific IOC (IP, hash, domain)."""
    if not settings.THREATFOX_AUTH_KEY:
        return {"results": [], "error": "ThreatFox API key not configured"}

    try:
        headers = {"Auth-Key": settings.THREATFOX_AUTH_KEY}
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                THREATFOX_API,
                json={"query": "search_ioc", "search_term": term},
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("ThreatFox search failed for %s: %s", term, exc)
        return {"results": [], "error": str(exc)}

    if data.get("query_status") != "ok" or not data.get("data"):
        return {"results": []}

    results = []
    for ioc in data["data"]:
        results.append({
            "id": ioc.get("id"),
            "ioc": ioc.get("ioc"),
            "ioc_type": ioc.get("ioc_type"),
            "threat_type": ioc.get("threat_type"),
            "malware": ioc.get("malware_printable"),
            "confidence_level": ioc.get("confidence_level", 0),
            "first_seen": ioc.get("first_seen_utc"),
            "last_seen": ioc.get("last_seen_utc"),
            "reference": ioc.get("reference"),
            "reporter": ioc.get("reporter"),
            "tags": ioc.get("tags") or [],
        })

    return {"results": results}
