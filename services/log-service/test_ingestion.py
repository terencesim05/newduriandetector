"""
Test script — sends 10 mock IDS alerts to the log ingestion service.

Usage:
    python test_ingestion.py              # uses a dummy JWT
    python test_ingestion.py <jwt_token>  # uses a real JWT from auth-service
"""

import sys
import httpx
from datetime import datetime, timezone

BASE = "http://localhost:8001"

# Build a dummy HS256 JWT when none is supplied
def _make_dummy_token() -> str:
    from jose import jwt
    payload = {"user_id": 1, "sub": "testuser", "tier": "FREE", "team_id": None}
    return jwt.encode(payload, "abasdadasd1234asd", algorithm="HS256")


TOKEN = sys.argv[1] if len(sys.argv) > 1 else _make_dummy_token()
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

now = datetime.now(timezone.utc).isoformat()

payload = {
    "alerts": [
        {
            "severity": "CRITICAL",
            "category": "SQL_INJECTION",
            "source_ip": "192.168.1.100",
            "destination_ip": "10.0.0.5",
            "source_port": 44312,
            "destination_port": 3306,
            "protocol": "TCP",
            "ids_source": "suricata",
            "detected_at": now,
        },
        {
            "severity": "HIGH",
            "category": "BRUTE_FORCE",
            "source_ip": "203.0.113.42",
            "destination_ip": "10.0.0.10",
            "source_port": 55123,
            "destination_port": 22,
            "protocol": "TCP",
            "ids_source": "snort",
            "detected_at": now,
        },
        {
            "severity": "MEDIUM",
            "category": "PORT_SCAN",
            "source_ip": "198.51.100.77",
            "destination_ip": "10.0.0.1",
            "source_port": 61000,
            "destination_port": 80,
            "protocol": "TCP",
            "ids_source": "zeek",
            "detected_at": now,
        },
        {
            "severity": "LOW",
            "category": "ANOMALY",
            "source_ip": "172.16.0.5",
            "destination_ip": "10.0.0.20",
            "source_port": 12345,
            "destination_port": 443,
            "protocol": "TCP",
            "ids_source": "zeek",
            "detected_at": now,
        },
        {
            "severity": "CRITICAL",
            "category": "MALWARE",
            "source_ip": "10.10.10.10",
            "destination_ip": "10.0.0.5",
            "source_port": 8080,
            "destination_port": 443,
            "protocol": "TCP",
            "ids_source": "suricata",
            "detected_at": now,
        },
        {
            "severity": "HIGH",
            "category": "COMMAND_INJECTION",
            "source_ip": "10.20.30.40",
            "destination_ip": "10.0.0.8",
            "source_port": 9090,
            "destination_port": 8443,
            "protocol": "TCP",
            "ids_source": "snort",
            "detected_at": now,
        },
    ],
    "suricata_alerts": [
        {
            "timestamp": now,
            "src_ip": "192.168.2.50",
            "dest_ip": "10.0.0.5",
            "src_port": 39210,
            "dest_port": 80,
            "proto": "TCP",
            "alert": {"severity": 1, "signature": "ET MALWARE Possible Trojan download"},
        },
    ],
    "snort_alerts": [
        {
            "timestamp": now,
            "src": "203.0.113.99",
            "dst": "10.0.0.10",
            "sport": 40001,
            "dport": 3389,
            "proto": "TCP",
            "classtype": "attempted-admin",
            "priority": 1,
            "msg": "BRUTE FORCE RDP login attempt",
        },
    ],
    "zeek_alerts": [
        {
            "ts": datetime.now(timezone.utc).timestamp(),
            "id.orig_h": "198.51.100.200",
            "id.resp_h": "10.0.0.1",
            "id.orig_p": 50100,
            "id.resp_p": 53,
            "proto": "UDP",
            "note": "DNS::External_Query_Anomaly",
            "msg": "Unusual DNS exfiltration pattern detected",
        },
    ],
    "kismet_alerts": [
        {
            "kismet_device_base_name": "Rogue_AP",
            "kismet_alert_header": "DEAUTHFLOOD",
            "kismet_alert_text": "Deauthentication flood attack detected",
            "kismet_alert_timestamp": datetime.now(timezone.utc).timestamp(),
            "kismet_alert_source_mac": "AA:BB:CC:DD:EE:FF",
            "kismet_alert_dest_mac": "11:22:33:44:55:66",
        },
    ],
}


def main():
    print(f"Sending 10 alerts to {BASE}/api/logs/ingest ...")
    resp = httpx.post(f"{BASE}/api/logs/ingest", json=payload, headers=HEADERS, timeout=15)
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.json()}")

    print(f"\nFetching alerts from {BASE}/api/alerts ...")
    resp2 = httpx.get(f"{BASE}/api/alerts", headers=HEADERS, timeout=15)
    print(f"Status: {resp2.status_code}")
    data = resp2.json()
    print(f"Total alerts: {data.get('total', '?')}")
    for a in data.get("alerts", [])[:5]:
        print(f"  [{a['severity']}] {a['category']} — {a['source_ip']} -> {a['destination_ip']} (score: {a['threat_score']})")


if __name__ == "__main__":
    main()
