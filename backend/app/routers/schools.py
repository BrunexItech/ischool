from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.chart_of_accounts import seed_chart_of_accounts
from app.core.demo_data import delete_demo_data, has_demo_data, seed_demo_data
from app.core.deps import ensure_school_access, get_current_user, require_roles
from app.core.security import ensure_password_strength, hash_password
from app.core.uploads import save_image
from app.models.module import MODULE_KEYS, SchoolModule
from app.models.school import School
from app.models.user import User, UserRole
from app.schemas.plan import SubscriptionUpdate
from app.schemas.school import (
    ModuleToggleOut,
    ModuleToggleUpdate,
    SchoolBrandingUpdate,
    SchoolCreate,
    SchoolOut,
    SchoolPublicOut,
)
from app.services.weekly_reports import send_all_weekly_reports

router = APIRouter(prefix="/schools", tags=["schools"])


@router.get("/by-slug/{slug}", response_model=SchoolPublicOut)
def get_school_branding(slug: str, db: Session = Depends(get_db)):
    """Public — the frontend calls this to resolve a tenant's branding by
    subdomain/slug, or by a school's own custom domain (e.g. a school that
    points portal.theirschool.ac.ke at us) — the two never collide in
    practice since a slug is a short label and a custom domain is a full
    hostname."""
    school = (
        db.query(School)
        .filter(School.is_active.is_(True))
        .filter((School.slug == slug) | (School.custom_domain == slug))
        .first()
    )
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
    ensure_password_strength(payload.admin_password)

    if payload.parent_school_id is not None and db.get(School, payload.parent_school_id) is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That parent school does not exist")

    school = School(
        name=payload.name,
        slug=payload.slug,
        country=payload.country,
        currency=payload.currency,
        timezone=payload.timezone,
        parent_school_id=payload.parent_school_id,
    )
    db.add(school)
    db.flush()  # get school.id before creating dependent rows

    for module_key in MODULE_KEYS:
        db.add(SchoolModule(school_id=school.id, module_key=module_key, enabled=True))
    seed_chart_of_accounts(db, school.id)

    admin = User(
        school_id=school.id,
        email=payload.admin_email,
        full_name=payload.admin_full_name,
        hashed_password=hash_password(payload.admin_password),
        role=UserRole.SCHOOL_ADMIN,
        must_change_password=True,
    )
    db.add(admin)

    db.commit()
    db.refresh(school)
    return school


@router.get(
    "/{school_id}",
    response_model=SchoolOut,
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SUPERVISOR))],
)
def get_school(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    school = db.get(School, school_id)
    if school is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "School not found")
    return school


@router.patch(
    "/{school_id}/subscription",
    response_model=SchoolOut,
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))],
)
def update_subscription(school_id: int, payload: SubscriptionUpdate, db: Session = Depends(get_db)):
    """Milai Group of Schools' own billing relationship with this school — separate from
    anything the school charges its own parents. No payment collection is
    wired to this; a super-admin sets these by hand for now."""
    school = db.get(School, school_id)
    if school is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "School not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(school, field, value)

    db.commit()
    db.refresh(school)
    return school


@router.get(
    "/{school_id}/branches",
    response_model=list[SchoolOut],
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SUPERVISOR))],
)
def list_branches(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return db.query(School).filter_by(parent_school_id=school_id).all()


@router.get("/{school_id}/branding", response_model=SchoolPublicOut)
def get_branding(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Any logged-in member of this school can read its branding — the
    dashboard chrome itself (sidebar accents, buttons) needs this for every
    role, not just admins, to actually look like the school's own site."""
    ensure_school_access(db, current_user, school_id)
    school = db.get(School, school_id)
    if school is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "School not found")
    return school


@router.patch(
    "/{school_id}/branding",
    response_model=SchoolOut,
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SUPERVISOR))],
)
def update_branding(
    school_id: int,
    payload: SchoolBrandingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    school = db.get(School, school_id)
    if school is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "School not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(school, field, value)

    db.commit()
    db.refresh(school)
    return school


@router.post(
    "/{school_id}/branding/logo",
    response_model=SchoolOut,
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SUPERVISOR))],
)
def upload_school_logo(
    school_id: int,
    logo: UploadFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    school = db.get(School, school_id)
    if school is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "School not found")

    relative_path = save_image(logo, subdir=f"schools/{school_id}", base_name="logo")
    school.logo_url = f"{settings.backend_url}/uploads/{relative_path}"
    db.commit()
    db.refresh(school)
    return school


@router.get(
    "/{school_id}/modules",
    response_model=list[ModuleToggleOut],
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SUPERVISOR))],
)
def list_modules(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return db.query(SchoolModule).filter_by(school_id=school_id).all()


@router.patch(
    "/{school_id}/modules/{module_key}",
    response_model=ModuleToggleOut,
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SUPERVISOR))],
)
def toggle_module(
    school_id: int,
    module_key: str,
    payload: ModuleToggleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)

    module = db.query(SchoolModule).filter_by(school_id=school_id, module_key=module_key).first()
    if module is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Module not found for this school")

    module.enabled = payload.enabled
    db.commit()
    db.refresh(module)
    return module


@router.post(
    "/{school_id}/demo-data",
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))],
)
def generate_demo_data(school_id: int, db: Session = Depends(get_db)):
    """Populate an otherwise-empty school with a small set of sample
    students/staff/classes for demoing the product. Everything it creates is
    tagged is_demo=True so it can be wiped with one click."""
    school = db.get(School, school_id)
    if school is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "School not found")
    try:
        return seed_demo_data(db, school)
    except ValueError as err:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(err))


@router.get(
    "/{school_id}/demo-data",
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))],
)
def demo_data_status(school_id: int, db: Session = Depends(get_db)):
    return {"has_demo_data": has_demo_data(db, school_id)}


@router.delete(
    "/{school_id}/demo-data",
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))],
)
def remove_demo_data(school_id: int, db: Session = Depends(get_db)):
    return delete_demo_data(db, school_id)


@router.post(
    "/weekly-reports/send",
    dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))],
)
def trigger_weekly_reports(db: Session = Depends(get_db)):
    """Manually fires the same weekly report run the scheduler triggers
    every Monday — for support/testing, or to resend after an outage."""
    return send_all_weekly_reports(db)
