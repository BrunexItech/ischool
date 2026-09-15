from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.academics import Student
from app.models.award import Award
from app.models.user import User, UserRole
from app.schemas.award import AwardCreate, AwardOut

router = APIRouter(prefix="/schools/{school_id}/awards", tags=["awards"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER, UserRole.STAFF)
ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)


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
    ensure_school_access(current_user, school_id)
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
    ensure_school_access(current_user, school_id)

    if payload.student_id is not None:
        student = db.query(Student).filter_by(school_id=school_id, id=payload.student_id).first()
        if student is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That student does not belong to this school")
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
    ensure_school_access(current_user, school_id)
    award = db.query(Award).filter_by(school_id=school_id, id=award_id).first()
    if award is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Award not found")

    db.delete(award)
    db.commit()
