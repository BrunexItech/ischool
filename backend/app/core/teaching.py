from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.teacher_assignment import TeacherAssignment
from app.models.user import User, UserRole


def ensure_can_manage_attendance(db: Session, current_user: User, class_id: int) -> None:
    """Only constrains the TEACHER role — school_admin/staff/super_admin are unrestricted."""
    if current_user.role != UserRole.TEACHER:
        return
    assigned = db.query(TeacherAssignment).filter_by(teacher_user_id=current_user.id, class_id=class_id).first()
    if assigned is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not assigned to this class")


def ensure_can_grade(db: Session, current_user: User, class_id: int | None, subject_id: int) -> None:
    if current_user.role != UserRole.TEACHER:
        return
    if class_id is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This student has no class assigned yet")
    assigned = (
        db.query(TeacherAssignment)
        .filter_by(teacher_user_id=current_user.id, class_id=class_id, subject_id=subject_id)
        .first()
    )
    if assigned is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not assigned to teach this subject for this class")
