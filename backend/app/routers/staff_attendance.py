from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.staff_attendance import DutyAssignment, StaffAttendance
from app.models.user import User, UserRole
from app.schemas.staff_attendance import (
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
    UserRole.SCHOOL_ADMIN,
    UserRole.TEACHER,
    UserRole.STAFF,
    UserRole.SECURITY,
    UserRole.BOARDING_STAFF,
    UserRole.TRANSPORT_STAFF,
    UserRole.BURSAR,
)
ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SUPERVISOR)


# --- Staff attendance (clock in/out) ---


@router.post(
    "/staff-attendance/clock-in",
    response_model=StaffAttendanceOut,
    dependencies=[Depends(require_roles(*EMPLOYEE_ROLES)), Depends(require_feature("staff_attendance"))],
)
def clock_in(
    school_id: int, payload: StaffClockInRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    today = date.today()
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
    today = date.today()
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
