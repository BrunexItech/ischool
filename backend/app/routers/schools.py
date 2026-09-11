from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_roles
from app.core.security import hash_password
from app.models.module import MODULE_KEYS, SchoolModule
from app.models.school import School
from app.models.user import User, UserRole
from app.schemas.school import (
    ModuleToggleOut,
    ModuleToggleUpdate,
    SchoolBrandingUpdate,
    SchoolCreate,
    SchoolOut,
    SchoolPublicOut,
)

router = APIRouter(prefix="/schools", tags=["schools"])


@router.get("/by-slug/{slug}", response_model=SchoolPublicOut)
def get_school_branding(slug: str, db: Session = Depends(get_db)):
    """Public — the frontend calls this to resolve a tenant's branding by subdomain/slug."""
    school = db.query(School).filter_by(slug=slug, is_active=True).first()
    if school is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "School not found")
    return school


@router.get("", response_model=list[SchoolOut], dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))])
def list_schools(db: Session = Depends(get_db)):
    return db.query(School).all()


@router.post(
    "",
    response_model=SchoolOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))],
)
def onboard_school(payload: SchoolCreate, db: Session = Depends(get_db)):
    """Onboard a new school: creates the tenant, seeds its module toggles (all on by
    default), and creates its first school_admin user."""

    if db.query(School).filter_by(slug=payload.slug).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That slug is already taken")
    if db.query(User).filter_by(email=payload.admin_email).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That admin email is already registered")

    school = School(
        name=payload.name,
        slug=payload.slug,
        country=payload.country,
        currency=payload.currency,
        timezone=payload.timezone,
    )
    db.add(school)
    db.flush()  # get school.id before creating dependent rows

    for module_key in MODULE_KEYS:
        db.add(SchoolModule(school_id=school.id, module_key=module_key, enabled=True))

    admin = User(
        school_id=school.id,
        email=payload.admin_email,
        full_name=payload.admin_full_name,
        hashed_password=hash_password(payload.admin_password),
        role=UserRole.SCHOOL_ADMIN,
    )
    db.add(admin)

    db.commit()
    db.refresh(school)
    return school


@router.patch(
    "/{school_id}/branding",
    response_model=SchoolOut,
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN))],
)
def update_branding(school_id: int, payload: SchoolBrandingUpdate, db: Session = Depends(get_db)):
    school = db.get(School, school_id)
    if school is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "School not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(school, field, value)

    db.commit()
    db.refresh(school)
    return school


@router.get(
    "/{school_id}/modules",
    response_model=list[ModuleToggleOut],
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN))],
)
def list_modules(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(current_user, school_id)
    return db.query(SchoolModule).filter_by(school_id=school_id).all()


@router.patch(
    "/{school_id}/modules/{module_key}",
    response_model=ModuleToggleOut,
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN))],
)
def toggle_module(
    school_id: int,
    module_key: str,
    payload: ModuleToggleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)

    module = db.query(SchoolModule).filter_by(school_id=school_id, module_key=module_key).first()
    if module is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Module not found for this school")

    module.enabled = payload.enabled
    db.commit()
    db.refresh(module)
    return module
