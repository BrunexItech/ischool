from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.security import ensure_password_strength, hash_password
from app.models.school import School
from app.models.supervisor_link import SupervisorSchoolLink
from app.models.user import User, UserRole
from app.routers.dashboard import _lean_branch_summary
from app.schemas.supervisor import (
    LinkedSchoolOut,
    SupervisorCreate,
    SupervisorLinkCreate,
    SupervisorOut,
    SupervisorOverviewOut,
    SupervisorWithSchoolsOut,
)

router = APIRouter(tags=["supervisors"])


def _with_schools(db: Session, supervisor: User) -> SupervisorWithSchoolsOut:
    links = db.query(SupervisorSchoolLink).filter_by(supervisor_user_id=supervisor.id).all()
    schools = [LinkedSchoolOut(id=l.school.id, name=l.school.name) for l in links]
    return SupervisorWithSchoolsOut(**SupervisorOut.model_validate(supervisor).model_dump(), schools=schools)


# --- Super-admin: create and link supervisors ---


@router.get("/supervisors", response_model=list[SupervisorWithSchoolsOut], dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))])
def list_supervisors(db: Session = Depends(get_db)):
    supervisors = db.query(User).filter_by(role=UserRole.GROUP_PRINCIPAL).order_by(User.full_name).all()
    return [_with_schools(db, s) for s in supervisors]


@router.post(
    "/supervisors",
    response_model=SupervisorWithSchoolsOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))],
)
def create_supervisor(payload: SupervisorCreate, db: Session = Depends(get_db)):
    if db.query(User).filter_by(email=payload.email).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That email is already registered")
    ensure_password_strength(payload.password)

    supervisor = User(
        school_id=None,
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=UserRole.GROUP_PRINCIPAL,
        must_change_password=True,
    )
    db.add(supervisor)
    db.commit()
    db.refresh(supervisor)
    return _with_schools(db, supervisor)


@router.post(
    "/supervisors/{supervisor_id}/schools",
    response_model=SupervisorWithSchoolsOut,
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))],
)
def link_school(supervisor_id: int, payload: SupervisorLinkCreate, db: Session = Depends(get_db)):
    supervisor = db.query(User).filter_by(id=supervisor_id, role=UserRole.GROUP_PRINCIPAL).first()
    if supervisor is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Supervisor not found")
    school = db.get(School, payload.school_id)
    if school is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "School not found")

    existing = db.query(SupervisorSchoolLink).filter_by(supervisor_user_id=supervisor_id, school_id=payload.school_id).first()
    if existing is None:
        db.add(SupervisorSchoolLink(supervisor_user_id=supervisor_id, school_id=payload.school_id))
        db.commit()
    return _with_schools(db, supervisor)


@router.delete(
    "/supervisors/{supervisor_id}/schools/{school_id}",
    response_model=SupervisorWithSchoolsOut,
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))],
)
def unlink_school(supervisor_id: int, school_id: int, db: Session = Depends(get_db)):
    supervisor = db.query(User).filter_by(id=supervisor_id, role=UserRole.GROUP_PRINCIPAL).first()
    if supervisor is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Supervisor not found")

    link = db.query(SupervisorSchoolLink).filter_by(supervisor_user_id=supervisor_id, school_id=school_id).first()
    if link is not None:
        db.delete(link)
        db.commit()
    return _with_schools(db, supervisor)


# --- Supervisor's own view ---


@router.get(
    "/supervisor/schools",
    response_model=list[LinkedSchoolOut],
    dependencies=[Depends(require_roles(UserRole.GROUP_PRINCIPAL))],
)
def my_linked_schools(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    links = db.query(SupervisorSchoolLink).filter_by(supervisor_user_id=current_user.id).all()
    return [LinkedSchoolOut(id=l.school.id, name=l.school.name) for l in links]


@router.get(
    "/supervisor/overview",
    response_model=SupervisorOverviewOut,
    dependencies=[Depends(require_roles(UserRole.GROUP_PRINCIPAL))],
)
def my_overview(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Everything happening across every school this supervisor is linked
    to, in one glance — the same lean per-branch numbers a group owner sees,
    just sourced from explicit links instead of a parent/branch hierarchy."""
    links = db.query(SupervisorSchoolLink).filter_by(supervisor_user_id=current_user.id).all()
    rows = [_lean_branch_summary(db, l.school, is_group=False) for l in links]
    return SupervisorOverviewOut(
        schools=rows,
        total_students=sum(r.total_students for r in rows),
        total_active_staff=sum(r.active_staff for r in rows),
    )
