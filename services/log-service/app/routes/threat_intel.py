import logging
import time
from datetime import datetime, timezone, timedelta
import httpx

SGT = timezone(timedelta(hours=8))


def _to_sgt(value: str | None) -> str | None:
    """ThreatFox returns timestamps as 'YYYY-MM-DD HH:MM:SS UTC'. Convert to GMT+8."""
    if not value:
        return value
    s = value.replace(" UTC", "").strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            dt = datetime.strptime(s, fmt).replace(tzinfo=timezone.utc)
            return dt.astimezone(SGT).strftime("%Y-%m-%d %H:%M:%S SGT")
        except ValueError:
            continue
    return value
from fastapi import APIRouter, Depends, Query
from app.auth import get_current_user, CurrentUser
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/threat-intel", tags=["threat-intel"])

THREATFOX_API = "https://threatfox-api.abuse.ch/api/v1/"

# In-memory cache: key = days value, value = (timestamp, response data)
_ioc_cache: dict[int, tuple[float, list]] = {}
CACHE_TTL = 300  # 5 minutes


def _get_cached(days: int) -> list | None:
    if days in _ioc_cache:
        ts, data = _ioc_cache[days]
        if time.time() - ts < CACHE_TTL:
            return data
    return None


def _set_cached(days: int, data: list):
    _ioc_cache[days] = (time.time(), data)


@router.get("/recent")
async def get_recent_iocs(
    days: int = Query(7, ge=1, le=30),
    limit: int = Query(100, ge=1, le=500),
    user: CurrentUser = Depends(get_current_user),
):
    """Fetch the latest IOCs from ThreatFox (cached for 5 minutes)."""
    if not settings.THREATFOX_AUTH_KEY:
        return {"iocs": [], "total": 0, "error": "ThreatFox API key not configured"}

    # Check cache first
    cached = _get_cached(days)
    if cached is not None:
        sliced = cached[:limit]
        return {"iocs": sliced, "total": len(sliced), "cached": True}

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
        # Return stale cache if available
        if days in _ioc_cache:
            stale = _ioc_cache[days][1][:limit]
            return {"iocs": stale, "total": len(stale), "cached": True, "stale": True}
        return {"iocs": [], "total": 0, "error": str(exc)}

    if data.get("query_status") != "ok" or not data.get("data"):
        return {"iocs": [], "total": 0}

    raw_iocs = data["data"]
    iocs = []
    for ioc in raw_iocs:
        iocs.append({
            "id": ioc.get("id"),
            "ioc": ioc.get("ioc"),
            "ioc_type": ioc.get("ioc_type"),
            "threat_type": ioc.get("threat_type"),
            "malware": ioc.get("malware_printable"),
            "confidence_level": ioc.get("confidence_level", 0),
            "first_seen": _to_sgt(ioc.get("first_seen") or ioc.get("first_seen_utc")),
            "last_seen": _to_sgt(ioc.get("last_seen") or ioc.get("last_seen_utc")),
            "reference": ioc.get("reference"),
            "reporter": ioc.get("reporter"),
            "tags": ioc.get("tags") or [],
        })

    # Cache the full result, slice for response
    _set_cached(days, iocs)
    sliced = iocs[:limit]
    return {"iocs": sliced, "total": len(sliced)}


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
            "first_seen": _to_sgt(ioc.get("first_seen") or ioc.get("first_seen_utc")),
            "last_seen": _to_sgt(ioc.get("last_seen") or ioc.get("last_seen_utc")),
            "reference": ioc.get("reference"),
            "reporter": ioc.get("reporter"),
            "tags": ioc.get("tags") or [],
        })

    return {"results": results}
