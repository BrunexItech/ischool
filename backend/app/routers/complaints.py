from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_roles
from app.models.academics import Student
from app.models.complaint import Complaint, ComplaintAudience, ComplaintStatus
from app.models.academics import SchoolClass
from app.models.user import User, UserRole
from app.schemas.complaint import ComplaintCreate, ComplaintOut, ComplaintRespond

router = APIRouter(prefix="/schools/{school_id}/complaints", tags=["complaints"])

RAISE_ROLES = (UserRole.STUDENT, UserRole.PARENT, UserRole.TEACHER)
ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL)


@router.post("", response_model=ComplaintOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles(*RAISE_ROLES))])
def raise_complaint(school_id: int, payload: ComplaintCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)

    class_id = None
    if payload.audience == ComplaintAudience.CLASS_TEACHER:
        if current_user.role == UserRole.STUDENT:
            student = db.query(Student).filter_by(school_id=school_id, user_id=current_user.id).first()
            class_id = student.class_id if student else None
        elif current_user.role == UserRole.PARENT:
            if payload.student_id is None:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "student_id is required to reach a class teacher")
            student = db.query(Student).filter_by(school_id=school_id, id=payload.student_id, guardian_user_id=current_user.id).first()
            if student is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
            class_id = student.class_id
        else:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Teachers can only raise complaints to the principal")
        if class_id is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This learner has no class assigned yet")

    complaint = Complaint(
        school_id=school_id,
        raised_by=current_user.id,
        raised_by_name=current_user.full_name,
        raised_by_role=current_user.role.value,
        audience=payload.audience,
        class_id=class_id,
        subject=payload.subject,
        message=payload.message,
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    return complaint


@router.get("", response_model=list[ComplaintOut])
def list_complaints(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    query = db.query(Complaint).filter_by(school_id=school_id)

    if current_user.role in ADMIN_ROLES:
        pass
    elif current_user.role == UserRole.TEACHER:
        homeroom_class_ids = [c.id for c in db.query(SchoolClass).filter_by(school_id=school_id, homeroom_teacher_id=current_user.id).all()]
        query = query.filter(Complaint.audience == ComplaintAudience.CLASS_TEACHER, Complaint.class_id.in_(homeroom_class_ids or [-1]))
    else:
        query = query.filter(Complaint.raised_by == current_user.id)

    return query.order_by(Complaint.created_at.desc()).all()


@router.post("/{complaint_id}/respond", response_model=ComplaintOut)
def respond_to_complaint(school_id: int, complaint_id: int, payload: ComplaintRespond, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    complaint = db.query(Complaint).filter_by(school_id=school_id, id=complaint_id).first()
    if complaint is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Complaint not found")

    if current_user.role not in ADMIN_ROLES:
        if current_user.role != UserRole.TEACHER or complaint.audience != ComplaintAudience.CLASS_TEACHER:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You can't respond to this complaint")
        is_homeroom = db.query(SchoolClass).filter_by(id=complaint.class_id, homeroom_teacher_id=current_user.id).first() is not None
        if not is_homeroom:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You can't respond to this complaint")

    complaint.response = payload.response
    complaint.status = ComplaintStatus.RESOLVED
    complaint.responded_by = current_user.id
    complaint.responded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(complaint)
    return complaint
