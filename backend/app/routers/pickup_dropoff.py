from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.academics import Student
from app.models.pickup_dropoff import PickupDropoffLog
from app.models.user import User, UserRole
from app.schemas.pickup_dropoff import PickupDropoffCreate, PickupDropoffOut

router = APIRouter(prefix="/schools/{school_id}/students/{student_id}/pickup-dropoff", tags=["pickup-dropoff"])

LOG_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER, UserRole.STAFF)
ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)


def _get_student(db: Session, school_id: int, student_id: int) -> Student:
    student = db.query(Student).filter_by(school_id=school_id, id=student_id).first()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
    return student


@router.get(
    "",
    response_model=list[PickupDropoffOut],
    dependencies=[Depends(require_roles(*LOG_ROLES)), Depends(require_feature("pickup_dropoff"))],
)
def list_pickup_dropoff(
    school_id: int, student_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(current_user, school_id)
    _get_student(db, school_id, student_id)
    return (
        db.query(PickupDropoffLog)
        .filter_by(school_id=school_id, student_id=student_id)
        .order_by(PickupDropoffLog.occurred_at.desc())
        .all()
    )


@router.post(
    "",
    response_model=PickupDropoffOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*LOG_ROLES)), Depends(require_feature("pickup_dropoff"))],
)
def create_pickup_dropoff(
    school_id: int,
    student_id: int,
    payload: PickupDropoffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)
    _get_student(db, school_id, student_id)

    log = PickupDropoffLog(
        school_id=school_id,
        student_id=student_id,
        recorded_by=current_user.id,
        **payload.model_dump(exclude_none=True),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.delete(
    "/{log_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("pickup_dropoff"))],
)
def delete_pickup_dropoff(
    school_id: int, student_id: int, log_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(current_user, school_id)
    log = db.query(PickupDropoffLog).filter_by(school_id=school_id, student_id=student_id, id=log_id).first()
    if log is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Log entry not found")

    db.delete(log)
    db.commit()
