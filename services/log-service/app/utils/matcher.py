"""IP / CIDR / domain matching for blacklist and whitelist checks."""

import ipaddress


def ip_in_cidr(ip: str, cidr: str) -> bool:
    try:
        return ipaddress.ip_address(ip) in ipaddress.ip_network(cidr, strict=False)
    except ValueError:
        return False


def matches_entry(ip: str, entry_type: str, entry_value: str) -> bool:
    """Check if an IP matches a list entry (IP, CIDR, or DOMAIN)."""
    if entry_type == "IP":
        return ip == entry_value
    elif entry_type == "CIDR":
        return ip_in_cidr(ip, entry_value)
    elif entry_type == "DOMAIN":
        # Domain matching only applies if the alert carries a domain — skip for raw IPs
        return ip == entry_value
    return False
