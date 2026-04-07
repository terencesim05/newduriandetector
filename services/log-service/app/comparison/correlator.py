"""Correlate alerts from two IDS engines on the same traffic.

Two alerts are considered the "same event" if they share:
    (src_ip, dst_ip, dst_port, protocol, 1-second timestamp bucket)

This is a strict key — it favors precision over recall. A looser key
(e.g. dropping the timestamp bucket) would catch more "agreements"
but introduce false matches between unrelated alerts on the same flow.
"""

from datetime import datetime
from typing import Any

SEVERITY_RANK = {"low": 1, "medium": 2, "high": 3, "critical": 4}


def _bucket(ts: str) -> int:
    """Round an ISO timestamp to the nearest second (epoch int)."""
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return int(dt.timestamp())
    except Exception:
        return 0


def _key(alert: dict) -> tuple:
    return (
        alert.get("src_ip"),
        alert.get("dst_ip"),
        alert.get("dst_port"),
        alert.get("protocol"),
        _bucket(alert.get("timestamp", "")),
    )


def correlate(snort_alerts: list[dict], suricata_alerts: list[dict]) -> dict[str, Any]:
    snort_by_key: dict[tuple, dict] = {}
    for a in snort_alerts:
        snort_by_key.setdefault(_key(a), a)

    suricata_by_key: dict[tuple, dict] = {}
    for a in suricata_alerts:
        suricata_by_key.setdefault(_key(a), a)

    both_keys = set(snort_by_key) & set(suricata_by_key)
    snort_only_keys = set(snort_by_key) - set(suricata_by_key)
    suricata_only_keys = set(suricata_by_key) - set(snort_by_key)

    matched: list[dict] = []
    severity_disagreements = 0

    for k in both_keys:
        s = snort_by_key[k]
        u = suricata_by_key[k]
        sev_disagrees = (
            SEVERITY_RANK.get(s.get("severity", "").lower(), 0)
            != SEVERITY_RANK.get(u.get("severity", "").lower(), 0)
        )
        if sev_disagrees:
            severity_disagreements += 1
        matched.append({
            "agreement": "both",
            "snort": s,
            "suricata": u,
            "severity_disagrees": sev_disagrees,
        })

    for k in snort_only_keys:
        matched.append({
            "agreement": "snort_only",
            "snort": snort_by_key[k],
            "suricata": None,
            "severity_disagrees": False,
        })

    for k in suricata_only_keys:
        matched.append({
            "agreement": "suricata_only",
            "snort": None,
            "suricata": suricata_by_key[k],
            "severity_disagrees": False,
        })

    # Sort by timestamp of whichever side has data, for stable display
    def sort_key(pair):
        a = pair["snort"] or pair["suricata"]
        return a.get("timestamp", "")

    matched.sort(key=sort_key)

    return {
        "snort_count": len(snort_alerts),
        "suricata_count": len(suricata_alerts),
        "agreement_count": len(both_keys),
        "snort_only_count": len(snort_only_keys),
        "suricata_only_count": len(suricata_only_keys),
        "severity_disagreement_count": severity_disagreements,
        "matched_pairs": matched,
    }
