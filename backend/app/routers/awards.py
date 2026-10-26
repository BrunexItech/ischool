from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.awards import (
    can_see_award,
    create_award,
    deny,
    homeroom_class_ids,
    is_admin,
    teacher_class_ids,
)
from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.academics import SchoolClass, Student
from app.models.activity import Activity, ActivityParticipant
from app.models.award import Award
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import User, UserRole
from app.schemas.award import AwardCreate, AwardOut

router = APIRouter(prefix="/schools/{school_id}/awards", tags=["awards"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.TEACHER, UserRole.STAFF)
UNDO_WINDOW = timedelta(hours=24)


@router.get(
    "",
    response_model=list[AwardOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("awards"))],
)
def list_awards(
    school_id: int,
    student_id: int | None = None,
    staff_user_id: int | None = None,
    class_id: int | None = None,
    scope: str | None = None,
    term: str | None = None,
    category: str | None = None,
    include_shared: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Awards the viewer is allowed to see. With `student_id` and
    `include_shared`, a learner's own awards plus the class and school-wide
    awards that include them."""
    ensure_school_access(db, current_user, school_id)
    query = db.query(Award).filter_by(school_id=school_id)
    if staff_user_id is not None:
        query = query.filter_by(staff_user_id=staff_user_id)
    if class_id is not None:
        query = query.filter_by(class_id=class_id)
    if scope is not None:
        query = query.filter_by(scope=scope)
    if term is not None:
        query = query.filter_by(term=term)
    if category is not None:
        query = query.filter_by(category=category)
    awards = query.order_by(Award.date_awarded.desc(), Award.id.desc()).all()

    if student_id is not None:
        student = db.query(Student).filter_by(school_id=school_id, id=student_id).first()
        keep = []
        for a in awards:
            if a.student_id == student_id:
                keep.append(a)
            elif include_shared and student is not None and (a.scope == "school" or (a.scope == "class" and a.class_id == student.class_id)):
                keep.append(a)
        awards = keep
    return [a for a in awards if can_see_award(db, school_id, current_user, a)]


@router.post(
    "",
    response_model=AwardOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("awards"))],
)
def create_award_endpoint(
    school_id: int, payload: AwardCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Who may give what:
    - head / principal: a learner, a class, the whole school, or a staff member;
    - a class teacher: a learner in, or the whole of, their own class;
    - a subject teacher: a learner in a class they teach (optionally naming the subject);
    - other staff: only a learner who took part in an activity they run."""
    ensure_school_access(db, current_user, school_id)
    admin = is_admin(current_user)
    scope = payload.scope or "student"
    kwargs = dict(
        school_id=school_id,
        giver=current_user,
        scope=scope,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        date_awarded=payload.date_awarded,
        subject_id=payload.subject_id,
        activity_id=payload.activity_id,
        notify_guardian=payload.notify_guardian,
    )

    if scope in ("school", "staff") and not admin:
        deny("Only the head of institution can give a whole-school award or recognise a staff member")

    if scope == "school":
        return _commit(db, create_award(db, **kwargs))

    if scope == "staff":
        staff = db.query(User).filter_by(school_id=school_id, id=payload.staff_user_id).first()
        if staff is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That staff member does not belong to this school")
        return _commit(db, create_award(db, staff_user_id=staff.id, **kwargs))

    if scope == "class":
        cls = db.query(SchoolClass).filter_by(school_id=school_id, id=payload.class_id).first()
        if cls is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That class does not belong to this school")
        if not admin and not (current_user.role == UserRole.TEACHER and cls.id in homeroom_class_ids(db, school_id, current_user)):
            deny("Only the class teacher can give an award to the whole class")
        return _commit(db, create_award(db, school_class=cls, **kwargs))

    # scope == "student"
    student = db.query(Student).filter_by(school_id=school_id, id=payload.student_id).first()
    if student is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That student does not belong to this school")
    if current_user.role == UserRole.TEACHER:
        if student.class_id not in teacher_class_ids(db, school_id, current_user):
            deny("You don't teach this student")
        if payload.subject_id is not None:
            teaches = (
                db.query(TeacherAssignment)
                .filter_by(school_id=school_id, teacher_user_id=current_user.id, class_id=student.class_id, subject_id=payload.subject_id)
                .first()
                is not None
            )
            if not teaches:
                deny("You are not assigned to teach that subject in this class")
    elif current_user.role == UserRole.STAFF:
        activity = db.query(Activity).filter_by(school_id=school_id, id=payload.activity_id).first() if payload.activity_id else None
        took_part = activity is not None and (
            db.query(ActivityParticipant).filter_by(activity_id=activity.id, student_id=student.id).first() is not None
        )
        if activity is None or activity.created_by != current_user.id or not took_part:
            deny("Staff can give an award only to a learner who took part in an activity they run")
    return _commit(db, create_award(db, student=student, **kwargs))


def _commit(db: Session, award: Award | None) -> Award:
    db.commit()
    db.refresh(award)
    return award


@router.get(
    "/{award_id}",
    response_model=AwardOut,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("awards"))],
)
def get_award(school_id: int, award_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    award = db.query(Award).filter_by(school_id=school_id, id=award_id).first()
    if award is None or not can_see_award(db, school_id, current_user, award):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Award not found")
    return award


@router.delete(
    "/{award_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("awards"))],
)
def delete_award(school_id: int, award_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Leadership can remove any award. A giver can undo their own mistake
    within 24 hours."""
    ensure_school_access(db, current_user, school_id)
    award = db.query(Award).filter_by(school_id=school_id, id=award_id).first()
    if award is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Award not found")
    if not is_admin(current_user):
        recent = award.created_at is not None and datetime.now(timezone.utc) - award.created_at <= UNDO_WINDOW
        if award.awarded_by != current_user.id or not recent:
            deny("You can only take back an award you gave in the last 24 hours")
    db.delete(award)
    db.commit()
