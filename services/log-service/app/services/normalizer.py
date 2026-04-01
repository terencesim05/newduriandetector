"""Convert raw IDS-specific alerts into the normalised AlertIngest schema."""

from datetime import datetime, timezone
from app.schemas.alert import (
    AlertIngest,
    SuricataAlert,
    ZeekAlert,
    SnortAlert,
    KismetAlert,
)
from app.models.alert import Severity, Category, IDSSource

# --- Severity mapping helpers ---

_SURICATA_SEV_MAP = {1: Severity.CRITICAL, 2: Severity.HIGH, 3: Severity.MEDIUM}
_SNORT_PRIORITY_MAP = {1: Severity.CRITICAL, 2: Severity.HIGH, 3: Severity.MEDIUM}

_CATEGORY_KEYWORDS: dict[str, Category] = {
    "sql": Category.SQL_INJECTION,
    "injection": Category.SQL_INJECTION,
    "ddos": Category.DDOS,
    "dos": Category.DDOS,
    "flood": Category.DDOS,
    "malware": Category.MALWARE,
    "trojan": Category.MALWARE,
    "virus": Category.MALWARE,
    "brute": Category.BRUTE_FORCE,
    "login": Category.BRUTE_FORCE,
    "scan": Category.PORT_SCAN,
    "xss": Category.XSS,
    "script": Category.XSS,
    "command": Category.COMMAND_INJECTION,
    "privilege": Category.PRIVILEGE_ESCALATION,
    "escalation": Category.PRIVILEGE_ESCALATION,
    "exfil": Category.DATA_EXFILTRATION,
    "anomal": Category.ANOMALY,
}


def _guess_category(text: str) -> Category:
    lower = text.lower()
    for keyword, cat in _CATEGORY_KEYWORDS.items():
        if keyword in lower:
            return cat
    return Category.OTHER


def _parse_ts(ts_str: str) -> datetime:
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(ts_str, fmt)
        except ValueError:
            continue
    return datetime.now(timezone.utc)


def normalize_suricata(raw: SuricataAlert) -> AlertIngest:
    alert_block = raw.alert or {}
    sev_num = alert_block.get("severity", 3)
    severity = _SURICATA_SEV_MAP.get(sev_num, Severity.LOW)
    msg = alert_block.get("signature", "") or alert_block.get("category", "")
    return AlertIngest(
        severity=severity,
        category=_guess_category(msg),
        source_ip=raw.src_ip,
        destination_ip=raw.dest_ip,
        source_port=raw.src_port,
        destination_port=raw.dest_port,
        protocol=raw.proto,
        ids_source=IDSSource.SURICATA,
        raw_data=raw.model_dump(),
        detected_at=_parse_ts(raw.timestamp),
    )


def normalize_zeek(raw: ZeekAlert) -> AlertIngest:
    severity = Severity.MEDIUM
    note_lower = raw.note.lower()
    if "critical" in note_lower or "attack" in note_lower:
        severity = Severity.CRITICAL
    elif "notice" in note_lower:
        severity = Severity.LOW
    return AlertIngest(
        severity=severity,
        category=_guess_category(raw.note + " " + raw.msg),
        source_ip=raw.id_orig_h,
        destination_ip=raw.id_resp_h,
        source_port=raw.id_orig_p,
        destination_port=raw.id_resp_p,
        protocol=raw.proto,
        ids_source=IDSSource.ZEEK,
        raw_data=raw.model_dump(by_alias=True),
        detected_at=datetime.fromtimestamp(raw.ts, tz=timezone.utc),
    )


def normalize_snort(raw: SnortAlert) -> AlertIngest:
    severity = _SNORT_PRIORITY_MAP.get(raw.priority, Severity.LOW)
    return AlertIngest(
        severity=severity,
        category=_guess_category(raw.classtype + " " + raw.msg),
        source_ip=raw.src,
        destination_ip=raw.dst,
        source_port=raw.sport,
        destination_port=raw.dport,
        protocol=raw.proto,
        ids_source=IDSSource.SNORT,
        raw_data=raw.model_dump(),
        detected_at=_parse_ts(raw.timestamp),
    )


def normalize_kismet(raw: KismetAlert) -> AlertIngest:
    text = raw.kismet_alert_header + " " + raw.kismet_alert_text
    return AlertIngest(
        severity=Severity.MEDIUM,
        category=_guess_category(text),
        source_ip=raw.kismet_alert_source_mac,
        destination_ip=raw.kismet_alert_dest_mac,
        source_port=None,
        destination_port=None,
        protocol="802.11",
        ids_source=IDSSource.KISMET,
        raw_data=raw.model_dump(),
        detected_at=datetime.fromtimestamp(raw.kismet_alert_timestamp, tz=timezone.utc)
        if raw.kismet_alert_timestamp
        else datetime.now(timezone.utc),
    )
