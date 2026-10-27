"""The group principal's weekly report: every school side by side, what needs
attention anywhere, and the few decisions that are theirs. Sent on Saturday
morning, after the heads' own reports, and always available inside the system."""

import logging
from datetime import date

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.group_overview import group_report
from app.core.mailer import send_email
from app.models.meeting import PrincipalReportRun
from app.models.user import User, UserRole
from app.services.weekly_reports import BLUE, BORDER, MUTED, NAVY, _email_shell

logger = logging.getLogger("ischool.principal_report")
OK, WARN, BAD = "#047857", "#B45309", "#B91C1C"


def fmt(value, kind: str) -> str:
    if value is None:
        return "—"
    if kind == "percent":
        return f"{value:g}%"
    if kind == "money":
        return f"KES {value:,.0f}"
    if kind in ("score", "decimal"):
        return f"{value:g}"
    return f"{value:,.0f}"


def _html(report, base: str) -> str:
    cards = "".join(
        f'<tr><td style="padding:9px 0;border-bottom:1px solid {BORDER};font-size:13px;font-weight:600;color:#111827;">{c.name}'
        f'<div style="font-size:11px;font-weight:400;color:{MUTED};">{c.learners:,} learners · {c.teachers} teachers</div></td>'
        f'<td style="padding:9px 0;border-bottom:1px solid {BORDER};font-size:12px;text-align:right;color:#111827;">'
        f'Attendance {fmt(c.attendance_today, "percent")}<br>Fees collected {fmt(c.fee_rate, "percent")}</td>'
        f'<td style="padding:9px 0 9px 12px;border-bottom:1px solid {BORDER};font-size:12px;text-align:right;color:{BAD if c.urgent else (WARN if c.attention else OK)};font-weight:600;">'
        f'{c.attention} to look at{f", {c.urgent} urgent" if c.urgent else ""}</td></tr>'
        for c in report.schools
    )
    spot = "".join(f'<li style="margin:4px 0;font-size:13px;color:#111827;">{s}</li>' for s in report.spotlight)
    needs = "".join(
        f'<tr><td style="padding:8px 0;border-bottom:1px solid {BORDER};font-size:13px;color:#111827;">'
        f'<span style="display:inline-block;width:8px;height:8px;border-radius:4px;background:{BAD if a.tone == "bad" else "#D97706"};margin-right:8px;"></span>'
        f'<span style="color:{MUTED};font-size:11px;text-transform:uppercase;letter-spacing:.04em;">{a.school_name}</span><br>{a.text}</td></tr>'
        for a in report.attention[:12]
    )
    decisions = "".join(
        f'<tr><td style="padding:8px 0;border-bottom:1px solid {BORDER};font-size:13px;color:#111827;"><span style="color:{MUTED};font-size:11px;text-transform:uppercase;">{d.school_name}</span><br>{d.title}<br><span style="color:{MUTED};font-size:12px;">{d.detail} · waiting {d.age_days} day{"s" if d.age_days != 1 else ""}</span></td></tr>'
        for d in report.decisions[:8]
    )
    blocks = ""
    for sec in report.sections:
        cols = sec.columns[:4]
        head = "".join(f'<th style="padding:6px 4px;font-size:11px;color:{MUTED};text-align:right;font-weight:600;">{c.label}</th>' for c in cols)
        body = "".join(
            f'<tr><td style="padding:6px 0;font-size:12px;color:#111827;">{r.school_name}</td>' + "".join(f'<td style="padding:6px 4px;font-size:12px;text-align:right;color:#111827;">{fmt(r.values.get(c.key), c.kind) if r.enabled else "off"}</td>' for c in cols) + "</tr>"
            for r in sec.rows
        )
        total = f'<tr><td style="padding:6px 0;font-size:12px;font-weight:700;border-top:1px solid {BORDER};">All schools</td>' + "".join(f'<td style="padding:6px 4px;font-size:12px;font-weight:700;text-align:right;border-top:1px solid {BORDER};">{fmt(sec.group.get(c.key), c.kind)}</td>' for c in cols) + "</tr>"
        blocks += (
            f'<div style="margin-top:20px;padding-top:12px;border-top:1px solid {BORDER};"><div style="font-size:14px;font-weight:700;color:#111827;">{sec.title}</div>'
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><th></th>{head}</tr>{body}{total}</table></div>'
        )
    top = (
        f'<div style="margin-top:6px;font-size:12px;color:{MUTED};">Week of {report.week_start:%d %b} to {report.week_end:%d %b %Y}</div>'
        f'<div style="margin-top:14px;padding:14px 16px;border-left:3px solid {BLUE};background:#F8FAFF;border-radius:0 8px 8px 0;font-size:14px;font-weight:600;color:#111827;">{report.headline}</div>'
    )
    out = top + f'<h2 style="margin:22px 0 4px;font-size:15px;color:#111827;">Your schools</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0">{cards}</table>'
    if spot:
        out += f'<ul style="margin:14px 0 0;padding-left:18px;">{spot}</ul>'
    if decisions:
        out += f'<h2 style="margin:22px 0 4px;font-size:15px;color:#111827;">Decisions waiting for you</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0">{decisions}</table>'
    if needs:
        out += f'<h2 style="margin:22px 0 4px;font-size:15px;color:#111827;">Needs attention</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0">{needs}</table>'
    out += blocks
    out += f'<div style="margin-top:22px;"><a href="{base}/dashboard/group/report" style="display:inline-block;background:{NAVY};color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:10px 18px;border-radius:8px;">Open the full report</a></div>'
    return out


def _text(report, base: str) -> str:
    lines = [report.headline, f"Week of {report.week_start:%d %b} to {report.week_end:%d %b %Y}", ""]
    for c in report.schools:
        lines.append(f"{c.name}: {c.learners:,} learners, attendance {fmt(c.attendance_today, 'percent')}, fees collected {fmt(c.fee_rate, 'percent')}, {c.attention} to look at")
    if report.spotlight:
        lines += [""] + report.spotlight
    if report.decisions:
        lines += ["", "Decisions waiting for you:"] + [f"- {d.school_name}: {d.title} ({d.detail})" for d in report.decisions[:8]]
    if report.attention:
        lines += ["", "Needs attention:"] + [f"- {a.school_name}: {a.text}" for a in report.attention[:12]]
    lines += ["", f"Full report: {base}/dashboard/group/report"]
    return "\n".join(lines)


def email_principal(db: Session, user: User) -> bool:
    """Builds and emails one principal's report. Never raises."""
    try:
        report = group_report(db, user)
        if not report.schools:
            return False
        base = settings.frontend_url.rstrip("/")
        return bool(send_email(user.email, f"Your schools this week: {report.headline}", _text(report, base), html=_email_shell("Group weekly report", user.full_name, _html(report, base))))
    except Exception:
        logger.exception("Could not send the principal's report to %s", user.email)
        return False


def send_all_principal_reports(db: Session, once_per_week: bool = False) -> dict:
    iso_year, iso_week = date.today().isocalendar()[:2]
    sent = skipped = 0
    for user in db.query(User).filter(User.role == UserRole.GROUP_PRINCIPAL, User.is_active.is_(True)).all():
        if once_per_week and db.query(PrincipalReportRun).filter_by(user_id=user.id, iso_year=iso_year, iso_week=iso_week).first():
            skipped += 1
            continue
        sent += 1 if email_principal(db, user) else 0
        if once_per_week:
            db.add(PrincipalReportRun(user_id=user.id, iso_year=iso_year, iso_week=iso_week))
            db.commit()
    return {"principal_reports_sent": sent, "skipped": skipped}
