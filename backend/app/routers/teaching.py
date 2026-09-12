from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import User, UserRole
from app.schemas.teaching import TeacherAssignmentCreate, TeacherAssignmentOut

router = APIRouter(prefix="/schools/{school_id}/teacher-assignments", tags=["teacher assignments"])

ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)


@router.get(
    "",
    response_model=list[TeacherAssignmentOut],
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("students_staff"))],
)
def list_assignments(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(current_user, school_id)
    return db.query(TeacherAssignment).filter_by(school_id=school_id).all()


@router.post(
    "",
    response_model=TeacherAssignmentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("students_staff"))],
)
def create_assignment(
    school_id: int,
    payload: TeacherAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)

    teacher = db.query(User).filter_by(id=payload.teacher_user_id, school_id=school_id, role=UserRole.TEACHER).first()
    if teacher is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That user is not a teacher at this school")

    existing = (
        db.query(TeacherAssignment)
        .filter_by(teacher_user_id=payload.teacher_user_id, class_id=payload.class_id, subject_id=payload.subject_id)
        .first()
    )
    if existing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That assignment already exists")

    assignment = TeacherAssignment(school_id=school_id, **payload.model_dump())
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


@router.delete(
    "/{assignment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("students_staff"))],
)
def delete_assignment(
    school_id: int,
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)
    assignment = db.query(TeacherAssignment).filter_by(school_id=school_id, id=assignment_id).first()
    if assignment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Assignment not found")
    db.delete(assignment)
    db.commit()
