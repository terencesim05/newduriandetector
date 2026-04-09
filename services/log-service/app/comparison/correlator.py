"""Correlate alerts from three IDS engines (Snort, Suricata, Zeek) on the same traffic.

Two alerts are considered the "same event" if they share:
    (src_ip, dst_ip, dst_port, protocol, 1-second timestamp bucket)

This is a strict key — it favors precision over recall.
"""

from datetime import datetime
from typing import Any

SEVERITY_RANK = {"low": 1, "medium": 2, "high": 3, "critical": 4}

ENGINES = ("snort", "suricata", "zeek")


def _bucket(ts) -> int:
    """Round a timestamp to the nearest second (epoch int).
    Accepts ISO string or datetime object."""
    try:
        if isinstance(ts, datetime):
            return int(ts.timestamp())
        dt = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        return int(dt.timestamp())
    except Exception:
        return 0


def _key(alert: dict) -> tuple:
    return (
        alert.get("src_ip"),
        alert.get("dst_ip"),
        alert.get("dst_port"),
        (alert.get("protocol") or "").upper(),
        _bucket(alert.get("timestamp", "")),
    )


def _agreement_label(engines: set[str]) -> str:
    """Return a human-readable label for which engines detected the event."""
    if engines == {"snort", "suricata", "zeek"}:
        return "all_three"
    if len(engines) == 2:
        return "+".join(sorted(engines))
    return f"{next(iter(engines))}_only"


def correlate(
    snort_alerts: list[dict],
    suricata_alerts: list[dict],
    zeek_alerts: list[dict],
) -> dict[str, Any]:
    # Index alerts by match key, per engine
    by_engine: dict[str, dict[tuple, dict]] = {
        "snort": {},
        "suricata": {},
        "zeek": {},
    }
    for a in snort_alerts:
        by_engine["snort"].setdefault(_key(a), a)
    for a in suricata_alerts:
        by_engine["suricata"].setdefault(_key(a), a)
    for a in zeek_alerts:
        by_engine["zeek"].setdefault(_key(a), a)

    # Collect all unique event keys
    all_keys = set()
    for engine_map in by_engine.values():
        all_keys |= engine_map.keys()

    # Classify each event
    matched: list[dict] = []
    counts = {
        "all_three": 0,
        "snort+suricata": 0,
        "snort+zeek": 0,
        "suricata+zeek": 0,
        "snort_only": 0,
        "suricata_only": 0,
        "zeek_only": 0,
    }
    severity_disagreements = 0

    for k in all_keys:
        detected_by = set()
        pair = {"snort": None, "suricata": None, "zeek": None}
        for engine in ENGINES:
            if k in by_engine[engine]:
                detected_by.add(engine)
                pair[engine] = by_engine[engine][k]

        agreement = _agreement_label(detected_by)
        counts[agreement] = counts.get(agreement, 0) + 1

        # Check severity disagreement (only if 2+ engines detected it)
        sev_disagrees = False
        if len(detected_by) >= 2:
            severities = set()
            for engine in detected_by:
                sev = (pair[engine].get("severity") or "").lower()
                if sev in SEVERITY_RANK:
                    severities.add(SEVERITY_RANK[sev])
            if len(severities) > 1:
                sev_disagrees = True
                severity_disagreements += 1

        matched.append({
            "agreement": agreement,
            "detected_by": sorted(detected_by),
            "snort": pair["snort"],
            "suricata": pair["suricata"],
            "zeek": pair["zeek"],
            "severity_disagrees": sev_disagrees,
        })

    # Sort by timestamp for stable display
    def sort_key(p):
        a = p["snort"] or p["suricata"] or p["zeek"]
        return a.get("timestamp", "")
    matched.sort(key=sort_key)

    return {
        "snort_count": len(snort_alerts),
        "suricata_count": len(suricata_alerts),
        "zeek_count": len(zeek_alerts),
        "all_three_count": counts.get("all_three", 0),
        "snort_suricata_count": counts.get("snort+suricata", 0),
        "snort_zeek_count": counts.get("snort+zeek", 0),
        "suricata_zeek_count": counts.get("suricata+zeek", 0),
        "snort_only_count": counts.get("snort_only", 0),
        "suricata_only_count": counts.get("suricata_only", 0),
        "zeek_only_count": counts.get("zeek_only", 0),
        "severity_disagreement_count": severity_disagreements,
        "matched_pairs": matched,
    }
