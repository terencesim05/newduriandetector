"""DurianBot — AI security assistant powered by Groq (Llama 3.3) with tool calling."""

import json
import uuid
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from groq import AsyncGroq, APIStatusError, APIConnectionError, RateLimitError

from app.database import get_db
from app.auth import get_current_user, CurrentUser
from app.config import settings
from app.models.alert import Alert
from app.models.lists import BlacklistEntry, WhitelistEntry
from app.models.incident import Incident, IncidentStatus, IncidentPriority
from app.utils.scoping import apply_scope

router = APIRouter(prefix="/api/chat", tags=["chatbot"])

GROQ_MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """You are DurianBot, the AI assistant for DurianDetector — a threat detection platform.
You're friendly, helpful, and have personality. You can chat casually AND help with security tasks.
Use markdown formatting. Be concise but not robotic.

You have tools to query alerts, block/trust IPs, create incidents, and view blacklists/whitelists.

RULES FOR TOOLS:
- READ tools (get_alerts, get_stats, get_blacklist, get_whitelist): execute immediately.
- WRITE tools (block_ip, trust_ip, create_incident, block_all_quarantined): ask the user to confirm first before calling.
- Don't make up security data — use tool results for that. But for general chat, be yourself."""

# OpenAI-style tool definitions (Groq compatible)
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_stats",
            "description": "Get alert statistics: total count, counts by severity, top categories, top source IPs, blocked and quarantined counts",
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {
                        "type": "integer",
                        "description": "Number of days to look back (default 7)",
                    }
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_alerts",
            "description": "Get recent alerts with optional filters",
            "parameters": {
                "type": "object",
                "properties": {
                    "severity": {
                        "type": "string",
                        "description": "Filter by severity: LOW, MEDIUM, HIGH, CRITICAL",
                    },
                    "category": {
                        "type": "string",
                        "description": "Filter by category: SQL_INJECTION, BRUTE_FORCE, MALWARE, XSS, PORT_SCAN, DDOS, COMMAND_INJECTION, PRIVILEGE_ESCALATION, DATA_EXFILTRATION, ANOMALY, OTHER",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max alerts to return (default 5, max 10)",
                    },
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "block_ip",
            "description": "Block an IP address by adding it to the blacklist. DESTRUCTIVE — always confirm with user first.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ip": {"type": "string", "description": "IP address to block"},
                    "reason": {"type": "string", "description": "Reason for blocking"},
                },
                "required": ["ip"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "trust_ip",
            "description": "Trust an IP address by adding it to the whitelist. DESTRUCTIVE — always confirm with user first.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ip": {"type": "string", "description": "IP address to trust"},
                    "reason": {"type": "string", "description": "Reason for trusting"},
                },
                "required": ["ip"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_incident",
            "description": "Create a new security incident. DESTRUCTIVE — always confirm with user first.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Incident title"},
                    "description": {"type": "string", "description": "Incident description"},
                    "priority": {
                        "type": "string",
                        "description": "Priority: LOW, MEDIUM, HIGH, CRITICAL",
                    },
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_blacklist",
            "description": "Get all blocked IPs from the blacklist",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_whitelist",
            "description": "Get all trusted IPs from the whitelist",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "block_all_quarantined",
            "description": "Mass block all quarantined alerts — moves every quarantined IP to the blacklist and marks alerts as blocked. DESTRUCTIVE — always confirm with user first.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


# ── Tool execution ──────────────────────────────────────────────────────

async def exec_get_stats(user: CurrentUser, db: AsyncSession, args: dict) -> str:
    days = min(args.get("days", 7), 30)
    since = datetime.now(timezone.utc) - timedelta(days=days)
    base = apply_scope(select(Alert), Alert, user)

    total = (await db.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
    period_q = base.where(Alert.detected_at >= since)
    period_count = (await db.execute(select(func.count()).select_from(period_q.subquery()))).scalar() or 0

    sev_q = apply_scope(
        select(Alert.severity, func.count().label("c")).where(Alert.detected_at >= since),
        Alert, user,
    ).group_by(Alert.severity)
    sevs = {r.severity: r.c for r in (await db.execute(sev_q)).all()}

    cat_q = apply_scope(
        select(Alert.category, func.count().label("c")).where(Alert.detected_at >= since),
        Alert, user,
    ).group_by(Alert.category).order_by(func.count().desc()).limit(5)
    cats = [(r.category, r.c) for r in (await db.execute(cat_q)).all()]

    ip_q = apply_scope(
        select(Alert.source_ip, func.count().label("c"), func.avg(Alert.threat_score).label("s"))
        .where(Alert.detected_at >= since),
        Alert, user,
    ).group_by(Alert.source_ip).order_by(func.count().desc()).limit(5)
    ips = [(r.source_ip, r.c, round(float(r.s), 2)) for r in (await db.execute(ip_q)).all()]

    blocked = (await db.execute(select(func.count()).select_from(
        apply_scope(select(Alert).where(Alert.is_blocked == True), Alert, user).subquery()
    ))).scalar() or 0
    quarantined = (await db.execute(select(func.count()).select_from(
        apply_scope(select(Alert).where(Alert.quarantine_status == "QUARANTINED"), Alert, user).subquery()
    ))).scalar() or 0

    return (
        f"Stats (last {days} days):\n"
        f"Total alerts: {total}, Period: {period_count}, Blocked: {blocked}, Quarantined: {quarantined}\n"
        f"By severity: {sevs}\n"
        f"Top categories: {cats}\n"
        f"Top IPs (ip, count, avg_score): {ips}"
    )


async def exec_get_alerts(user: CurrentUser, db: AsyncSession, args: dict) -> str:
    limit = min(args.get("limit", 5), 10)
    q = apply_scope(select(Alert), Alert, user)

    sev = args.get("severity")
    if sev:
        q = q.where(Alert.severity == sev.upper())
    cat = args.get("category")
    if cat:
        q = q.where(Alert.category == cat.upper())

    q = q.order_by(Alert.detected_at.desc()).limit(limit)
    rows = (await db.execute(q)).scalars().all()

    if not rows:
        return "No alerts found matching the filters."

    results = []
    for a in rows:
        results.append(
            f"- [{a.severity}] {a.category} | {a.source_ip}→{a.destination_ip} | "
            f"score:{a.threat_score:.2f} | {a.detected_at.strftime('%Y-%m-%d %H:%M')} | "
            f"{'BLOCKED' if a.is_blocked else 'quarantined' if a.quarantine_status == 'QUARANTINED' else 'active'}"
            f"{f' | country:{a.geo_country}' if a.geo_country else ''}"
        )
    return f"Found {len(rows)} alerts:\n" + "\n".join(results)


async def exec_block_ip(user: CurrentUser, db: AsyncSession, args: dict) -> str:
    ip = args.get("ip", "").strip()
    reason = args.get("reason", "Blocked by DurianBot")
    if not ip:
        return "Error: No IP provided."

    q = apply_scope(select(BlacklistEntry), BlacklistEntry, user)
    existing = await db.execute(q.where(BlacklistEntry.value == ip))
    if existing.scalar_one_or_none():
        return f"{ip} is already on the blacklist."

    wl_q = apply_scope(select(WhitelistEntry), WhitelistEntry, user)
    wl = (await db.execute(wl_q.where(WhitelistEntry.value == ip))).scalar_one_or_none()
    if wl:
        await db.delete(wl)

    entry = BlacklistEntry(
        entry_type="IP", value=ip, reason=reason, added_by="durianbot",
        user_id=user.user_id, team_id=uuid.UUID(user.team_id) if user.team_id else None,
    )
    db.add(entry)

    alert_update = apply_scope(
        update(Alert).where(Alert.source_ip == ip).values(is_blocked=True),
        Alert, user,
    )
    await db.execute(alert_update)
    await db.commit()
    return f"Blocked {ip}. Reason: {reason}. All existing alerts from this IP marked as blocked."


async def exec_trust_ip(user: CurrentUser, db: AsyncSession, args: dict) -> str:
    ip = args.get("ip", "").strip()
    reason = args.get("reason", "Trusted by DurianBot")
    if not ip:
        return "Error: No IP provided."

    q = apply_scope(select(WhitelistEntry), WhitelistEntry, user)
    existing = await db.execute(q.where(WhitelistEntry.value == ip))
    if existing.scalar_one_or_none():
        return f"{ip} is already on the whitelist."

    bl_q = apply_scope(select(BlacklistEntry), BlacklistEntry, user)
    bl = (await db.execute(bl_q.where(BlacklistEntry.value == ip))).scalar_one_or_none()
    if bl:
        await db.delete(bl)

    entry = WhitelistEntry(
        entry_type="IP", value=ip, reason=reason, added_by="durianbot",
        user_id=user.user_id, team_id=uuid.UUID(user.team_id) if user.team_id else None,
    )
    db.add(entry)
    await db.commit()
    return f"Trusted {ip}. Reason: {reason}."


async def exec_create_incident(user: CurrentUser, db: AsyncSession, args: dict) -> str:
    title = args.get("title", "").strip()
    if not title:
        return "Error: Incident title is required."

    priority = args.get("priority", "MEDIUM").upper()
    if priority not in ("LOW", "MEDIUM", "HIGH", "CRITICAL"):
        priority = "MEDIUM"

    incident = Incident(
        title=title,
        description=args.get("description", ""),
        priority=priority,
        status="OPEN",
        user_id=user.user_id,
        team_id=uuid.UUID(user.team_id) if user.team_id else None,
    )
    db.add(incident)
    await db.commit()
    await db.refresh(incident)
    return f"Incident created: \"{title}\" (Priority: {priority}, Status: OPEN, ID: {incident.id})"


async def exec_get_blacklist(user: CurrentUser, db: AsyncSession, args: dict) -> str:
    q = apply_scope(select(BlacklistEntry), BlacklistEntry, user).order_by(BlacklistEntry.created_at.desc()).limit(20)
    rows = (await db.execute(q)).scalars().all()
    if not rows:
        return "Blacklist is empty."
    entries = [f"- {e.value} ({e.entry_type}) — {e.reason or 'No reason'} [by {e.added_by}]" for e in rows]
    return f"Blacklist ({len(rows)} entries):\n" + "\n".join(entries)


async def exec_get_whitelist(user: CurrentUser, db: AsyncSession, args: dict) -> str:
    q = apply_scope(select(WhitelistEntry), WhitelistEntry, user).order_by(WhitelistEntry.created_at.desc()).limit(20)
    rows = (await db.execute(q)).scalars().all()
    if not rows:
        return "Whitelist is empty."
    entries = [f"- {e.value} ({e.entry_type}) — {e.reason or 'No reason'} [by {e.added_by}]" for e in rows]
    return f"Whitelist ({len(rows)} entries):\n" + "\n".join(entries)


async def exec_block_all_quarantined(user: CurrentUser, db: AsyncSession, args: dict) -> str:
    q = apply_scope(
        select(Alert.source_ip).where(Alert.quarantine_status == "QUARANTINED").distinct(),
        Alert, user,
    )
    rows = (await db.execute(q)).all()
    ips = [r.source_ip for r in rows]

    if not ips:
        return "No quarantined alerts found."

    blocked_count = 0
    for ip in ips:
        bl_q = apply_scope(select(BlacklistEntry), BlacklistEntry, user)
        existing = (await db.execute(bl_q.where(BlacklistEntry.value == ip))).scalar_one_or_none()
        if not existing:
            entry = BlacklistEntry(
                entry_type="IP", value=ip, reason="Mass blocked from quarantine by DurianBot",
                added_by="durianbot",
                user_id=user.user_id, team_id=uuid.UUID(user.team_id) if user.team_id else None,
            )
            db.add(entry)
            blocked_count += 1

    alert_update = apply_scope(
        update(Alert).where(Alert.quarantine_status == "QUARANTINED").values(
            is_blocked=True, quarantine_status="BLOCKED"
        ),
        Alert, user,
    )
    await db.execute(alert_update)
    await db.commit()

    return f"Blocked {blocked_count} new IPs from {len(ips)} unique quarantined IPs. All quarantined alerts marked as blocked."


TOOL_EXECUTORS = {
    "get_stats": exec_get_stats,
    "get_alerts": exec_get_alerts,
    "block_ip": exec_block_ip,
    "trust_ip": exec_trust_ip,
    "create_incident": exec_create_incident,
    "get_blacklist": exec_get_blacklist,
    "get_whitelist": exec_get_whitelist,
    "block_all_quarantined": exec_block_all_quarantined,
}


# ── API endpoint ────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


class ChatResponse(BaseModel):
    reply: str
    action_taken: str | None = None


@router.post("", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="Chatbot is not configured. GROQ_API_KEY is missing.")
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")
    if len(body.message) > 1000:
        raise HTTPException(status_code=400, detail="Message too long (max 1000 characters).")

    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in body.history[-8:]:
        role = "user" if msg.get("role") == "user" else "assistant"
        messages.append({"role": role, "content": msg.get("content", "")})
    messages.append({"role": "user", "content": body.message})

    action_taken = None
    client = AsyncGroq(api_key=settings.GROQ_API_KEY, timeout=30.0)

    try:
        resp = await client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            max_tokens=500,
        )
        msg = resp.choices[0].message

        if msg.tool_calls:
            messages.append({
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                    }
                    for tc in msg.tool_calls
                ],
            })

            for tc in msg.tool_calls:
                fn_name = tc.function.name
                try:
                    fn_args = json.loads(tc.function.arguments or "{}")
                except json.JSONDecodeError:
                    fn_args = {}

                executor = TOOL_EXECUTORS.get(fn_name)
                if not executor:
                    result = f"Unknown tool: {fn_name}"
                else:
                    result = await executor(user, db, fn_args)
                    action_taken = fn_name

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "content": result,
                })

            resp2 = await client.chat.completions.create(
                model=GROQ_MODEL,
                messages=messages,
                tools=TOOLS,
                max_tokens=500,
            )
            reply = resp2.choices[0].message.content or "Done."
            return ChatResponse(reply=reply, action_taken=action_taken)

        reply = msg.content or "I wasn't able to generate a response."
        return ChatResponse(reply=reply)

    except RateLimitError:
        raise HTTPException(status_code=429, detail="Rate limit reached. Please wait a moment and try again.")
    except APIStatusError:
        raise HTTPException(status_code=502, detail="Failed to get response from AI service.")
    except APIConnectionError:
        raise HTTPException(status_code=502, detail="Could not connect to AI service.")
