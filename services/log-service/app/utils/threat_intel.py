"""ThreatFox API integration with 24-hour in-memory cache."""

import time
import logging
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

THREATFOX_API = "https://threatfox-api.abuse.ch/api/v1/"
CACHE_TTL = 86400  # 24 hours

# In-memory cache: ip -> (timestamp, result_or_none)
_cache: dict[str, tuple[float, dict | None]] = {}


def _is_private_ip(ip: str) -> bool:
    """Skip lookups for private/reserved IPs — ThreatFox only tracks public IOCs."""
    parts = ip.split(".")
    if len(parts) != 4:
        return True  # not a valid IPv4, skip
    try:
        first, second = int(parts[0]), int(parts[1])
    except ValueError:
        return True
    if first == 10:
        return True
    if first == 172 and 16 <= second <= 31:
        return True
    if first == 192 and second == 168:
        return True
    if first == 127:
        return True
    if first == 0:
        return True
    return False


async def check_ip_reputation(ip: str) -> dict | None:
    """
    Query ThreatFox for an IP. Returns threat data dict or None if clean.

    Result format:
    {
        "threat_type": "botnet_cc",
        "malware": "Cobalt Strike",
        "confidence_level": 75,
        "first_seen": "2024-01-15",
        "last_seen": "2024-03-20",
        "reference": "https://threatfox.abuse.ch/ioc/...",
        "tags": ["CobaltStrike", "C2"]
    }
    """
    if _is_private_ip(ip):
        return None

    # Check cache
    now = time.time()
    if ip in _cache:
        cached_at, result = _cache[ip]
        if now - cached_at < CACHE_TTL:
            return result

    if not settings.THREATFOX_AUTH_KEY:
        _cache[ip] = (now, None)
        return None

    try:
        headers = {"Auth-Key": settings.THREATFOX_AUTH_KEY}
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                THREATFOX_API,
                json={"query": "search_ioc", "search_term": ip},
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("ThreatFox lookup failed for %s: %s", ip, exc)
        # Cache the failure briefly (5 min) so we don't hammer the API
        _cache[ip] = (now - CACHE_TTL + 300, None)
        return None

    if data.get("query_status") != "ok" or not data.get("data"):
        _cache[ip] = (now, None)
        return None

    # Take the most recent IOC entry
    ioc = data["data"][0]
    result = {
        "threat_type": ioc.get("threat_type", "unknown"),
        "malware": ioc.get("malware_printable", "unknown"),
        "confidence_level": ioc.get("confidence_level", 0),
        "first_seen": ioc.get("first_seen_utc", ""),
        "last_seen": ioc.get("last_seen_utc", ""),
        "reference": ioc.get("reference", ""),
        "tags": ioc.get("tags") or [],
        "ioc_id": ioc.get("id", ""),
    }

    _cache[ip] = (now, result)
    return result
