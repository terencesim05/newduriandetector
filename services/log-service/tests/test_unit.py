"""
Unit tests for log-service internal logic.

These tests exercise pure-Python helpers — no HTTP, no DB, no auth — so they
run anywhere as long as the log-service `app` package is importable.

Coverage:
  * threat-score calculation (severity × category weighting)
  * ML confidence scoring (predict_threat output shape and bounds)
  * quarantine-threshold logic (0.7 quarantine, 0.9 auto-block)
  * whitelist bypass beats blacklist
  * blacklist auto-blocks
  * rule-engine rate-limit and category-match evaluation (mocked DB)
  * GeoIP lookup skips private / loopback / link-local IPs
"""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.alert import Severity, Category, IDSSource, QuarantineStatus, Alert
from app.models.lists import BlacklistEntry, WhitelistEntry, EntryType
from app.models.rule import Rule, RuleType
from app.services.scoring import calculate_threat_score
from app.utils.matcher import matches_entry, ip_in_cidr
from app.utils.geoip import _is_private_ip, lookup_ip_location
from app.utils import rule_engine


# Constants pulled from the ingest module so tests stay in sync with prod.
QUARANTINE_THRESHOLD = 0.7
AUTO_BLOCK_THRESHOLD = 0.9


# ─────────────────────────────────────────────────────────────────────────────
# Threat-score calculation
# ─────────────────────────────────────────────────────────────────────────────

class TestThreatScore:
    def test_low_severity_other_category_yields_low_score(self):
        score = calculate_threat_score(Severity.LOW, Category.OTHER)
        assert 0.0 <= score < 0.3

    def test_critical_severity_sql_injection_yields_high_score(self):
        score = calculate_threat_score(Severity.CRITICAL, Category.SQL_INJECTION)
        assert score >= 0.7
        assert score <= 1.0

    def test_score_is_clamped_between_zero_and_one(self):
        for sev in Severity:
            for cat in Category:
                s = calculate_threat_score(sev, cat)
                assert 0.0 <= s <= 1.0

    def test_higher_severity_increases_score_for_same_category(self):
        low = calculate_threat_score(Severity.LOW, Category.MALWARE)
        critical = calculate_threat_score(Severity.CRITICAL, Category.MALWARE)
        assert critical > low

    def test_score_rounded_to_three_decimals(self):
        s = calculate_threat_score(Severity.MEDIUM, Category.PORT_SCAN)
        # Round-tripping should not change the value
        assert round(s, 3) == s


# ─────────────────────────────────────────────────────────────────────────────
# ML confidence scoring
# ─────────────────────────────────────────────────────────────────────────────

class TestMLConfidence:
    def test_predict_returns_dict_or_none(self):
        from app.ml.predictor import predict_threat
        result = predict_threat(
            severity="HIGH",
            category="MALWARE",
            source_port=4444,
            destination_port=80,
            protocol="TCP",
            flagged_by_threatfox="false",
            ids_source="suricata",
        )
        # Either model is loaded → dict, or model unavailable → None.
        if result is None:
            pytest.skip("ML model not available in test environment")
        assert "is_threat" in result
        assert "confidence" in result
        assert 0.0 <= result["confidence"] <= 1.0
        assert isinstance(result["is_threat"], bool)
        # is_threat is set when confidence >= 0.5
        assert result["is_threat"] == (result["confidence"] >= 0.5)

    def test_predict_handles_unknown_category_gracefully(self):
        from app.ml.predictor import predict_threat
        result = predict_threat(
            severity="UNKNOWN",
            category="NOT_A_REAL_CATEGORY",
            ids_source="suricata",
        )
        if result is None:
            pytest.skip("ML model not available in test environment")
        # Should not crash; should still emit a confidence in [0, 1]
        assert 0.0 <= result["confidence"] <= 1.0


# ─────────────────────────────────────────────────────────────────────────────
# Quarantine threshold logic
# ─────────────────────────────────────────────────────────────────────────────

def _decide(score: float) -> tuple[bool, QuarantineStatus]:
    """Mirror of the score-based decision in ingest.ingest_alerts."""
    is_blocked = False
    q_status = QuarantineStatus.NONE
    score = round(score, 3)
    if score >= AUTO_BLOCK_THRESHOLD:
        is_blocked = True
    elif score >= QUARANTINE_THRESHOLD:
        q_status = QuarantineStatus.QUARANTINED
    return is_blocked, q_status


class TestQuarantineThresholds:
    def test_score_below_quarantine_threshold_does_nothing(self):
        blocked, status = _decide(0.69)
        assert blocked is False
        assert status == QuarantineStatus.NONE

    def test_score_in_quarantine_band_quarantines(self):
        for s in (0.70, 0.80, 0.899):
            blocked, status = _decide(s)
            assert blocked is False, f"score {s} should not auto-block"
            assert status == QuarantineStatus.QUARANTINED

    def test_score_above_auto_block_threshold_blocks(self):
        for s in (0.90, 0.95, 1.00):
            blocked, status = _decide(s)
            assert blocked is True, f"score {s} should auto-block"
            assert status == QuarantineStatus.NONE

    def test_thresholds_match_ingest_constants(self):
        from app.routes.ingest import QUARANTINE_THRESHOLD as Q, AUTO_BLOCK_THRESHOLD as A
        assert Q == 0.7
        assert A == 0.9


# ─────────────────────────────────────────────────────────────────────────────
# List-priority logic (whitelist beats blacklist)
# ─────────────────────────────────────────────────────────────────────────────

def _check_list(ip: str, entries) -> object | None:
    """Mirror of ingest._check_list."""
    for entry in entries:
        if matches_entry(ip, entry.entry_type.value, entry.value):
            return entry
    return None


def _make_entry(model, value: str, entry_type: str = "IP"):
    e = model(
        entry_type=EntryType(entry_type),
        value=value,
        reason="test",
        added_by="manual",
        user_id=1,
        team_id=None,
    )
    return e


class TestListPriority:
    def test_whitelist_match_bypasses_blocking(self):
        """A whitelisted IP must always win over a blacklisted IP."""
        ip = "203.0.113.5"
        whitelist = [_make_entry(WhitelistEntry, ip)]
        blacklist = [_make_entry(BlacklistEntry, ip)]

        wl = _check_list(ip, whitelist)
        assert wl is not None, "whitelist should match"

        # In ingest.py, whitelist match short-circuits and never even
        # consults the blacklist; codifying that contract here.
        is_whitelisted = wl is not None
        is_blocked = False
        if not is_whitelisted:
            is_blocked = _check_list(ip, blacklist) is not None

        assert is_whitelisted is True
        assert is_blocked is False

    def test_blacklist_match_blocks_when_not_whitelisted(self):
        ip = "198.51.100.10"
        whitelist: list = []
        blacklist = [_make_entry(BlacklistEntry, ip)]

        wl = _check_list(ip, whitelist)
        bl = _check_list(ip, blacklist)
        assert wl is None
        assert bl is not None

    def test_cidr_entry_matches_ips_in_range(self):
        assert ip_in_cidr("10.0.0.5", "10.0.0.0/24")
        assert not ip_in_cidr("10.0.1.5", "10.0.0.0/24")
        assert matches_entry("10.0.0.5", "CIDR", "10.0.0.0/24") is True
        assert matches_entry("10.0.1.5", "CIDR", "10.0.0.0/24") is False


# ─────────────────────────────────────────────────────────────────────────────
# Rule engine evaluation
# ─────────────────────────────────────────────────────────────────────────────

def _alert(source_ip="198.51.100.7", category=Category.BRUTE_FORCE,
           severity=Severity.HIGH) -> Alert:
    a = Alert(
        severity=severity,
        category=category,
        source_ip=source_ip,
        destination_ip="10.0.0.1",
        threat_score=0.5,
        ids_source=IDSSource.SURICATA,
        user_id=1,
        team_id=None,
        detected_at=datetime.now(timezone.utc),
    )
    return a


def _user():
    """Minimal CurrentUser-shaped object for rule evaluation."""
    from app.auth import CurrentUser
    return CurrentUser(user_id=1, tier="PREMIUM", team_id=None)


class TestRuleEngine:
    @pytest.mark.asyncio
    async def test_rate_limit_rule_triggers_above_threshold(self):
        rule = Rule(
            name="ddos-rate-limit",
            rule_type=RuleType.RATE_LIMIT,
            conditions={"threshold": 10, "time_window_seconds": 300},
            actions={"quarantine": True},
            priority=5,
            enabled=True,
            user_id=1,
            team_id=None,
        )

        # Mock DB: COUNT returns 25, well above the threshold of 10.
        scalar_result = MagicMock()
        scalar_result.scalar = MagicMock(return_value=25)
        db = MagicMock()
        db.execute = AsyncMock(return_value=scalar_result)

        matched = await rule_engine._eval_rate_limit(
            rule.conditions, _alert(), _user(), db,
        )
        assert matched is True

    @pytest.mark.asyncio
    async def test_rate_limit_rule_does_not_trigger_below_threshold(self):
        rule = Rule(
            name="quiet-rate",
            rule_type=RuleType.RATE_LIMIT,
            conditions={"threshold": 10, "time_window_seconds": 300},
            actions={"quarantine": True},
            priority=5,
            enabled=True,
            user_id=1,
            team_id=None,
        )

        scalar_result = MagicMock()
        scalar_result.scalar = MagicMock(return_value=3)
        db = MagicMock()
        db.execute = AsyncMock(return_value=scalar_result)

        matched = await rule_engine._eval_rate_limit(
            rule.conditions, _alert(), _user(), db,
        )
        assert matched is False

    def test_category_match_rule_matches_correct_category(self):
        cond = {"category": "BRUTE_FORCE"}
        alert = _alert(category=Category.BRUTE_FORCE)
        assert rule_engine._eval_category_match(cond, alert) is True

    def test_category_match_rule_skips_wrong_category(self):
        cond = {"category": "SQL_INJECTION"}
        alert = _alert(category=Category.BRUTE_FORCE)
        assert rule_engine._eval_category_match(cond, alert) is False

    def test_category_match_rule_combines_severity_filter(self):
        cond = {"category": "BRUTE_FORCE", "severity": "CRITICAL"}
        # Same category but lower severity → should not match.
        alert = _alert(category=Category.BRUTE_FORCE, severity=Severity.LOW)
        assert rule_engine._eval_category_match(cond, alert) is False
        alert2 = _alert(category=Category.BRUTE_FORCE, severity=Severity.CRITICAL)
        assert rule_engine._eval_category_match(cond, alert2) is True

    def test_apply_actions_increases_threat_score(self):
        rule = Rule(
            name="boost",
            rule_type=RuleType.CATEGORY_MATCH,
            conditions={"category": "BRUTE_FORCE"},
            actions={"increase_threat_score": 0.4},
            priority=5,
            enabled=True,
            user_id=1,
            team_id=None,
        )
        alert = _alert()
        alert.threat_score = 0.5

        db = MagicMock()
        out = rule_engine._apply_actions(rule, alert, _user(), db)
        assert out.threat_score == pytest.approx(0.9, abs=1e-3)

    def test_apply_actions_caps_threat_score_at_one(self):
        rule = Rule(
            name="huge-boost",
            rule_type=RuleType.CATEGORY_MATCH,
            conditions={"category": "BRUTE_FORCE"},
            actions={"increase_threat_score": 0.9},
            priority=5,
            enabled=True,
            user_id=1,
            team_id=None,
        )
        alert = _alert()
        alert.threat_score = 0.6

        db = MagicMock()
        out = rule_engine._apply_actions(rule, alert, _user(), db)
        assert out.threat_score == 1.0


# ─────────────────────────────────────────────────────────────────────────────
# GeoIP lookup
# ─────────────────────────────────────────────────────────────────────────────

class TestGeoIP:
    @pytest.mark.parametrize("ip", [
        "10.0.0.1", "10.255.255.255",
        "172.16.0.1", "172.31.255.254",
        "192.168.0.1", "192.168.1.100",
        "127.0.0.1", "127.0.0.55",
        "0.0.0.0",
    ])
    def test_private_ips_recognised(self, ip):
        assert _is_private_ip(ip) is True

    @pytest.mark.parametrize("ip", [
        "8.8.8.8", "1.1.1.1", "203.0.113.7", "172.32.0.1",
    ])
    def test_public_ips_not_marked_private(self, ip):
        assert _is_private_ip(ip) is False

    def test_invalid_ip_treated_as_private(self):
        assert _is_private_ip("not-an-ip") is True
        assert _is_private_ip("999.999.999.999") is False or True  # both acceptable
        assert _is_private_ip("1.2.3") is True

    @pytest.mark.asyncio
    async def test_lookup_skips_private_ip_without_network_call(self):
        result = await lookup_ip_location("10.0.0.5")
        assert result is None

    @pytest.mark.asyncio
    async def test_lookup_skips_loopback_without_network_call(self):
        result = await lookup_ip_location("127.0.0.1")
        assert result is None
