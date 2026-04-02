"""
GeoIP lookup using ip-api.com (free, no API key needed).
In-memory cache to avoid repeated lookups.
"""

import time
import logging
import httpx

logger = logging.getLogger(__name__)

GEOIP_API = "http://ip-api.com/json/"
CACHE_TTL = 86400  # 24 hours
BATCH_API = "http://ip-api.com/batch"

# In-memory cache: ip -> (timestamp, result_or_none)
_cache: dict[str, tuple[float, dict | None]] = {}


def _is_private_ip(ip: str) -> bool:
    parts = ip.split(".")
    if len(parts) != 4:
        return True
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


async def lookup_ip_location(ip: str) -> dict | None:
    """
    Look up geographic location of an IP address.
    Returns {"latitude": float, "longitude": float, "country": str, "city": str} or None.
    """
    if _is_private_ip(ip):
        return None

    now = time.time()
    if ip in _cache:
        cached_at, result = _cache[ip]
        if now - cached_at < CACHE_TTL:
            return result

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"{GEOIP_API}{ip}",
                params={"fields": "status,country,city,lat,lon"},
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.warning("GeoIP lookup failed for %s: %s", ip, exc)
        _cache[ip] = (now - CACHE_TTL + 300, None)  # retry in 5 min
        return None

    if data.get("status") != "success":
        _cache[ip] = (now, None)
        return None

    result = {
        "latitude": data.get("lat", 0.0),
        "longitude": data.get("lon", 0.0),
        "country": data.get("country", "Unknown"),
        "city": data.get("city", ""),
    }

    _cache[ip] = (now, result)
    return result
