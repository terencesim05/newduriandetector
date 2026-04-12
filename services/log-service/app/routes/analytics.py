import io
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from reportlab.lib import colors as rl_colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable,
)

from app.database import get_db
from app.auth import get_current_user, CurrentUser
from app.models.alert import Alert
from app.utils.scoping import apply_scope

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


def _base_query(user: CurrentUser, severity: str | None, category: str | None,
                start_date: datetime | None, end_date: datetime | None):
    """Build a scoped, filtered base query."""
    base = apply_scope(select(Alert), Alert, user)
    if severity:
        base = base.where(Alert.severity == severity)
    if category:
        base = base.where(Alert.category == category)
    if start_date:
        base = base.where(Alert.detected_at >= start_date)
    if end_date:
        base = base.where(Alert.detected_at <= end_date)
    return base


@router.get("/time-series")
async def time_series(
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    severity: str | None = Query(None),
    category: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not start_date:
        start_date = datetime.now(timezone.utc) - timedelta(hours=24)
    if not end_date:
        end_date = datetime.now(timezone.utc)

    delta = end_date - start_date
    scoped = _base_query(user, severity, category, start_date, end_date).subquery()
    q = (
        select(
            func.date_trunc("hour" if delta.days <= 3 else "day", scoped.c.detected_at).label("bucket"),
            func.count().label("count"),
        )
        .group_by("bucket")
        .order_by("bucket")
    )

    rows = (await db.execute(q)).all()
    return [{"time": r.bucket.isoformat(), "count": r.count} for r in rows]


@router.get("/category-distribution")
async def category_distribution(
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    severity: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    scoped = _base_query(user, severity, None, start_date, end_date).subquery()
    q = (
        select(scoped.c.category.label("category"), func.count().label("count"))
        .group_by(scoped.c.category)
        .order_by(func.count().desc())
    )
    rows = (await db.execute(q)).all()
    return [{"category": r.category, "count": r.count} for r in rows]


@router.get("/top-sources")
async def top_sources(
    limit: int = Query(10, ge=1, le=50),
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    severity: str | None = Query(None),
    category: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    scoped = _base_query(user, severity, category, start_date, end_date).subquery()
    q = (
        select(scoped.c.source_ip.label("source_ip"), func.count().label("count"))
        .group_by(scoped.c.source_ip)
        .order_by(func.count().desc())
        .limit(limit)
    )
    rows = (await db.execute(q)).all()
    return [{"source_ip": r.source_ip, "count": r.count} for r in rows]


@router.get("/severity-trends")
async def severity_trends(
    days: int = Query(7, ge=1, le=90),
    category: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    start = datetime.now(timezone.utc) - timedelta(days=days)
    scoped = _base_query(user, None, category, start, None).subquery()

    trunc = "hour" if days <= 3 else "day"
    q = (
        select(
            func.date_trunc(trunc, scoped.c.detected_at).label("bucket"),
            scoped.c.severity.label("severity"),
            func.count().label("count"),
        )
        .group_by("bucket", scoped.c.severity)
        .order_by("bucket")
    )
    rows = (await db.execute(q)).all()

    # Pivot into {time, LOW, MEDIUM, HIGH, CRITICAL}
    buckets: dict[str, dict] = {}
    for r in rows:
        key = r.bucket.isoformat()
        if key not in buckets:
            buckets[key] = {"time": key, "LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
        buckets[key][r.severity] = r.count

    return list(buckets.values())


@router.get("/geo-map")
async def geo_map(
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    severity: str | None = Query(None),
    category: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    scoped = _base_query(user, severity, category, start_date, end_date).subquery()
    q = (
        select(
            scoped.c.geo_latitude.label("latitude"),
            scoped.c.geo_longitude.label("longitude"),
            scoped.c.geo_country.label("country"),
            func.count().label("alert_count"),
            func.avg(scoped.c.threat_score).label("avg_score"),
        )
        .where(scoped.c.geo_latitude.isnot(None))
        .group_by(scoped.c.geo_latitude, scoped.c.geo_longitude, scoped.c.geo_country)
        .order_by(func.count().desc())
    )
    rows = (await db.execute(q)).all()
    return [
        {
            "latitude": float(r.latitude),
            "longitude": float(r.longitude),
            "country": r.country or "Unknown",
            "alert_count": r.alert_count,
            "avg_score": round(float(r.avg_score), 3),
        }
        for r in rows
    ]


# ── PDF report generation ────────────────────────────────────────────

def _build_styles():
    """Custom styles for the analytics PDF."""
    base = getSampleStyleSheet()
    base.add(ParagraphStyle(
        "ReportTitle", parent=base["Title"],
        fontSize=20, textColor=rl_colors.HexColor("#1e293b"),
        spaceAfter=4,
    ))
    base.add(ParagraphStyle(
        "ReportSubtitle", parent=base["Normal"],
        fontSize=10, textColor=rl_colors.HexColor("#64748b"),
        spaceAfter=16,
    ))
    base.add(ParagraphStyle(
        "SectionHeading", parent=base["Heading2"],
        fontSize=13, textColor=rl_colors.HexColor("#0f172a"),
        spaceBefore=18, spaceAfter=6,
    ))
    return base


_TABLE_STYLE = TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), rl_colors.HexColor("#1e293b")),
    ("TEXTCOLOR", (0, 0), (-1, 0), rl_colors.white),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE", (0, 0), (-1, 0), 9),
    ("FONTSIZE", (0, 1), (-1, -1), 8),
    ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
    ("TOPPADDING", (0, 0), (-1, 0), 8),
    ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
    ("TOPPADDING", (0, 1), (-1, -1), 5),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [rl_colors.HexColor("#f8fafc"), rl_colors.white]),
    ("GRID", (0, 0), (-1, -1), 0.5, rl_colors.HexColor("#e2e8f0")),
    ("ALIGN", (1, 0), (-1, -1), "CENTER"),
])


def _fmt_time(iso_str: str) -> str:
    try:
        dt = datetime.fromisoformat(iso_str)
        return dt.strftime("%d %b %Y %H:%M")
    except Exception:
        return iso_str


def _fmt_category(cat: str) -> str:
    return (cat or "").replace("_", " ").title()


@router.get("/export-pdf")
async def export_pdf(
    start_date: datetime | None = Query(None),
    end_date: datetime | None = Query(None),
    severity: str | None = Query(None),
    category: str | None = Query(None),
    days: int = Query(7, ge=1, le=90),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a PDF analytics report and return it as a download."""

    # ── Fetch the same 4 datasets the frontend uses ──
    if not start_date:
        start_date = datetime.now(timezone.utc) - timedelta(days=days)
    if not end_date:
        end_date = datetime.now(timezone.utc)

    delta = end_date - start_date

    # Time series
    ts_sub = _base_query(user, severity, category, start_date, end_date).subquery()
    ts_q = (
        select(
            func.date_trunc("hour" if delta.days <= 3 else "day", ts_sub.c.detected_at).label("bucket"),
            func.count().label("count"),
        )
        .group_by("bucket")
        .order_by("bucket")
    )
    ts_rows = (await db.execute(ts_q)).all()

    # Category distribution
    cat_sub = _base_query(user, severity, None, start_date, end_date).subquery()
    cat_q = (
        select(cat_sub.c.category.label("category"), func.count().label("count"))
        .group_by(cat_sub.c.category)
        .order_by(func.count().desc())
    )
    cat_rows = (await db.execute(cat_q)).all()

    # Top sources
    src_sub = _base_query(user, severity, category, start_date, end_date).subquery()
    src_q = (
        select(src_sub.c.source_ip.label("source_ip"), func.count().label("count"))
        .group_by(src_sub.c.source_ip)
        .order_by(func.count().desc())
        .limit(10)
    )
    src_rows = (await db.execute(src_q)).all()

    # Severity trends
    sev_start = datetime.now(timezone.utc) - timedelta(days=days)
    sev_sub = _base_query(user, None, category, sev_start, None).subquery()
    trunc = "hour" if days <= 3 else "day"
    sev_q = (
        select(
            func.date_trunc(trunc, sev_sub.c.detected_at).label("bucket"),
            sev_sub.c.severity.label("severity"),
            func.count().label("count"),
        )
        .group_by("bucket", sev_sub.c.severity)
        .order_by("bucket")
    )
    sev_rows = (await db.execute(sev_q)).all()

    # Pivot severity data
    sev_buckets: dict[str, dict] = {}
    for r in sev_rows:
        key = r.bucket.isoformat()
        if key not in sev_buckets:
            sev_buckets[key] = {"time": key, "LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
        sev_buckets[key][r.severity] = r.count

    # ── Build PDF ──
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=landscape(A4),
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=15 * mm, bottomMargin=15 * mm,
    )
    styles = _build_styles()
    story: list = []

    # Header
    story.append(Paragraph("DurianDetector — Analytics Report", styles["ReportTitle"]))
    story.append(Paragraph(
        f"Generated: {datetime.now(timezone.utc).strftime('%d %b %Y %H:%M UTC')}  |  "
        f"Period: {start_date.strftime('%d %b %Y')} – {end_date.strftime('%d %b %Y')}"
        + (f"  |  Severity: {severity}" if severity else "")
        + (f"  |  Category: {_fmt_category(category)}" if category else ""),
        styles["ReportSubtitle"],
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=rl_colors.HexColor("#e2e8f0")))

    # 1 — Alerts over time
    story.append(Paragraph("Alerts Over Time", styles["SectionHeading"]))
    if ts_rows:
        t_data = [["Time", "Count"]]
        for r in ts_rows:
            t_data.append([_fmt_time(r.bucket.isoformat()), str(r.count)])
        t = Table(t_data, hAlign="LEFT", repeatRows=1)
        t.setStyle(_TABLE_STYLE)
        story.append(t)
    else:
        story.append(Paragraph("No data for this period.", styles["Normal"]))

    # 2 — Category breakdown
    story.append(Paragraph("Category Breakdown", styles["SectionHeading"]))
    if cat_rows:
        c_data = [["Category", "Count"]]
        for r in cat_rows:
            c_data.append([_fmt_category(r.category), str(r.count)])
        t = Table(c_data, hAlign="LEFT", repeatRows=1)
        t.setStyle(_TABLE_STYLE)
        story.append(t)
    else:
        story.append(Paragraph("No data for this period.", styles["Normal"]))

    # 3 — Top attacking IPs
    story.append(Paragraph("Top Attacking IPs", styles["SectionHeading"]))
    if src_rows:
        s_data = [["#", "Source IP", "Alerts"]]
        for idx, r in enumerate(src_rows, 1):
            s_data.append([str(idx), r.source_ip, str(r.count)])
        t = Table(s_data, hAlign="LEFT", repeatRows=1)
        t.setStyle(_TABLE_STYLE)
        story.append(t)
    else:
        story.append(Paragraph("No data for this period.", styles["Normal"]))

    # 4 — Severity trends
    story.append(Paragraph("Severity Trends", styles["SectionHeading"]))
    sev_list = list(sev_buckets.values())
    if sev_list:
        sv_data = [["Time", "Critical", "High", "Medium", "Low"]]
        for row in sev_list:
            sv_data.append([
                _fmt_time(row["time"]),
                str(row["CRITICAL"]),
                str(row["HIGH"]),
                str(row["MEDIUM"]),
                str(row["LOW"]),
            ])
        t = Table(sv_data, hAlign="LEFT", repeatRows=1)
        t.setStyle(_TABLE_STYLE)
        story.append(t)
    else:
        story.append(Paragraph("No data for this period.", styles["Normal"]))

    doc.build(story)
    buf.seek(0)

    filename = f"duriandetector-analytics-{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
