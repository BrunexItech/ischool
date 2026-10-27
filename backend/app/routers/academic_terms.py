from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

import re

from app.core.dates import school_today
from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_roles
from app.models.academic_term import AcademicTerm
from app.models.user import User, UserRole
from app.schemas.academic_term import AcademicTermCreate, AcademicTermOut

router = APIRouter(prefix="/schools/{school_id}/academic-terms", tags=["academic terms"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.TEACHER, UserRole.STAFF, UserRole.SECRETARY)
ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.SECRETARY)


def _term_year(term_name: str, start, end) -> int | None:
    """The school year a term belongs to: from its dates, or a year written in its name."""
    if end is not None:
        return end.year
    if start is not None:
        return start.year
    found = re.findall(r"\b(20\d{2})\b", term_name)
    return int(found[-1]) if found else None


def _ensure_not_finished_year(db: Session, school_id: int, year: int | None) -> None:
    this_year = school_today(db, school_id).year
    if year is not None and year < this_year:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{year} is over. A term cannot be set for a year that has already finished.")


@router.get("", response_model=list[AcademicTermOut], dependencies=[Depends(require_roles(*VIEW_ROLES))])
def list_terms(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
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
    ensure_school_access(db, current_user, school_id)
    if payload.start_date and payload.end_date and payload.end_date < payload.start_date:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The term cannot end before it starts")
    _ensure_not_finished_year(db, school_id, _term_year(payload.name, payload.start_date, payload.end_date))
    if payload.start_date:
        _ensure_not_finished_year(db, school_id, payload.start_date.year)
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
    ensure_school_access(db, current_user, school_id)
    term = db.query(AcademicTerm).filter_by(school_id=school_id, id=term_id).first()
    if term is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Term not found")
    _ensure_not_finished_year(db, school_id, _term_year(term.name, term.start_date, term.end_date))

    db.query(AcademicTerm).filter_by(school_id=school_id).update({"is_current": False})
    term.is_current = True
    db.commit()
    db.refresh(term)
    return term
