"""Multi-tenant scoping: EXCLUSIVE users share data by team, others by user_id."""

from app.auth import CurrentUser


def apply_scope(query, model, user: CurrentUser):
    """Filter a query by team_id (EXCLUSIVE) or user_id (FREE/PREMIUM)."""
    if user.tier == "EXCLUSIVE" and user.team_id:
        return query.where(model.team_id == user.team_id)
    return query.where(model.user_id == user.user_id)
