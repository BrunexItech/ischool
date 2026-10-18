from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.academics import Student
from app.models.lead import Lead, LeadStage
from app.models.user import User, UserRole
from app.schemas.academics import StudentCreate, StudentOut
from app.schemas.lead import LeadCreate, LeadOut, LeadUpdate

router = APIRouter(prefix="/schools/{school_id}/leads", tags=["leads"])

ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)


@router.get(
    "",
    response_model=list[LeadOut],
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("admissions_crm"))],
)
def list_leads(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return db.query(Lead).filter_by(school_id=school_id).order_by(Lead.created_at.desc()).all()


@router.post(
    "",
    response_model=LeadOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("admissions_crm"))],
)
def create_lead(
    school_id: int, payload: LeadCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    lead = Lead(school_id=school_id, created_by=current_user.id, **payload.model_dump())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


@router.patch(
    "/{lead_id}",
    response_model=LeadOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("admissions_crm"))],
)
def update_lead(
    school_id: int,
    lead_id: int,
    payload: LeadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    lead = db.query(Lead).filter_by(school_id=school_id, id=lead_id).first()
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
    if lead.stage == LeadStage.ENROLLED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This lead has already been enrolled as a student")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(lead, field, value)
    db.commit()
    db.refresh(lead)
    return lead


@router.delete(
    "/{lead_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("admissions_crm"))],
)
def delete_lead(school_id: int, lead_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    lead = db.query(Lead).filter_by(school_id=school_id, id=lead_id).first()
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
    db.delete(lead)
    db.commit()


@router.post(
    "/{lead_id}/convert",
    response_model=StudentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("admissions_crm"))],
)
def convert_lead(
    school_id: int,
    lead_id: int,
    payload: StudentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Enrols the lead as a student in one step, and marks the lead enrolled."""
    ensure_school_access(db, current_user, school_id)
    lead = db.query(Lead).filter_by(school_id=school_id, id=lead_id).first()
    if lead is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lead not found")
    if lead.stage == LeadStage.ENROLLED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This lead has already been enrolled as a student")
    if db.query(Student).filter_by(school_id=school_id, admission_number=payload.admission_number).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A student with that admission number already exists")

    student = Student(school_id=school_id, **payload.model_dump())
    db.add(student)
    db.flush()

    lead.stage = LeadStage.ENROLLED
    lead.student_id = student.id

    db.commit()
    db.refresh(student)
    return student
