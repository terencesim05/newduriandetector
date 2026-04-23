import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth import get_current_user, CurrentUser
from app.models.rule import Rule
from app.schemas.rule import RuleCreate, RuleUpdate, RuleOut
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


async def _get_rule(rule_id: uuid.UUID, user: CurrentUser, db: AsyncSession) -> Rule:
    q = apply_scope(select(Rule), Rule, user).where(Rule.id == rule_id)
    result = await db.execute(q)
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return rule
