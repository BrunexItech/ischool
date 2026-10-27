from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.calendar_event import CalendarEvent
from app.models.user import User, UserRole
from app.schemas.calendar_event import CalendarEventCreate, CalendarEventOut, CalendarEventUpdate

router = APIRouter(prefix="/schools/{school_id}/calendar-events", tags=["calendar"])

ALL_ROLES = (
    UserRole.SUPER_ADMIN,
    UserRole.HEAD_OF_INSTITUTION,
    UserRole.GROUP_PRINCIPAL,
    UserRole.TEACHER,
    UserRole.STAFF,
    UserRole.SECRETARY,
    UserRole.STUDENT,
    UserRole.PARENT,
)
EDIT_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.SECRETARY)


@router.get(
    "",
    response_model=list[CalendarEventOut],
    dependencies=[Depends(require_roles(*ALL_ROLES)), Depends(require_feature("school_calendar"))],
)
def list_events(
    school_id: int,
    from_date: date | None = None,
    to_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    query = db.query(CalendarEvent).filter_by(school_id=school_id)
    if from_date is not None:
        # Catches events that started before the window but still run into it.
        query = query.filter(or_(CalendarEvent.end_date >= from_date, CalendarEvent.start_date >= from_date))
    if to_date is not None:
        query = query.filter(CalendarEvent.start_date <= to_date)
    return query.order_by(CalendarEvent.start_date).all()


@router.post(
    "",
    response_model=CalendarEventOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*EDIT_ROLES)), Depends(require_feature("school_calendar"))],
)
def create_event(
    school_id: int,
    payload: CalendarEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    event = CalendarEvent(school_id=school_id, created_by=current_user.id, **payload.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.patch(
    "/{event_id}",
    response_model=CalendarEventOut,
    dependencies=[Depends(require_roles(*EDIT_ROLES)), Depends(require_feature("school_calendar"))],
)
def update_event(
    school_id: int,
    event_id: int,
    payload: CalendarEventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    event = db.query(CalendarEvent).filter_by(school_id=school_id, id=event_id).first()
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    updates = payload.model_dump(exclude_unset=True)
    new_start = updates.get("start_date", event.start_date)
    new_end = updates.get("end_date", event.end_date)
    if new_end is not None and new_end < new_start:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "end_date cannot be before start_date")

    for field, value in updates.items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return event


@router.delete(
    "/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*EDIT_ROLES)), Depends(require_feature("school_calendar"))],
)
def delete_event(
    school_id: int, event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    event = db.query(CalendarEvent).filter_by(school_id=school_id, id=event_id).first()
    if event is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    db.delete(event)
    db.commit()
