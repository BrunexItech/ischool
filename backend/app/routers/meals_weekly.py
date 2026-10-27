from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.approvals import submit_or_apply
from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.core.weekly_menu import default_menu, validate_menu
from app.models.meals import MealTime
from app.models.user import User, UserRole
from app.schemas.meals import MenuSaveResult, MenuSlotOut, WeeklyMenuIn, WeeklyMenuOut

router = APIRouter(prefix="/schools/{school_id}/meals", tags=["meals"], dependencies=[Depends(require_feature("meals"))])

# Everyone at the school can read the menu. Setting it is office and kitchen
# work: the head's change applies at once, anyone else's waits for the head.
SET_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.STAFF, UserRole.SECRETARY)
READ_ROLES = SET_ROLES + (
    UserRole.TEACHER, UserRole.STUDENT, UserRole.PARENT, UserRole.SECURITY, UserRole.BOARDING_STAFF,
    UserRole.TRANSPORT_STAFF, UserRole.TRANSPORT_ATTENDANT, UserRole.BURSAR, UserRole.LIBRARIAN,
    UserRole.STORE_KEEPER, UserRole.ACCOUNTANT, UserRole.PROCUREMENT_OFFICER,
)


def _out(rows: list[MealTime]) -> WeeklyMenuOut:
    return WeeklyMenuOut(
        slots=[
            MenuSlotOut(id=m.id, position=m.position, name=m.name, start_time=m.start_time, end_time=m.end_time, audience=m.audience, items={str(i.weekday): i.description for i in m.items})
            for m in sorted(rows, key=lambda r: r.position)
        ]
    )


@router.get("/weekly", response_model=WeeklyMenuOut, dependencies=[Depends(require_roles(*READ_ROLES))])
def get_weekly_menu(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The week's meals and when they are served. The same week repeats until it is changed."""
    ensure_school_access(db, current_user, school_id)
    return _out(db.query(MealTime).filter_by(school_id=school_id).all())


@router.get("/template", dependencies=[Depends(require_roles(*SET_ROLES))])
def menu_template(school_id: int, current_user: User = Depends(get_current_user)):
    """A starting set of meal times to fill in. Nothing is saved."""
    return default_menu()


@router.put("/weekly", response_model=MenuSaveResult, dependencies=[Depends(require_roles(*SET_ROLES))])
def set_weekly_menu(school_id: int, payload: WeeklyMenuIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    body = [s.model_dump(mode="json") for s in payload.slots]
    validate_menu(body)  # refuse a bad proposal now, not when the head opens it
    filled = sum(1 for s in body for t in s["items"].values() if t.strip())
    req = submit_or_apply(
        db, school_id, current_user, kind="meal_menu", scope=None,
        title="Weekly meal menu", summary=f"{len(body)} meals, {filled} dishes set", payload={"slots": body},
    )
    db.commit()
    if req is not None:
        return MenuSaveResult(applied=False, request_id=req.id, message="Sent to the head of institution for approval.")
    return MenuSaveResult(applied=True, message="The weekly menu has been saved.")
