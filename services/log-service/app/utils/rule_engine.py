"""Rule engine: evaluates custom rules against incoming alerts."""

import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser
from app.models.alert import Alert, QuarantineStatus
from app.models.rule import Rule, RuleType
from app.models.lists import BlacklistEntry
from app.utils.scoping import apply_scope

logger = logging.getLogger(__name__)


async def evaluate_rules(
    alert_row: Alert,
    user: CurrentUser,
    db: AsyncSession,
) -> Alert:
    """Run all enabled rules against a stored alert. Modifies alert_row in place."""

    q = apply_scope(select(Rule), Rule, user)
    q = q.where(Rule.enabled == True).order_by(Rule.priority.desc())
    result = await db.execute(q)
    rules = result.scalars().all()

    for rule in rules:
        matched = await _evaluate_single(rule, alert_row, user, db)
        if matched:
            rule.trigger_count += 1
            alert_row = _apply_actions(rule, alert_row, user, db)
            # First matching rule wins (highest priority)
            break

    return alert_row


async def _evaluate_single(
    rule: Rule,
    alert: Alert,
    user: CurrentUser,
    db: AsyncSession,
) -> bool:
    """Check if an alert matches a rule's conditions."""
    cond = rule.conditions or {}

    if rule.rule_type == RuleType.RATE_LIMIT:
        return await _eval_rate_limit(cond, alert, user, db)
    elif rule.rule_type == RuleType.CATEGORY_MATCH:
        return _eval_category_match(cond, alert)
    elif rule.rule_type == RuleType.FAILED_LOGIN:
        return await _eval_failed_login(cond, alert, user, db)
    return False


async def _eval_rate_limit(
    cond: dict, alert: Alert, user: CurrentUser, db: AsyncSession
) -> bool:
    """If same source_ip has > threshold alerts (optionally of a category) in time_window."""
    threshold = cond.get("threshold", 10)
    window_sec = cond.get("time_window_seconds", 300)
    category_filter = cond.get("category")

    cutoff = datetime.now(timezone.utc) - timedelta(seconds=window_sec)

    q = apply_scope(select(func.count()), Alert, user)
    q = q.where(Alert.source_ip == alert.source_ip, Alert.detected_at >= cutoff)
    if category_filter:
        q = q.where(Alert.category == category_filter)

    count = (await db.execute(q)).scalar() or 0
    return count >= threshold


def _eval_category_match(cond: dict, alert: Alert) -> bool:
    """Match if alert has the specified category and optionally severity."""
    cat = cond.get("category")
    sev = cond.get("severity")

    if cat and alert.category.value != cat:
        return False
    if sev and alert.severity.value != sev:
        return False
    return bool(cat or sev)


async def _eval_failed_login(
    cond: dict, alert: Alert, user: CurrentUser, db: AsyncSession
) -> bool:
    """If same source_ip has > threshold BRUTE_FORCE alerts in time_window."""
    threshold = cond.get("threshold", 5)
    window_sec = cond.get("time_window_seconds", 600)

    cutoff = datetime.now(timezone.utc) - timedelta(seconds=window_sec)

    q = apply_scope(select(func.count()), Alert, user)
    q = q.where(
        Alert.source_ip == alert.source_ip,
        Alert.category == "BRUTE_FORCE",
        Alert.detected_at >= cutoff,
    )

    count = (await db.execute(q)).scalar() or 0
    return count >= threshold


def _apply_actions(
    rule: Rule, alert: Alert, user: CurrentUser, db: AsyncSession
) -> Alert:
    """Execute rule actions on an alert."""
    actions = rule.actions or {}

    if actions.get("increase_threat_score"):
        boost = float(actions["increase_threat_score"])
        alert.threat_score = min(alert.threat_score + boost, 1.0)
        alert.threat_score = round(alert.threat_score, 3)

    if actions.get("quarantine") and alert.quarantine_status == QuarantineStatus.NONE:
        alert.quarantine_status = QuarantineStatus.QUARANTINED
        alert.quarantined_at = datetime.now(timezone.utc)

    if actions.get("auto_block"):
        alert.is_blocked = True
        alert.threat_score = 1.0
        # Auto-add to blacklist
        new_bl = BlacklistEntry(
            entry_type="IP",
            value=alert.source_ip,
            reason=f"Rule: {rule.name}",
            added_by="rule",
            user_id=user.user_id,
            team_id=user.team_id,
        )
        db.add(new_bl)

    # Store which rule triggered
    raw = alert.raw_data or {}
    raw["triggered_rule"] = {"id": str(rule.id), "name": rule.name}
    alert.raw_data = raw

    return alert
