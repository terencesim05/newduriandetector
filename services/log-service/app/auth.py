"""Lightweight JWT verification reusing the same secret as auth-service."""

from dataclasses import dataclass
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from app.config import settings

bearer_scheme = HTTPBearer()


@dataclass
class CurrentUser:
    user_id: int
    tier: str            # FREE, PREMIUM, EXCLUSIVE
    team_id: str | None  # UUID string or None
    user_name: str = ""
    is_team_leader: bool = False
    is_admin: bool = False


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentUser:
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
