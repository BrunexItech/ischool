from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from datetime import date

from app.core.dates import school_today
from app.core.oversight import attendance_oversight, class_cards, class_detail, head_overview, homework_grid, teacher_cards
from app.models.user import User, UserRole
from app.schemas.oversight import AttendanceOversight, ClassCard, ClassDetail, HeadOverview, HomeworkGrid, TeacherCard

router = APIRouter(prefix="/schools/{school_id}/oversight", tags=["oversight"])

LEADERSHIP = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL)
CLASS_VIEWERS = LEADERSHIP + (UserRole.STAFF,)


@router.get(
    "/classes",
    response_model=list[ClassCard],
    dependencies=[Depends(require_roles(*CLASS_VIEWERS)), Depends(require_feature("students_staff"))],
)
def classes_overview(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Every class at a glance: who teaches it, how many learners, whether
    today's register was taken, the average, syllabus coverage and open concerns."""
    ensure_school_access(db, current_user, school_id)
    return class_cards(db, school_id)


@router.get(
    "/classes/{class_id}",
    response_model=ClassDetail,
    dependencies=[Depends(require_roles(*CLASS_VIEWERS)), Depends(require_feature("students_staff"))],
)
def class_overview(school_id: int, class_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    detail = class_detail(db, school_id, class_id)
    if detail is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
    return detail


@router.get(
    "/teachers",
    response_model=list[TeacherCard],
    dependencies=[Depends(require_roles(*LEADERSHIP)), Depends(require_feature("students_staff"))],
)
def teachers_overview(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Every teacher at a glance: contact details, what and where they teach,
    today's presence, plan progress, lessons marked and homework given this week."""
    ensure_school_access(db, current_user, school_id)
    return teacher_cards(db, school_id)


@router.get(
    "/homework",
    response_model=HomeworkGrid,
    dependencies=[Depends(require_roles(*LEADERSHIP)), Depends(require_feature("homework"))],
)
def homework_overview(school_id: int, week: date | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """For each class and subject, each day of the week: was homework given
    (typed in, or on the board), declared as none, or not recorded?"""
    ensure_school_access(db, current_user, school_id)
    return homework_grid(db, school_id, week)


@router.get(
    "/attendance",
    response_model=AttendanceOversight,
    dependencies=[Depends(require_roles(*LEADERSHIP)), Depends(require_feature("attendance"))],
)
def attendance_overview(school_id: int, on: date | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Which registers were taken, by whom, and who is away, class by class."""
    ensure_school_access(db, current_user, school_id)
    return attendance_oversight(db, school_id, on or school_today(db, school_id))


@router.get(
    "/overview",
    response_model=HeadOverview,
    dependencies=[Depends(require_roles(*LEADERSHIP))],
)
def head_overview_endpoint(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Today's pulse and everything waiting on the head."""
    ensure_school_access(db, current_user, school_id)
    return head_overview(db, school_id)
