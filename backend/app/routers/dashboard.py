from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_roles
from app.models.academics import SchoolClass, Student
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.audit_log import AuditLog
from app.models.fees import FeeInvoice
from app.models.school import School
from app.models.user import User, UserRole
from app.schemas.dashboard import (
    AttendanceTrendPoint,
    DashboardSummaryOut,
    GroupBranchSummary,
    GroupSummaryOut,
    PendingRegister,
    RecentActivityItem,
    TopBalance,
)

router = APIRouter(prefix="/schools/{school_id}/dashboard", tags=["dashboard"])

ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)


def compute_attendance_trend(db: Session, school_id: int) -> list[AttendanceTrendPoint]:
    """The last 7 days' attendance rate — broken out so it can be reused by
    anything that's allowed to see attendance but not the rest of the
    (finance-heavy, admin-only) dashboard summary, e.g. the Analytics page."""
    today = date.today()
    start_date = today - timedelta(days=6)
    rows = (
        db.query(AttendanceRecord.date, AttendanceRecord.status, func.count())
        .filter(
            AttendanceRecord.school_id == school_id,
            AttendanceRecord.date >= start_date,
            AttendanceRecord.date <= today,
        )
        .group_by(AttendanceRecord.date, AttendanceRecord.status)
        .all()
    )
    by_date: dict[date, dict[str, int]] = {}
    for d, status, count in rows:
        stats = by_date.setdefault(d, {"total": 0, "present": 0})
        stats["total"] += count
        if status != AttendanceStatus.ABSENT:
            stats["present"] += count

    def rate_for(d: date) -> float | None:
        stats = by_date.get(d)
        if not stats or stats["total"] == 0:
            return None
        return round(stats["present"] / stats["total"] * 100, 1)

    return [AttendanceTrendPoint(date=start_date + timedelta(days=i), rate=rate_for(start_date + timedelta(days=i))) for i in range(7)]


def _compute_summary(db: Session, school_id: int) -> DashboardSummaryOut:
    today = date.today()

    total_students = db.query(Student).filter_by(school_id=school_id, is_active=True).count()

    staff_query = db.query(User).filter(User.school_id == school_id, User.role.in_([UserRole.TEACHER, UserRole.STAFF]))
    total_staff = staff_query.count()
    active_staff = staff_query.filter(User.is_active.is_(True)).count()

    invoices = db.query(FeeInvoice).filter_by(school_id=school_id).all()
    amount_billed = sum(float(i.amount_due) for i in invoices)
    amount_paid = sum(float(i.amount_paid) for i in invoices)
    fee_collection_rate = round(amount_paid / amount_billed * 100, 1) if amount_billed else 0.0

    attendance_trend = compute_attendance_trend(db, school_id)
    rate_by_date = {p.date: p.rate for p in attendance_trend}
    today_attendance_rate = rate_by_date.get(today)
    yesterday_attendance_rate = rate_by_date.get(today - timedelta(days=1))

    classes = db.query(SchoolClass).filter_by(school_id=school_id).all()
    classes_total = len(classes)
    marked_class_ids = {
        row[0]
        for row in db.query(AttendanceRecord.class_id)
        .filter(AttendanceRecord.school_id == school_id, AttendanceRecord.date == today)
        .distinct()
        .all()
    }
    classes_marked_today = len(marked_class_ids)

    pending_registers = []
    for c in classes:
        if c.id in marked_class_ids:
            continue
        student_count = db.query(Student).filter_by(school_id=school_id, class_id=c.id, is_active=True).count()
        if student_count == 0:
            continue
        pending_registers.append(
            PendingRegister(
                class_id=c.id,
                class_name=c.name,
                teacher_name=c.homeroom_teacher.full_name if c.homeroom_teacher else None,
                student_count=student_count,
            )
        )

    balance_rows = (
        db.query(
            Student.id,
            Student.first_name,
            Student.last_name,
            Student.admission_number,
            SchoolClass.name,
            func.sum(FeeInvoice.amount_due - FeeInvoice.amount_paid).label("balance"),
        )
        .join(FeeInvoice, FeeInvoice.student_id == Student.id)
        .outerjoin(SchoolClass, SchoolClass.id == Student.class_id)
        .filter(FeeInvoice.school_id == school_id)
        .group_by(Student.id, Student.first_name, Student.last_name, Student.admission_number, SchoolClass.name)
        .having(func.sum(FeeInvoice.amount_due - FeeInvoice.amount_paid) > 0)
        .order_by(func.sum(FeeInvoice.amount_due - FeeInvoice.amount_paid).desc())
        .limit(5)
        .all()
    )
    top_balances = [
        TopBalance(
            student_id=sid,
            student_name=f"{first} {last}",
            admission_number=adm,
            class_name=cls_name,
            balance=round(float(balance), 2),
        )
        for sid, first, last, adm, cls_name, balance in balance_rows
    ]

    activity_rows = (
        db.query(AuditLog, User.full_name)
        .outerjoin(User, User.id == AuditLog.actor_user_id)
        .filter(AuditLog.school_id == school_id)
        .order_by(AuditLog.created_at.desc())
        .limit(10)
        .all()
    )
    recent_activity = [
        RecentActivityItem(
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            created_at=log.created_at,
            actor_name=actor_name,
        )
        for log, actor_name in activity_rows
    ]

    return DashboardSummaryOut(
        total_students=total_students,
        total_staff=total_staff,
        active_staff=active_staff,
        amount_billed=round(amount_billed, 2),
        amount_paid=round(amount_paid, 2),
        fee_collection_rate=fee_collection_rate,
        today_attendance_rate=today_attendance_rate,
        yesterday_attendance_rate=yesterday_attendance_rate,
        attendance_trend=attendance_trend,
        classes_total=classes_total,
        classes_marked_today=classes_marked_today,
        pending_registers=pending_registers,
        top_balances=top_balances,
        recent_activity=recent_activity,
    )


@router.get("/summary", response_model=DashboardSummaryOut, dependencies=[Depends(require_roles(*ADMIN_ROLES))])
def get_dashboard_summary(
    school_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    return _compute_summary(db, school_id)


def _lean_branch_summary(db: Session, school: School, is_group: bool) -> GroupBranchSummary:
    full = _compute_summary(db, school.id)
    return GroupBranchSummary(
        school_id=school.id,
        name=school.name,
        is_group=is_group,
        total_students=full.total_students,
        active_staff=full.active_staff,
        amount_billed=full.amount_billed,
        amount_paid=full.amount_paid,
        fee_collection_rate=full.fee_collection_rate,
        today_attendance_rate=full.today_attendance_rate,
        classes_total=full.classes_total,
        classes_marked_today=full.classes_marked_today,
    )


@router.get(
    "/group-summary",
    response_model=GroupSummaryOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES))],
)
def get_group_summary(
    school_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Rolls up this school and every one of its branches — the group
    owner's command centre. `school_id` must be the group's own (top-level)
    school; call with your own school_id to see your whole group."""
    ensure_school_access(db, current_user, school_id)
    group = db.get(School, school_id)
    if group is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "School not found")

    branches = db.query(School).filter_by(parent_school_id=school_id).order_by(School.name).all()
    rows = [_lean_branch_summary(db, group, is_group=True)]
    rows += [_lean_branch_summary(db, b, is_group=False) for b in branches]

    total_billed = sum(r.amount_billed for r in rows)
    total_paid = sum(r.amount_paid for r in rows)

    return GroupSummaryOut(
        group_id=group.id,
        group_name=group.name,
        rows=rows,
        total_students=sum(r.total_students for r in rows),
        total_active_staff=sum(r.active_staff for r in rows),
        total_amount_billed=round(total_billed, 2),
        total_amount_paid=round(total_paid, 2),
        overall_fee_collection_rate=round(total_paid / total_billed * 100, 1) if total_billed else 0.0,
    )
