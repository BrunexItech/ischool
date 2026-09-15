from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.meals import MealMenu
from app.models.user import User, UserRole
from app.schemas.meals import MealMenuCreate, MealMenuOut, MealMenuUpdate

router = APIRouter(prefix="/schools/{school_id}/meal-menu", tags=["meals"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER, UserRole.STAFF)
ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.STAFF)


@router.get(
    "",
    response_model=list[MealMenuOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("meals"))],
)
def list_meal_menu(
    school_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)
    query = db.query(MealMenu).filter_by(school_id=school_id)
    if date_from is not None:
        query = query.filter(MealMenu.date >= date_from)
    if date_to is not None:
        query = query.filter(MealMenu.date <= date_to)
    return query.order_by(MealMenu.date, MealMenu.meal_type).all()


@router.post(
    "",
    response_model=MealMenuOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("meals"))],
)
def create_meal_menu_entry(
    school_id: int, payload: MealMenuCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(current_user, school_id)
    if db.query(MealMenu).filter_by(school_id=school_id, date=payload.date, meal_type=payload.meal_type).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{payload.meal_type.title()} for {payload.date} is already set")

    entry = MealMenu(school_id=school_id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.put(
    "/{menu_id}",
    response_model=MealMenuOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("meals"))],
)
def update_meal_menu_entry(
    school_id: int,
    menu_id: int,
    payload: MealMenuUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)
    entry = db.query(MealMenu).filter_by(school_id=school_id, id=menu_id).first()
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Menu entry not found")

    entry.description = payload.description
    db.commit()
    db.refresh(entry)
    return entry


@router.delete(
    "/{menu_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("meals"))],
)
def delete_meal_menu_entry(
    school_id: int, menu_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(current_user, school_id)
    entry = db.query(MealMenu).filter_by(school_id=school_id, id=menu_id).first()
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Menu entry not found")

    db.delete(entry)
    db.commit()
