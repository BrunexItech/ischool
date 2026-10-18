"""Weekly report emails, per the confirmed product requirement: every role
that has its own analytics gets a report written for its own area —
security, boarding, transport and finance staff each get a domain digest;
each school's own admin(s) get the full "everything that happened" picture;
and a group owner additionally gets an executive summary across branches.
Every number is a real query against the same tables the live app reads —
only the narrative paragraph is AI-written (and gracefully degrades to
plain text when no AI key is configured)."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.ai_insights import generate_narrative
from app.core.mailer import send_email
from app.models.boarding import BoardingIncident, BoardingRollCall, Exeat, ExeatStatus, SickBayVisit
from app.models.expense import Expense, ExpenseStatus
from app.models.fees import FeePayment
from app.models.school import School
from app.models.security import SecurityIncident, SecurityIncidentStatus, VehicleLog, VisitorLog
from app.models.trip import Trip
from app.models.user import User, UserRole
from app.routers.dashboard import _compute_summary, _lean_branch_summary
from app.schemas.dashboard import GroupBranchSummary

NAVY = "#0B1B3F"
BLUE = "#1D4ED8"
MUTED = "#6B7280"
BORDER = "#E5E7EB"


def _week_window() -> tuple[date, date]:
    end = date.today()
    return end - timedelta(days=7), end


def _kes(n: float) -> str:
    return f"KES {n:,.0f}"


# ---------- email shell ----------


def _email_shell(title: str, subtitle: str, body_html: str) -> str:
    return f"""<!doctype html>
<html><body style="margin:0;padding:0;background:#F4F5F7;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F7;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid {BORDER};">
<tr><td style="background:{NAVY};padding:28px 32px;">
<span style="color:#FFFFFF;font-size:18px;font-weight:700;letter-spacing:-0.01em;">Milai Group of Schools</span>
<div style="color:#93A5C9;font-size:12px;margin-top:2px;">{title}</div>
</td></tr>
<tr><td style="padding:28px 32px 8px;">
<h1 style="margin:0 0 4px;font-size:20px;color:#111827;">{subtitle}</h1>
</td></tr>
<tr><td style="padding:0 32px 28px;">{body_html}</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid {BORDER};">
<span style="color:{MUTED};font-size:11px;">Automated weekly report from Milai Group of Schools.</span>
</td></tr>
</table>
</td></tr>
</table>
</body></html>"""


def _metric_row(cells: list[tuple[str, object]]) -> str:
    tds = "".join(
        f'<td style="padding:14px 16px;border:1px solid {BORDER};border-radius:8px;">'
        f'<div style="color:{MUTED};font-size:11px;text-transform:uppercase;letter-spacing:.04em;">{label}</div>'
        f'<div style="color:#111827;font-size:18px;font-weight:700;margin-top:2px;">{value}</div></td>'
        for label, value in cells
    )
    spacer = '<td style="width:8px;"></td>'
    return f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;"><tr>{spacer.join(tds)}</tr></table>'


def _narrative_block(text: str) -> str:
    return (
        f'<div style="margin-top:18px;padding:16px;border-left:3px solid {BLUE};background:#F8FAFF;border-radius:0 8px 8px 0;">'
        f'<p style="margin:0;font-size:13px;line-height:1.6;color:#1F2937;">{text}</p></div>'
    )


# ---------- this-week domain data ----------


def _security_week(db: Session, school_id: int) -> dict[str, object]:
    start, _ = _week_window()
    return {
        "Visitors signed in": db.query(VisitorLog).filter(VisitorLog.school_id == school_id, VisitorLog.signed_in_at >= start).count(),
        "Vehicle movements": db.query(VehicleLog).filter(VehicleLog.school_id == school_id, VehicleLog.logged_at >= start).count(),
        "Incidents this week": db.query(SecurityIncident).filter(SecurityIncident.school_id == school_id, SecurityIncident.created_at >= start).count(),
        "Still open": db.query(SecurityIncident).filter_by(school_id=school_id, status=SecurityIncidentStatus.OPEN).count(),
    }


def _boarding_week(db: Session, school_id: int) -> dict[str, object]:
    start, _ = _week_window()
    return {
        "Roll calls conducted": db.query(BoardingRollCall).filter(BoardingRollCall.school_id == school_id, BoardingRollCall.date >= start).count(),
        "Exeats requested": db.query(Exeat).filter(Exeat.school_id == school_id, Exeat.created_at >= start).count(),
        "Awaiting approval": db.query(Exeat).filter_by(school_id=school_id, status=ExeatStatus.PENDING).count(),
        "Sick bay visits": db.query(SickBayVisit).filter(SickBayVisit.school_id == school_id, SickBayVisit.created_at >= start).count(),
        "Incidents this week": db.query(BoardingIncident).filter(BoardingIncident.school_id == school_id, BoardingIncident.created_at >= start).count(),
    }


def _transport_week(db: Session, school_id: int) -> dict[str, object]:
    start, _ = _week_window()
    return {
        "Trips requested this week": db.query(Trip).filter(Trip.school_id == school_id, Trip.created_at >= start).count(),
    }


def _finance_week(db: Session, school_id: int) -> dict[str, object]:
    start, _ = _week_window()
    collected = db.query(func.coalesce(func.sum(FeePayment.amount), 0)).filter(
        FeePayment.school_id == school_id, FeePayment.paid_at >= start
    ).scalar()
    approved = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
        Expense.school_id == school_id, Expense.status == ExpenseStatus.APPROVED, Expense.approved_at >= start
    ).scalar()
    pending = db.query(Expense).filter_by(school_id=school_id, status=ExpenseStatus.PENDING).count()
    return {
        "Fees collected this week": _kes(float(collected)),
        "Expenses approved this week": _kes(float(approved)),
        "Pending approvals": pending,
    }


def _pending_expense_count(db: Session, school_id: int) -> int:
    return db.query(Expense).filter_by(school_id=school_id, status=ExpenseStatus.PENDING).count()


def _users_with_role(db: Session, school_id: int, role: UserRole) -> list[User]:
    return db.query(User).filter_by(school_id=school_id, role=role, is_active=True).all()


# ---------- role-domain reports (security / boarding / transport / bursar) ----------

_ROLE_REPORTS = {
    UserRole.SECURITY: (
        "security",
        _security_week,
        "You write a terse, professional weekly briefing for a school's security team. "
        "Given this week's visitor/vehicle/incident counts, write 2-3 sentences: flag anything "
        "that needs attention (open incidents especially), otherwise reassure that the week was routine. "
        "No greeting, no sign-off — just the paragraph.",
    ),
    UserRole.BOARDING_STAFF: (
        "boarding",
        _boarding_week,
        "You write a terse, professional weekly briefing for a school's boarding/matron staff. "
        "Given this week's roll call, exeat, sick bay and incident counts, write 2-3 sentences highlighting "
        "anything needing follow-up (pending exeats, repeat sick bay visits, open incidents). "
        "No greeting, no sign-off — just the paragraph.",
    ),
    UserRole.TRANSPORT_STAFF: (
        "transport",
        _transport_week,
        "You write a terse, professional weekly briefing for a school's transport coordinator. "
        "Given this week's trip request count, write 1-2 sentences on activity level. "
        "No greeting, no sign-off — just the paragraph.",
    ),
    UserRole.BURSAR: (
        "finance",
        _finance_week,
        "You write a terse, professional weekly briefing for a school bursar. Given this week's fee "
        "collections, approved expenses and pending-approval count, write 2-3 sentences on collection "
        "performance and flag if approvals are backing up. No greeting, no sign-off — just the paragraph.",
    ),
}


def _send_role_reports(db: Session, school: School) -> int:
    sent = 0
    for role, (label, data_fn, system_prompt) in _ROLE_REPORTS.items():
        recipients = _users_with_role(db, school.id, role)
        if not recipients:
            continue
        metrics = data_fn(db, school.id)
        data_summary = "\n".join(f"{k}: {v}" for k, v in metrics.items())
        fallback = f"This week: {data_summary.replace(chr(10), ', ')}."
        narrative = generate_narrative(system_prompt, data_summary, fallback)

        subject = f"{school.name} — weekly {label} report"
        html = _email_shell(f"Weekly {label} report", school.name, _metric_row(list(metrics.items())) + _narrative_block(narrative))
        text = f"{school.name} — weekly {label} report\n\n" + "\n".join(f"  {k}: {v}" for k, v in metrics.items()) + f"\n\n{narrative}\n"

        for user in recipients:
            sent += send_email(user.email, subject, text, html=html)
    return sent


# ---------- principal (full school) report ----------


def _principal_week_data(db: Session, school: School) -> tuple[dict[str, object], str]:
    full = _compute_summary(db, school.id)
    security = _security_week(db, school.id)
    boarding = _boarding_week(db, school.id)
    transport = _transport_week(db, school.id)
    finance = _finance_week(db, school.id)

    attendance = f"{full.today_attendance_rate:.0f}%" if full.today_attendance_rate is not None else "—"
    metrics: dict[str, object] = {
        "Students": full.total_students,
        "Active staff": full.active_staff,
        "Attendance today": attendance,
        "Fee collection rate": f"{full.fee_collection_rate:.0f}%",
        "Fees collected this week": finance["Fees collected this week"],
        "Pending expense approvals": finance["Pending approvals"],
        "Security incidents this week": security["Incidents this week"],
        "Boarding exeats awaiting approval": boarding["Awaiting approval"],
        "Transport trips this week": transport["Trips requested this week"],
    }
    data_summary = "\n".join(f"{k}: {v}" for k, v in metrics.items())
    return metrics, data_summary


_PRINCIPAL_PROMPT = (
    "You write a concise, professional weekly briefing for a school principal/head teacher, covering "
    "everything that happened across academics, fees, security, boarding and transport this week. "
    "In 3-4 sentences, summarize the week and flag anything that specifically needs the principal's "
    "attention (pending approvals, open incidents, low attendance or collection). "
    "No greeting, no sign-off — just the paragraph."
)


def send_branch_report(db: Session, school: School) -> int:
    recipients = _users_with_role(db, school.id, UserRole.SCHOOL_ADMIN)
    sent = 0
    if recipients:
        metrics, data_summary = _principal_week_data(db, school)
        fallback = f"This week: {data_summary.replace(chr(10), ', ')}."
        narrative = generate_narrative(_PRINCIPAL_PROMPT, data_summary, fallback)

        subject = f"{school.name} — weekly summary"
        html = _email_shell("Weekly school summary", school.name, _metric_row(list(metrics.items())) + _narrative_block(narrative))
        text = f"{school.name} — weekly summary\n\n" + "\n".join(f"  {k}: {v}" for k, v in metrics.items()) + f"\n\n{narrative}\n"
        for user in recipients:
            sent += send_email(user.email, subject, text, html=html)

    sent += _send_role_reports(db, school)
    return sent


# ---------- group owner executive summary ----------

_GROUP_PROMPT = (
    "You write a concise executive summary for the owner of a group of schools, comparing branches "
    "this week. In 2-4 sentences, call out which branch is performing best/worst on fee collection or "
    "attendance if there's a notable gap, otherwise summarize overall group health. "
    "No greeting, no sign-off — just the paragraph."
)


def send_group_report(db: Session, group: School) -> int:
    recipients = _users_with_role(db, group.id, UserRole.SCHOOL_ADMIN)
    if not recipients:
        return 0

    branches = db.query(School).filter_by(parent_school_id=group.id).order_by(School.name).all()
    rows: list[GroupBranchSummary] = [_lean_branch_summary(db, group, is_group=True)] + [
        _lean_branch_summary(db, b, is_group=False) for b in branches
    ]

    total_students = sum(r.total_students for r in rows)
    total_staff = sum(r.active_staff for r in rows)
    total_billed = sum(r.amount_billed for r in rows)
    total_paid = sum(r.amount_paid for r in rows)
    overall_rate = round(total_paid / total_billed * 100, 1) if total_billed else 0.0

    metrics = {
        "Schools": len(rows),
        "Total students": total_students,
        "Total staff": total_staff,
        "Group fee collection": f"{overall_rate:.0f}%",
    }
    def _branch_line(r: GroupBranchSummary) -> str:
        label = f"{r.name}{' (group)' if r.is_group else ''}"
        attendance = f"{r.today_attendance_rate:.0f}%" if r.today_attendance_rate is not None else "—"
        return f"  {label}: {r.total_students} students, {r.fee_collection_rate:.0f}% fees collected, attendance {attendance}"

    data_summary = (
        "\n".join(f"{k}: {v}" for k, v in metrics.items())
        + "\n\nPer-branch:\n"
        + "\n".join(_branch_line(r) for r in rows)
    )
    fallback = f"{len(rows)} schools, {total_students} students, {overall_rate:.0f}% group fee collection this week."
    narrative = generate_narrative(_GROUP_PROMPT, data_summary, fallback)

    rows_html = "".join(
        f'<tr><td style="padding:10px 12px;border-bottom:1px solid {BORDER};font-size:13px;color:#111827;">'
        f'{r.name}{" (group)" if r.is_group else ""}</td>'
        f'<td style="padding:10px 12px;border-bottom:1px solid {BORDER};font-size:13px;text-align:right;">{r.total_students:,}</td>'
        f'<td style="padding:10px 12px;border-bottom:1px solid {BORDER};font-size:13px;text-align:right;">{r.fee_collection_rate:.0f}%</td>'
        f'<td style="padding:10px 12px;border-bottom:1px solid {BORDER};font-size:13px;text-align:right;">'
        f'{f"{r.today_attendance_rate:.0f}%" if r.today_attendance_rate is not None else "—"}</td></tr>'
        for r in rows
    )
    table = f"""
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border:1px solid {BORDER};border-radius:8px;overflow:hidden;">
<tr style="background:#F9FAFB;">
<th style="padding:10px 12px;text-align:left;font-size:11px;color:{MUTED};text-transform:uppercase;">School</th>
<th style="padding:10px 12px;text-align:right;font-size:11px;color:{MUTED};text-transform:uppercase;">Students</th>
<th style="padding:10px 12px;text-align:right;font-size:11px;color:{MUTED};text-transform:uppercase;">Fees</th>
<th style="padding:10px 12px;text-align:right;font-size:11px;color:{MUTED};text-transform:uppercase;">Attendance</th>
</tr>{rows_html}</table>"""
    subject = f"{group.name} — weekly group summary"
    html = _email_shell("Weekly group executive summary", group.name, _metric_row(list(metrics.items())) + _narrative_block(narrative) + table)
    text = f"{group.name} — weekly group summary\n\n{narrative}\n\n" + "\n".join(f"  {k}: {v}" for k, v in metrics.items()) + "\n"

    return sum(send_email(u.email, subject, text, html=html) for u in recipients)


def send_all_weekly_reports(db: Session) -> dict:
    """Every active school's own admin(s) get the full picture for their
    school, plus every security/boarding/transport/bursar staff member gets
    a report for their own area; a school with branches (a group) also gets
    a separate executive-summary report, to the same admin(s)."""
    schools = db.query(School).filter_by(is_active=True).all()
    branch_emails_sent = 0
    group_emails_sent = 0
    for school in schools:
        branch_emails_sent += send_branch_report(db, school)
        has_branches = db.query(School).filter_by(parent_school_id=school.id).count() > 0
        if has_branches:
            group_emails_sent += send_group_report(db, school)
    return {
        "schools_processed": len(schools),
        "branch_reports_sent": branch_emails_sent,
        "group_reports_sent": group_emails_sent,
    }
