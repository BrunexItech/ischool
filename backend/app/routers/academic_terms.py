from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_roles
from app.models.academic_term import AcademicTerm
from app.models.user import User, UserRole
from app.schemas.academic_term import AcademicTermCreate, AcademicTermOut

router = APIRouter(prefix="/schools/{school_id}/academic-terms", tags=["academic terms"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER, UserRole.STAFF)
ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)


@router.get("", response_model=list[AcademicTermOut], dependencies=[Depends(require_roles(*VIEW_ROLES))])
def list_terms(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(current_user, school_id)
    return db.query(AcademicTerm).filter_by(school_id=school_id).order_by(AcademicTerm.id.desc()).all()


@router.post(
    "",
    response_model=AcademicTermOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ADMIN_ROLES))],
)
def create_term(
    school_id: int,
    payload: AcademicTermCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)
    if db.query(AcademicTerm).filter_by(school_id=school_id, name=payload.name).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That term already exists")

    is_first = db.query(AcademicTerm).filter_by(school_id=school_id).count() == 0
    term = AcademicTerm(school_id=school_id, is_current=is_first, **payload.model_dump())
    db.add(term)
    db.commit()
    db.refresh(term)
    return term


@router.patch(
    "/{term_id}/set-current",
    response_model=AcademicTermOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES))],
)
def set_current_term(
    school_id: int,
    term_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)
    term = db.query(AcademicTerm).filter_by(school_id=school_id, id=term_id).first()
    if term is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Term not found")

    db.query(AcademicTerm).filter_by(school_id=school_id).update({"is_current": False})
    term.is_current = True
    db.commit()
    db.refresh(term)
    return term
