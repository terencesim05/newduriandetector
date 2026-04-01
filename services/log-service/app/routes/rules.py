import uuid
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user, CurrentUser
from app.models.rule import Rule
from app.models.alert import Alert
from app.schemas.rule import RuleCreate, RuleUpdate, RuleOut, RuleTestResult
from app.utils.scoping import apply_scope

router = APIRouter(prefix="/api/rules", tags=["rules"])


@router.get("", response_model=list[RuleOut])
async def list_rules(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = apply_scope(select(Rule), Rule, user).order_by(Rule.priority.desc())
    result = await db.execute(q)
    return [RuleOut.model_validate(r) for r in result.scalars().all()]


@router.post("", response_model=RuleOut)
async def create_rule(
    body: RuleCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = Rule(
        name=body.name,
        description=body.description,
        rule_type=body.rule_type,
        conditions=body.conditions,
        actions=body.actions,
        priority=body.priority,
        enabled=body.enabled,
        user_id=user.user_id,
        team_id=user.team_id,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return RuleOut.model_validate(rule)


@router.put("/{rule_id}", response_model=RuleOut)
async def update_rule(
    rule_id: uuid.UUID,
    body: RuleUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = await _get_rule(rule_id, user, db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(rule, field, value)
    await db.commit()
    await db.refresh(rule)
    return RuleOut.model_validate(rule)


@router.delete("/{rule_id}")
async def delete_rule(
    rule_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = await _get_rule(rule_id, user, db)
    await db.delete(rule)
    await db.commit()
    return {"deleted": True}


@router.post("/{rule_id}/toggle", response_model=RuleOut)
async def toggle_rule(
    rule_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rule = await _get_rule(rule_id, user, db)
    rule.enabled = not rule.enabled
    await db.commit()
    await db.refresh(rule)
    return RuleOut.model_validate(rule)


@router.post("/{rule_id}/test", response_model=RuleTestResult)
async def test_rule(
    rule_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Test a rule against the last 100 alerts to see how many would match."""
    rule = await _get_rule(rule_id, user, db)
    cond = rule.conditions or {}

    q = apply_scope(select(Alert), Alert, user)
    q = q.order_by(Alert.detected_at.desc()).limit(100)
    result = await db.execute(q)
    alerts = result.scalars().all()

    matched = []
    for alert in alerts:
        if _test_match(rule, cond, alert):
            matched.append({
                "id": str(alert.id),
                "source_ip": alert.source_ip,
                "category": alert.category.value,
                "severity": alert.severity.value,
                "threat_score": alert.threat_score,
                "detected_at": alert.detected_at.isoformat(),
            })

    return RuleTestResult(
        rule_id=rule.id,
        alerts_matched=len(matched),
        sample_matches=matched[:10],
    )


def _test_match(rule: Rule, cond: dict, alert: Alert) -> bool:
    """Simple non-async match check for test endpoint (no rate limit counting)."""
    if rule.rule_type.value == "CATEGORY_MATCH":
        cat = cond.get("category")
        sev = cond.get("severity")
        if cat and alert.category.value != cat:
            return False
        if sev and alert.severity.value != sev:
            return False
        return bool(cat or sev)
    elif rule.rule_type.value == "RATE_LIMIT":
        cat = cond.get("category")
        if cat:
            return alert.category.value == cat
        return True
    elif rule.rule_type.value == "FAILED_LOGIN":
        return alert.category.value == "BRUTE_FORCE"
    return False


async def _get_rule(rule_id: uuid.UUID, user: CurrentUser, db: AsyncSession) -> Rule:
    q = apply_scope(select(Rule), Rule, user).where(Rule.id == rule_id)
    result = await db.execute(q)
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule
