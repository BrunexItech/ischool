from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dates import school_today
from app.core.database import get_db
from app.core.notify import notify
from app.core.staff_presence import TRACKED_ROLES, build_day, build_summary, get_settings, tracked_staff
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.core.security import create_attendance_qr_token, decode_attendance_qr_token
from app.models.staff_attendance import (
    DutyAssignment,
    StaffAbsenceNote,
    StaffAttendance,
    StaffAttendanceSettings,
    StaffLeave,
    StaffTrackingExclusion,
)
from app.models.user import User, UserRole
from app.schemas.staff_attendance import (
    AbsenceNoteSet,
    LeaveCreate,
    LeaveOut,
    StaffDayOut,
    StaffPersonOut,
    StaffSettingsOut,
    StaffSettingsUpdate,
    StaffSummaryOut,
    TrackingSet,
    AttendanceQrCodeOut,
    AttendanceQrScanRequest,
    AttendanceQrScanResult,
    DutyAssignmentCreate,
    DutyAssignmentOut,
    DutyAssignmentWithNameOut,
    StaffAttendanceOut,
    StaffAttendanceWithNameOut,
    StaffClockInRequest,
)

router = APIRouter(prefix="/schools/{school_id}", tags=["staff attendance"])

# Every employed role — anyone who actually clocks in/has duties, i.e.
# not a student or parent.
EMPLOYEE_ROLES = (
    UserRole.SUPER_ADMIN,
    UserRole.HEAD_OF_INSTITUTION,
    UserRole.TEACHER,
    UserRole.STAFF,
    UserRole.SECURITY,
    UserRole.BOARDING_STAFF,
    UserRole.TRANSPORT_STAFF,
    UserRole.BURSAR,
)
ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL)


# --- Staff attendance (clock in/out) ---


@router.get(
    "/staff-attendance/qr-code",
    response_model=AttendanceQrCodeOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("staff_attendance"))],
)
def get_attendance_qr_code(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The signed token this school's printable attendance QR code encodes
    — the frontend renders it into an actual QR image client-side."""
    ensure_school_access(db, current_user, school_id)
    return AttendanceQrCodeOut(token=create_attendance_qr_token(school_id))


@router.post(
    "/staff-attendance/scan",
    response_model=AttendanceQrScanResult,
    dependencies=[Depends(require_roles(*EMPLOYEE_ROLES)), Depends(require_feature("staff_attendance"))],
)
def scan_attendance_qr(
    school_id: int,
    payload: AttendanceQrScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """One scan toggles: clocks in if not yet in today, clocks out if
    already in and not yet out. The scanned code must belong to this
    school — proves whoever is scanning is physically at its printed
    location, not just anywhere with the app open."""
    ensure_school_access(db, current_user, school_id)
    token_school_id = decode_attendance_qr_token(payload.token)
    if token_school_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That QR code isn't a valid attendance code")
    if token_school_id != school_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That QR code belongs to a different school")

    today = school_today(db, school_id)
    record = db.query(StaffAttendance).filter_by(school_id=school_id, user_id=current_user.id, date=today).first()
    if record is None:
        record = StaffAttendance(school_id=school_id, user_id=current_user.id, date=today)
        db.add(record)

    if record.clocked_in_at is None:
        record.clocked_in_at = datetime.now(timezone.utc)
        action = "clocked_in"
    elif record.clocked_out_at is None:
        record.clocked_out_at = datetime.now(timezone.utc)
        action = "clocked_out"
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You've already clocked in and out today")

    db.commit()
    db.refresh(record)
    return AttendanceQrScanResult(action=action, record=record)


@router.post(
    "/staff-attendance/clock-in",
    response_model=StaffAttendanceOut,
    dependencies=[Depends(require_roles(*EMPLOYEE_ROLES)), Depends(require_feature("staff_attendance"))],
)
def clock_in(
    school_id: int, payload: StaffClockInRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    today = school_today(db, school_id)
    record = db.query(StaffAttendance).filter_by(school_id=school_id, user_id=current_user.id, date=today).first()
    if record is None:
        record = StaffAttendance(school_id=school_id, user_id=current_user.id, date=today)
        db.add(record)
    record.clocked_in_at = datetime.now(timezone.utc)
    if payload.note:
        record.note = payload.note
    db.commit()
    db.refresh(record)
    return record


@router.post(
    "/staff-attendance/clock-out",
    response_model=StaffAttendanceOut,
    dependencies=[Depends(require_roles(*EMPLOYEE_ROLES)), Depends(require_feature("staff_attendance"))],
)
def clock_out(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    today = school_today(db, school_id)
    record = db.query(StaffAttendance).filter_by(school_id=school_id, user_id=current_user.id, date=today).first()
    if record is None or record.clocked_in_at is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You haven't clocked in today")
    record.clocked_out_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(record)
    return record


@router.get(
    "/staff-attendance/mine",
    response_model=list[StaffAttendanceOut],
    dependencies=[Depends(require_roles(*EMPLOYEE_ROLES)), Depends(require_feature("staff_attendance"))],
)
def my_staff_attendance(
    school_id: int,
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    query = db.query(StaffAttendance).filter_by(school_id=school_id, user_id=current_user.id)
    if date_from is not None:
        query = query.filter(StaffAttendance.date >= date_from)
    if date_to is not None:
        query = query.filter(StaffAttendance.date <= date_to)
    return query.order_by(StaffAttendance.date.desc()).all()


@router.get(
    "/staff-attendance",
    response_model=list[StaffAttendanceWithNameOut],
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("staff_attendance"))],
)
def list_staff_attendance(
    school_id: int,
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    user_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    query = db.query(StaffAttendance).filter_by(school_id=school_id)
    if date_from is not None:
        query = query.filter(StaffAttendance.date >= date_from)
    if date_to is not None:
        query = query.filter(StaffAttendance.date <= date_to)
    if user_id is not None:
        query = query.filter(StaffAttendance.user_id == user_id)
    records = query.order_by(StaffAttendance.date.desc()).all()
    return [
        StaffAttendanceWithNameOut(**StaffAttendanceOut.model_validate(r).model_dump(), staff_name=r.user.full_name)
        for r in records
    ]


# --- Who was expected, who came ---


@router.get(
    "/staff-attendance/day",
    response_model=StaffDayOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("staff_attendance"))],
)
def staff_day(school_id: int, on: date | None = Query(default=None, alias="date"), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Everyone expected on a school day, each with a status, so an absence
    shows up as an absence instead of as nothing."""
    ensure_school_access(db, current_user, school_id)
    return build_day(db, school_id, on or school_today(db, school_id))


@router.get(
    "/staff-attendance/summary",
    response_model=StaffSummaryOut,
    dependencies=[Depends(require_roles(*EMPLOYEE_ROLES)), Depends(require_feature("staff_attendance"))],
)
def staff_summary(
    school_id: int,
    date_from: date,
    date_to: date,
    user_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Days present, late, on leave and absent per person. Leadership sees
    everyone; anyone else only themselves."""
    ensure_school_access(db, current_user, school_id)
    if date_to < date_from:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The end date must not be before the start date")
    if (date_to - date_from).days > 400:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose a range of a year or less")
    only = user_id if current_user.role in ADMIN_ROLES else current_user.id
    return build_summary(db, school_id, date_from, date_to, only)


@router.get(
    "/staff-attendance/settings",
    response_model=StaffSettingsOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("staff_attendance"))],
)
def get_staff_settings(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    late, absent = get_settings(db, school_id)
    return StaffSettingsOut(late_after=late, absent_after=absent)


@router.put(
    "/staff-attendance/settings",
    response_model=StaffSettingsOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("staff_attendance"))],
)
def set_staff_settings(school_id: int, payload: StaffSettingsUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    if payload.absent_after <= payload.late_after:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The absent time must be later than the late time")
    row = db.get(StaffAttendanceSettings, school_id)
    if row is None:
        row = StaffAttendanceSettings(school_id=school_id, late_after=payload.late_after, absent_after=payload.absent_after)
        db.add(row)
    row.late_after, row.absent_after = payload.late_after, payload.absent_after
    db.commit()
    return StaffSettingsOut(late_after=row.late_after, absent_after=row.absent_after)


@router.get(
    "/staff-attendance/people",
    response_model=list[StaffPersonOut],
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("staff_attendance"))],
)
def tracked_people(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    excluded = {e.user_id for e in db.query(StaffTrackingExclusion).filter_by(school_id=school_id).all()}
    users = db.query(User).filter(User.school_id == school_id, User.is_active.is_(True), User.role.in_(TRACKED_ROLES)).order_by(User.full_name).all()
    return [StaffPersonOut(user_id=u.id, name=u.full_name, role=u.role.value, tracked=u.id not in excluded) for u in users]


@router.put(
    "/staff-attendance/tracking",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("staff_attendance"))],
)
def set_tracking(school_id: int, payload: TrackingSet, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Leave someone out of absence tracking (or put them back)."""
    ensure_school_access(db, current_user, school_id)
    person = db.query(User).filter_by(school_id=school_id, id=payload.user_id).first()
    if person is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Staff member not found")
    row = db.get(StaffTrackingExclusion, (school_id, payload.user_id))
    if payload.tracked and row is not None:
        db.delete(row)
    elif not payload.tracked and row is None:
        db.add(StaffTrackingExclusion(school_id=school_id, user_id=payload.user_id))
    db.commit()


def _leave_out(lv: StaffLeave, db: Session) -> LeaveOut:
    recorder = db.get(User, lv.recorded_by) if lv.recorded_by else None
    return LeaveOut(
        id=lv.id, user_id=lv.user_id, staff_name=lv.user.full_name, start_date=lv.start_date, end_date=lv.end_date,
        leave_type=lv.leave_type, note=lv.note, recorded_by_name=recorder.full_name if recorder else None,
    )


@router.get(
    "/staff-attendance/leaves",
    response_model=list[LeaveOut],
    dependencies=[Depends(require_roles(*EMPLOYEE_ROLES)), Depends(require_feature("staff_attendance"))],
)
def list_leaves(school_id: int, user_id: int | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Leave recorded for people. Leadership sees everyone's; anyone else only their own."""
    ensure_school_access(db, current_user, school_id)
    query = db.query(StaffLeave).filter_by(school_id=school_id)
    if current_user.role in ADMIN_ROLES:
        if user_id is not None:
            query = query.filter_by(user_id=user_id)
    else:
        query = query.filter_by(user_id=current_user.id)
    return [_leave_out(lv, db) for lv in query.order_by(StaffLeave.start_date.desc()).all()]


@router.post(
    "/staff-attendance/leaves",
    response_model=LeaveOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("staff_attendance"))],
)
def record_leave(school_id: int, payload: LeaveCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Leave is granted by school leadership; staff cannot give it to themselves."""
    ensure_school_access(db, current_user, school_id)
    if payload.end_date < payload.start_date:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The leave cannot end before it starts")
    person = db.query(User).filter_by(school_id=school_id, id=payload.user_id).first()
    if person is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Staff member not found")
    leave = StaffLeave(school_id=school_id, recorded_by=current_user.id, **payload.model_dump())
    db.add(leave)
    notify(
        db, school_id=school_id, user_id=person.id, title="Leave recorded for you",
        body=f"{payload.leave_type.replace('_', ' ').capitalize()} leave from {payload.start_date:%d %b} to {payload.end_date:%d %b %Y}.",
    )
    db.commit()
    db.refresh(leave)
    return _leave_out(leave, db)


@router.delete(
    "/staff-attendance/leaves/{leave_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("staff_attendance"))],
)
def delete_leave(school_id: int, leave_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    leave = db.query(StaffLeave).filter_by(school_id=school_id, id=leave_id).first()
    if leave is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Leave not found")
    db.delete(leave)
    db.commit()


@router.put(
    "/staff-attendance/notes",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("staff_attendance"))],
)
def set_absence_note(school_id: int, payload: AbsenceNoteSet, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Say why someone was away on a day they did not scan."""
    ensure_school_access(db, current_user, school_id)
    person = db.query(User).filter_by(school_id=school_id, id=payload.user_id).first()
    if person is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Staff member not found")
    row = db.query(StaffAbsenceNote).filter_by(user_id=payload.user_id, date=payload.date).first()
    if row is None:
        row = StaffAbsenceNote(school_id=school_id, user_id=payload.user_id, date=payload.date, reason=payload.reason)
        db.add(row)
    row.reason, row.note, row.recorded_by = payload.reason, (payload.note or "").strip() or None, current_user.id
    db.commit()


@router.delete(
    "/staff-attendance/notes",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("staff_attendance"))],
)
def clear_absence_note(school_id: int, user_id: int, on: date = Query(alias="date"), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    row = db.query(StaffAbsenceNote).filter_by(school_id=school_id, user_id=user_id, date=on).first()
    if row is not None:
        db.delete(row)
        db.commit()


# --- Duty roster ---


@router.post(
    "/duties",
    response_model=DutyAssignmentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("staff_attendance"))],
)
def create_duty(school_id: int, payload: DutyAssignmentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    staff = db.query(User).filter_by(school_id=school_id, id=payload.user_id).first()
    if staff is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That user does not belong to this school")

    duty = DutyAssignment(school_id=school_id, assigned_by=current_user.id, **payload.model_dump())
    db.add(duty)
    db.commit()
    db.refresh(duty)
    return duty


@router.get(
    "/duties",
    response_model=list[DutyAssignmentWithNameOut],
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("staff_attendance"))],
)
def list_duties(
    school_id: int,
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    query = db.query(DutyAssignment).filter_by(school_id=school_id)
    if date_from is not None:
        query = query.filter(DutyAssignment.date >= date_from)
    if date_to is not None:
        query = query.filter(DutyAssignment.date <= date_to)
    duties = query.order_by(DutyAssignment.date).all()
    return [DutyAssignmentWithNameOut(**DutyAssignmentOut.model_validate(d).model_dump(), staff_name=d.user.full_name) for d in duties]


@router.get(
    "/duties/mine",
    response_model=list[DutyAssignmentOut],
    dependencies=[Depends(require_roles(*EMPLOYEE_ROLES)), Depends(require_feature("staff_attendance"))],
)
def my_duties(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    today = date.today()
    return (
        db.query(DutyAssignment)
        .filter(DutyAssignment.school_id == school_id, DutyAssignment.user_id == current_user.id, DutyAssignment.date >= today - timedelta(days=1))
        .order_by(DutyAssignment.date)
        .all()
    )


@router.delete(
    "/duties/{duty_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("staff_attendance"))],
)
def delete_duty(school_id: int, duty_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    duty = db.query(DutyAssignment).filter_by(school_id=school_id, id=duty_id).first()
    if duty is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Duty not found")
    db.delete(duty)
    db.commit()
