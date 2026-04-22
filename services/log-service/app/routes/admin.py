from fastapi import APIRouter, Depends

from app.auth import require_admin, CurrentUser

router = APIRouter(prefix="/api/admin", tags=["admin"])
