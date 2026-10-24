from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.academics import SchoolClass, Student
from app.models.award import Award
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import User, UserRole
from app.schemas.award import AwardCreate, AwardOut

router = APIRouter(prefix="/schools/{school_id}/awards", tags=["awards"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.TEACHER, UserRole.STAFF)
ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL)


@router.get(
    "",
    response_model=list[AwardOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("awards"))],
)
def list_awards(
    school_id: int,
    student_id: int | None = None,
    staff_user_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    query = db.query(Award).filter_by(school_id=school_id)
    if student_id is not None:
        query = query.filter_by(student_id=student_id)
    if staff_user_id is not None:
        query = query.filter_by(staff_user_id=staff_user_id)
    return query.order_by(Award.date_awarded.desc()).all()


@router.post(
    "",
    response_model=AwardOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("awards"))],
)
def create_award(
    school_id: int, payload: AwardCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Recognizing a student is open to any teacher/staff (scoped to their
    own classes if they're a teacher); recognizing a colleague is a
    leadership call, not something teachers hand out to each other."""
    ensure_school_access(db, current_user, school_id)

    if payload.staff_user_id is not None and current_user.role not in ADMIN_ROLES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only a school admin or supervisor can award a staff member")

    if payload.student_id is not None:
        student = db.query(Student).filter_by(school_id=school_id, id=payload.student_id).first()
        if student is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That student does not belong to this school")
        if current_user.role == UserRole.TEACHER:
            is_assigned = (
                db.query(TeacherAssignment).filter_by(school_id=school_id, teacher_user_id=current_user.id, class_id=student.class_id).first()
                is not None
            )
            is_homeroom = (
                student.class_id is not None
                and db.query(SchoolClass).filter_by(id=student.class_id, homeroom_teacher_id=current_user.id).first() is not None
            )
            if not (is_assigned or is_homeroom):
                raise HTTPException(status.HTTP_403_FORBIDDEN, "You don't teach this student")
    else:
        staff = db.query(User).filter_by(school_id=school_id, id=payload.staff_user_id).first()
        if staff is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That staff member does not belong to this school")

    award = Award(school_id=school_id, awarded_by=current_user.id, **payload.model_dump())
    db.add(award)
    db.commit()
    db.refresh(award)
    return award


@router.delete(
    "/{award_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("awards"))],
)
def delete_award(school_id: int, award_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    award = db.query(Award).filter_by(school_id=school_id, id=award_id).first()
    if award is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Award not found")

    db.delete(award)
    db.commit()
