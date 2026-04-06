"""JWT + API key authentication for the log service."""

from dataclasses import dataclass
from datetime import datetime, timezone
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    user_id: int
    tier: str            # FREE, PREMIUM, EXCLUSIVE
    team_id: str | None  # UUID string or None
    user_name: str = ""
    is_team_leader: bool = False
    is_admin: bool = False
    subscription_status: str = "active"


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> CurrentUser:
    # 1. Try API key from X-API-Key header
    api_key = request.headers.get("X-API-Key")
    if api_key:
        from app.models.api_key import APIKey
        result = await db.execute(
            select(APIKey).where(APIKey.key == api_key, APIKey.is_active == True)
        )
        key_row = result.scalar_one_or_none()
        if not key_row:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
        key_row.last_used_at = datetime.now(timezone.utc)
        await db.commit()
        return CurrentUser(
            user_id=key_row.user_id,
            tier=key_row.tier,
            team_id=str(key_row.team_id) if key_row.team_id else None,
            user_name="api-key",
        )

    # 2. Fall back to JWT Bearer token
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authentication")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("user_id") or payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return CurrentUser(
            user_id=int(user_id),
            tier=payload.get("tier", "FREE"),
            team_id=payload.get("team_id"),
            user_name=payload.get("user_name", ""),
            is_team_leader=payload.get("is_team_leader", False),
            is_admin=payload.get("is_superuser", False),
            subscription_status=payload.get("subscription_status", "active"),
        )
    except (JWTError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {exc}",
        )


def require_admin(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Dependency that enforces admin access."""
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")
    return user


def require_active_subscription(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Dependency that blocks users with expired/pending subscriptions (Free tier exempt)."""
    if user.tier == "FREE" or user.is_admin:
        return user
    if user.subscription_status not in ("active",):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your subscription is {user.subscription_status}. Please renew to continue using this feature.",
        )
    return user
