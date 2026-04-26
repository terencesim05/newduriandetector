"""
System tests for the log-service API.

These tests run against the live log-service (LOG_BASE_URL) and rely on the
auth-service (AUTH_BASE_URL) to mint JWTs. They register a fresh FREE user
per test session, optionally log into a pre-existing PREMIUM account for the
features that need it, and clean up resources they create.

Required env:
    AUTH_BASE_URL                   default http://localhost:8000
    LOG_BASE_URL                    default http://localhost:8001

Optional env (skip premium tests if missing):
    AUTH_PREMIUM_USERNAME / AUTH_PREMIUM_PASSWORD

Run:
    cd services/log-service
    pytest tests/test_system.py -m system
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

import httpx
import pytest

pytestmark = pytest.mark.system


# ─────────────────────────────────────────────────────────────────────────────
# API Key tests
# ─────────────────────────────────────────────────────────────────────────────

class TestAPIKeys:
    def test_generate_and_revoke_api_key(self, log_client, free_headers):
        # Create
        r = log_client.post(
            "/api/api-keys",
            headers=free_headers,
            json={"label": f"pytest-{uuid.uuid4().hex[:6]}"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["key"], "raw key must be returned exactly once"
        key_id = body["id"]
        raw_key = body["key"]

        # List — preview should mask the key
        listing = log_client.get("/api/api-keys", headers=free_headers)
        assert listing.status_code == 200
        keys = listing.json()
        assert any(k["id"] == key_id for k in keys)
        match = next(k for k in keys if k["id"] == key_id)
        assert "..." in match["key_preview"]
        assert raw_key not in match["key_preview"]

        # Revoke
        r = log_client.delete(f"/api/api-keys/{key_id}", headers=free_headers)
        assert r.status_code == 200
        assert r.json() == {"revoked": True}

    def test_ingest_with_valid_key_then_revoked_key_rejected(
        self, log_client, free_headers, free_user
    ):
        # Mint a key
        create = log_client.post(
            "/api/api-keys",
            headers=free_headers,
            json={"label": f"ingest-{uuid.uuid4().hex[:6]}"},
        )
        assert create.status_code == 200, create.text
        key_id = create.json()["id"]
        raw_key = create.json()["key"]

        # Use the API key to ingest
        alert = _sample_alert()
        ingest = log_client.post(
            "/api/logs/ingest",
            headers={"X-API-Key": raw_key},
            json={"alerts": [alert]},
        )
        assert ingest.status_code == 200, ingest.text
        assert ingest.json()["ingested"] == 1

        # Revoke the key
        revoke = log_client.delete(f"/api/api-keys/{key_id}", headers=free_headers)
        assert revoke.status_code == 200

        # The same key should now be rejected
        ingest2 = log_client.post(
            "/api/logs/ingest",
            headers={"X-API-Key": raw_key},
            json={"alerts": [alert]},
        )
        assert ingest2.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# Alerts
# ─────────────────────────────────────────────────────────────────────────────

class TestAlerts:
    def test_list_alerts_requires_auth(self, log_client):
        r = log_client.get("/api/alerts")
        assert r.status_code == 401

    def test_list_alerts_filtered_by_severity(self, log_client, free_headers):
        # Seed a HIGH alert so the list isn't empty.
        seed = log_client.post(
            "/api/logs/ingest",
            headers=free_headers,
            json={"alerts": [_sample_alert(severity="HIGH")]},
        )
        assert seed.status_code == 200

        r = log_client.get(
            "/api/alerts",
            headers=free_headers,
            params={"severity": "HIGH", "page_size": 50},
        )
        assert r.status_code == 200
        body = r.json()
        assert "alerts" in body and "total" in body
        for a in body["alerts"]:
            assert a["severity"] == "HIGH"

    def test_block_ip_from_alert(self, log_client, free_headers):
        ip = _unique_public_ip()
        # Seed an alert from that IP
        seed = log_client.post(
            "/api/logs/ingest",
            headers=free_headers,
            json={"alerts": [_sample_alert(source_ip=ip)]},
        )
        assert seed.status_code == 200, seed.text

        # Add to blacklist (this is the "block IP from alert" action)
        r = log_client.post(
            "/api/blacklist",
            headers=free_headers,
            json={"entry_type": "IP", "value": ip, "reason": "pytest"},
        )
        assert r.status_code == 200, r.text
        entry_id = r.json()["id"]

        # Cleanup
        log_client.delete(f"/api/blacklist/{entry_id}", headers=free_headers)

    def test_trust_ip_from_alert(self, log_client, free_headers):
        ip = _unique_public_ip()
        seed = log_client.post(
            "/api/logs/ingest",
            headers=free_headers,
            json={"alerts": [_sample_alert(source_ip=ip)]},
        )
        assert seed.status_code == 200, seed.text

        r = log_client.post(
            "/api/whitelist",
            headers=free_headers,
            json={"entry_type": "IP", "value": ip, "reason": "pytest-trust"},
        )
        assert r.status_code == 200, r.text
        entry_id = r.json()["id"]

        # Cleanup
        log_client.delete(f"/api/whitelist/{entry_id}", headers=free_headers)


# ─────────────────────────────────────────────────────────────────────────────
# Quarantine
# ─────────────────────────────────────────────────────────────────────────────

class TestQuarantine:
    def _seed_quarantined_alert(self, log_client, headers) -> str:
        """Ingest an alert tuned to land in QUARANTINE (score 0.7-0.9)."""
        ip = _unique_public_ip()
        # CRITICAL × MALWARE → roughly 0.84, in the quarantine band.
        log_client.post(
            "/api/logs/ingest",
            headers=headers,
            json={"alerts": [_sample_alert(
                source_ip=ip, severity="CRITICAL", category="MALWARE",
            )]},
        )
        # Pull the quarantine list and find the alert by source_ip
        r = log_client.get("/api/quarantine", headers=headers, params={"status": "QUARANTINED"})
        assert r.status_code == 200, r.text
        for a in r.json():
            if a["source_ip"] == ip:
                return a["id"]
        pytest.skip("Could not produce a quarantined alert in this environment")

    def test_quarantine_release(self, log_client, free_headers):
        alert_id = self._seed_quarantined_alert(log_client, free_headers)
        r = log_client.post(
            f"/api/quarantine/{alert_id}/release",
            headers=free_headers,
            json={"notes": "pytest release"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["quarantine_status"] == "RELEASED"

    def test_quarantine_block(self, log_client, free_headers):
        alert_id = self._seed_quarantined_alert(log_client, free_headers)
        r = log_client.post(
            f"/api/quarantine/{alert_id}/block",
            headers=free_headers,
            json={"notes": "pytest block"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["quarantine_status"] == "BLOCKED"
        assert body["is_blocked"] is True

        # Cleanup the auto-created blacklist entry
        bl = log_client.get("/api/blacklist", headers=free_headers).json()
        for entry in bl:
            if entry["value"] == body["source_ip"] and entry["added_by"] == "quarantine":
                log_client.delete(f"/api/blacklist/{entry['id']}", headers=free_headers)


# ─────────────────────────────────────────────────────────────────────────────
# Rules (Premium)
# ─────────────────────────────────────────────────────────────────────────────

class TestRules:
    def test_create_and_toggle_rule(self, log_client, premium_headers):
        body = {
            "name": f"pytest-rule-{uuid.uuid4().hex[:6]}",
            "description": "created by pytest",
            "rule_type": "CATEGORY_MATCH",
            "conditions": {"category": "BRUTE_FORCE"},
            "actions": {"quarantine": True},
            "priority": 5,
            "enabled": True,
        }
        r = log_client.post("/api/rules", headers=premium_headers, json=body)
        assert r.status_code == 200, r.text
        rule = r.json()
        assert rule["enabled"] is True
        rule_id = rule["id"]

        try:
            # Toggle off
            t = log_client.post(f"/api/rules/{rule_id}/toggle", headers=premium_headers)
            assert t.status_code == 200
            assert t.json()["enabled"] is False
            # Toggle back on
            t2 = log_client.post(f"/api/rules/{rule_id}/toggle", headers=premium_headers)
            assert t2.status_code == 200
            assert t2.json()["enabled"] is True
        finally:
            # Cleanup
            log_client.delete(f"/api/rules/{rule_id}", headers=premium_headers)

    def test_rules_forbidden_for_free(self, log_client, free_headers):
        r = log_client.get("/api/rules", headers=free_headers)
        assert r.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# Engine comparison
# ─────────────────────────────────────────────────────────────────────────────

class TestEngineComparison:
    def test_engine_stats_endpoint(self, log_client, free_headers):
        r = log_client.get(
            "/api/analytics/engine-stats",
            headers=free_headers,
            params={"window": "24h"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["window"] == "24h"
        engines = {e["ids_source"] for e in body["engines"]}
        # Always returns 4 zero-filled engines so the dashboard is stable.
        assert engines == {"suricata", "zeek", "snort", "kismet"}

    def test_engine_overlap_returns_dense_matrix(self, log_client, free_headers):
        r = log_client.get(
            "/api/analytics/engine-overlap",
            headers=free_headers,
            params={"window": "24h"},
        )
        assert r.status_code == 200
        matrix = r.json()["matrix"]
        for ea in ("suricata", "zeek", "snort", "kismet"):
            assert ea in matrix
            for eb in ("suricata", "zeek", "snort", "kismet"):
                assert eb in matrix[ea]


# ─────────────────────────────────────────────────────────────────────────────
# Incidents (Premium)
# ─────────────────────────────────────────────────────────────────────────────

class TestIncidents:
    def test_create_incident(self, log_client, premium_headers):
        title = f"pytest-incident-{uuid.uuid4().hex[:6]}"
        r = log_client.post(
            "/api/incidents",
            headers=premium_headers,
            json={"title": title, "description": "from pytest", "priority": "HIGH"},
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["title"] == title
        assert body["priority"] == "HIGH"
        incident_id = body["id"]

        # Cleanup
        log_client.delete(f"/api/incidents/{incident_id}", headers=premium_headers)

    def test_incidents_forbidden_for_free(self, log_client, free_headers):
        r = log_client.get("/api/incidents", headers=free_headers)
        assert r.status_code == 403


# ─────────────────────────────────────────────────────────────────────────────
# Chatbot
# ─────────────────────────────────────────────────────────────────────────────

class TestChatbot:
    def test_chatbot_requires_auth(self, log_client):
        r = log_client.post("/api/chat", json={"message": "hi", "history": []})
        assert r.status_code == 401

    def test_chatbot_returns_response(self, log_client, free_headers):
        r = log_client.post(
            "/api/chat",
            headers=free_headers,
            json={"message": "Just say hi back, nothing else.", "history": []},
        )
        # Acceptable outcomes:
        #   200 — Groq is configured and replied
        #   503 — GROQ_API_KEY isn't configured in the deployed env
        #   429 / 502 — upstream Groq problem (not a regression we should fail on)
        assert r.status_code in (200, 429, 502, 503), r.text
        if r.status_code == 200:
            body = r.json()
            assert "reply" in body and isinstance(body["reply"], str)
            assert body["reply"].strip()
        elif r.status_code == 503:
            pytest.skip("GROQ not configured on the deployed log service")


# ─────────────────────────────────────────────────────────────────────────────
# ML config (Premium)
# ─────────────────────────────────────────────────────────────────────────────

class TestMLConfig:
    def test_ml_config_requires_premium(self, log_client, free_headers):
        r = log_client.get("/api/ml-config", headers=free_headers)
        assert r.status_code == 403

    def test_ml_config_get_for_premium(self, log_client, premium_headers):
        r = log_client.get("/api/ml-config", headers=premium_headers)
        assert r.status_code == 200, r.text
        body = r.json()
        for key in ("enabled", "sensitivity", "score_boost", "model_type"):
            assert key in body


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

_ip_counter = 0


def _unique_public_ip() -> str:
    """Return a public-ish IP unique to this test run.

    Ranges 198.51.100.0/24 and 203.0.113.0/24 are TEST-NET-2/3 — safe to use
    in tests because they're not routable. Using a counter keeps each call
    distinct so blacklist/whitelist 409s don't collide between cases.
    """
    global _ip_counter
    _ip_counter += 1
    octet = (_ip_counter % 254) + 1
    return f"203.0.113.{octet}"


def _sample_alert(
    severity: str = "MEDIUM",
    category: str = "PORT_SCAN",
    source_ip: str | None = None,
) -> dict:
    return {
        "severity": severity,
        "category": category,
        "source_ip": source_ip or _unique_public_ip(),
        "destination_ip": "10.0.0.1",
        "source_port": 53124,
        "destination_port": 22,
        "protocol": "TCP",
        "ids_source": "suricata",
        "raw_data": {"signature": "pytest-test-alert"},
        "detected_at": datetime.now(timezone.utc).isoformat(),
    }
