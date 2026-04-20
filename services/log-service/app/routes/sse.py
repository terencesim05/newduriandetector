"""Server-Sent Events endpoint for real-time alert streaming."""

import asyncio
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.auth import CurrentUser
from app.models.alert import Alert, DismissedAlert
from app.utils.scoping import apply_scope
from app.config import settings
from jose import JWTError, jwt

router = APIRouter(prefix="/api/sse", tags=["sse"])


def _parse_token(token: str) -> CurrentUser:
    """Parse JWT from query param (EventSource can't send headers)."""
    payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.ALGORITHM])
    user_id = payload.get("user_id") or payload.get("sub")
    if user_id is None:
        raise ValueError("Invalid token")
    return CurrentUser(
        user_id=int(user_id),
        tier=payload.get("tier", "FREE"),
        team_id=payload.get("team_id"),
        user_name=payload.get("user_name", ""),
        is_team_leader=payload.get("is_team_leader", False),
        is_admin=payload.get("is_superuser", False),
    )


def _serialize_alert(alert) -> dict:
    """Convert an Alert ORM object to a JSON-serializable dict."""
    return {
        'id': str(alert.id),
        'severity': alert.severity.value if alert.severity else None,
        'category': alert.category.value if alert.category else None,
        'source_ip': alert.source_ip,
        'destination_ip': alert.destination_ip,
        'source_port': alert.source_port,
        'destination_port': alert.destination_port,
        'protocol': alert.protocol,
        'threat_score': alert.threat_score,
        'ids_source': alert.ids_source.value if alert.ids_source else None,
        'flagged_by_threatfox': alert.flagged_by_threatfox,
        'is_blocked': alert.is_blocked,
        'is_whitelisted': alert.is_whitelisted,
        'quarantine_status': alert.quarantine_status.value if alert.quarantine_status else None,
        'ml_confidence': alert.ml_confidence,
        'geo_country': alert.geo_country,
        'detected_at': alert.detected_at.isoformat() if alert.detected_at else None,
        'created_at': alert.created_at.isoformat() if alert.created_at else None,
    }


async def _get_stats(user: CurrentUser) -> dict:
    """Get current alert stats for a user."""
    async with async_session() as db:
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        base = apply_scope(select(func.count(Alert.id)), Alert, user)
        total = (await db.execute(base)).scalar() or 0

        today_q = apply_scope(
            select(func.count(Alert.id)).where(Alert.created_at >= today_start),
            Alert, user,
        )
        today = (await db.execute(today_q)).scalar() or 0

        critical_q = apply_scope(
            select(func.count(Alert.id)).where(Alert.severity == 'CRITICAL'),
            Alert, user,
        )
        critical = (await db.execute(critical_q)).scalar() or 0

        blocked_q = apply_scope(
            select(func.count(Alert.id)).where(Alert.is_blocked == True),
            Alert, user,
        )
        blocked = (await db.execute(blocked_q)).scalar() or 0

        return {
            'total': total,
            'today': today,
            'critical': critical,
            'blocked': blocked,
        }


async def _event_generator(user: CurrentUser):
    """Generator that yields SSE events."""
    last_check = datetime.now(timezone.utc)
    heartbeat_counter = 0
    stats_counter = 0

    # Send initial stats
    try:
        stats = await _get_stats(user)
        yield f"data: {json.dumps({'type': 'stats_update', 'stats': stats})}\n\n"
    except Exception:
        pass

    while True:
        try:
            await asyncio.sleep(2)
            heartbeat_counter += 2
            stats_counter += 2

            # Check for new alerts
            async with async_session() as db:
                dismissed_ids = select(DismissedAlert.alert_id).where(
                    DismissedAlert.user_id == user.user_id
                )
                query = apply_scope(
                    select(Alert).where(Alert.created_at > last_check).where(Alert.id.notin_(dismissed_ids)),
                    Alert, user,
                ).order_by(Alert.created_at.asc())

                result = await db.execute(query)
                new_alerts = result.scalars().all()

                if new_alerts:
                    last_check = new_alerts[-1].created_at
                    for alert in new_alerts:
                        event = {
                            'type': 'new_alert',
                            'alert': _serialize_alert(alert),
                        }
                        yield f"data: {json.dumps(event)}\n\n"

            # Send stats update every 10 seconds
            if stats_counter >= 10:
                stats_counter = 0
                try:
                    stats = await _get_stats(user)
                    yield f"data: {json.dumps({'type': 'stats_update', 'stats': stats})}\n\n"
                except Exception:
                    pass

            # Send heartbeat every 30 seconds
            if heartbeat_counter >= 30:
                heartbeat_counter = 0
                yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"

        except asyncio.CancelledError:
            break
        except Exception:
            # Connection broken or other error — stop
            break


@router.get("/alerts")
async def sse_alerts(
    token: str = Query(..., description="JWT access token"),
):
    """SSE endpoint that streams new alerts and stats updates.
    Uses token query param because EventSource API cannot send headers.
    """
    try:
        user = _parse_token(token)
    except (JWTError, ValueError):
        return StreamingResponse(
            iter([f"data: {json.dumps({'type': 'error', 'message': 'Invalid token'})}\n\n"]),
            media_type="text/event-stream",
            status_code=401,
        )

    return StreamingResponse(
        _event_generator(user),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
