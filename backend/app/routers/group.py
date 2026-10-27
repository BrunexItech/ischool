"""The group principal's view across every school they are attached to.
Everything here is read-only except the principal's own report email."""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.activity_feed import KINDS
from app.core.database import get_db
from app.core.deps import get_current_user, require_roles
from app.core.group_metrics import MODULES, ORDER, compare_module
from app.core.group_overview import group_activity, group_overview, group_report, schools_of
from app.models.user import User, UserRole
from app.schemas.group import GroupActivity, GroupComparison, GroupModuleInfo, GroupOverview, GroupSchool, GroupWeeklyReport

router = APIRouter(prefix="/group", tags=["group"], dependencies=[Depends(require_roles(UserRole.GROUP_PRINCIPAL))])


@router.get("/schools", response_model=list[GroupSchool])
def my_schools(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """The schools this principal is attached to, and no others."""
    return [GroupSchool(id=s.id, name=s.name) for s in schools_of(db, user)]


@router.get("/overview", response_model=GroupOverview)
def overview(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return group_overview(db, user)


@router.get("/modules", response_model=list[GroupModuleInfo])
def module_list():
    return [GroupModuleInfo(key=k, title=MODULES[k].title, blurb=MODULES[k].blurb) for k in ORDER]


@router.get("/modules/{key}", response_model=GroupComparison)
def module_comparison(key: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """One module, every attached school side by side, with a group total."""
    result = compare_module(db, schools_of(db, user), key)
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such module")
    return result


@router.get("/activity", response_model=GroupActivity)
def activity(start: date | None = None, end: date | None = None, kinds: str | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """What happened across all the schools between two dates (default: the last three days)."""
    from app.core.dates import school_today

    schools = schools_of(db, user)
    today = max((school_today(db, s.id) for s in schools), default=date.today())
    last = end or start or today
    first = start or (last - timedelta(days=2))
    if last < first:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The end date is before the start date")
    if (last - first).days > 31:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Pick a span of a month or less")
    wanted = {k for k in (kinds or "").split(",") if k in KINDS} or None
    return group_activity(db, user, first, last, wanted)


@router.get("/weekly-report", response_model=GroupWeeklyReport)
def weekly_report_view(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return group_report(db, user)


@router.post("/weekly-report/email-me")
def email_me(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Send this week's group report to the signed-in principal now."""
    from app.services.principal_report import email_principal

    return {"sent": email_principal(db, user)}
