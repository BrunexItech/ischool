from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.academics import SchoolClass
from app.models.results import Subject
from app.models.timetable import TimetableSlot
from app.models.user import User, UserRole
from app.schemas.timetable import MyTimetableSlotOut, TimetableSlotCreate, TimetableSlotDetailOut, TimetableSlotOut

router = APIRouter(prefix="/schools/{school_id}/timetable", tags=["timetable"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SUPERVISOR, UserRole.TEACHER, UserRole.STAFF)
MANAGE_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SUPERVISOR)


def _detail_out(slot: TimetableSlot) -> TimetableSlotDetailOut:
    return TimetableSlotDetailOut(
        **TimetableSlotOut.model_validate(slot).model_dump(),
        class_name=slot.school_class.name,
        subject_name=slot.subject.name,
        teacher_name=slot.teacher.full_name if slot.teacher else None,
    )


def _check_collisions(db: Session, school_id: int, payload: TimetableSlotCreate, exclude_id: int | None = None) -> None:
    """A class can't have two periods at once, a teacher can't teach two
    classes at once, and (when given) a room can't host two classes at
    once — all checked as a day-of-week + time-range overlap."""
    overlap = and_(
        TimetableSlot.school_id == school_id,
        TimetableSlot.day_of_week == payload.day_of_week,
        TimetableSlot.start_time < payload.end_time,
        TimetableSlot.end_time > payload.start_time,
    )

    def _others(extra_filter):
        q = db.query(TimetableSlot).filter(overlap, extra_filter)
        if exclude_id is not None:
            q = q.filter(TimetableSlot.id != exclude_id)
        return q.first()

    class_clash = _others(TimetableSlot.class_id == payload.class_id)
    if class_clash:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"{class_clash.school_class.name} already has {class_clash.subject.name} scheduled at that time",
        )

    if payload.teacher_user_id is not None:
        teacher_clash = _others(TimetableSlot.teacher_user_id == payload.teacher_user_id)
        if teacher_clash:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"This teacher is already teaching {teacher_clash.school_class.name} at that time",
            )

    if payload.room:
        room_clash = _others(TimetableSlot.room == payload.room)
        if room_clash:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Room {payload.room} is already booked at that time")


@router.get(
    "",
    response_model=list[TimetableSlotDetailOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("timetable"))],
)
def list_timetable(
    school_id: int,
    class_id: int | None = Query(default=None),
    teacher_user_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    query = db.query(TimetableSlot).filter_by(school_id=school_id)
    if class_id is not None:
        query = query.filter_by(class_id=class_id)
    if teacher_user_id is not None:
        query = query.filter_by(teacher_user_id=teacher_user_id)
    slots = query.order_by(TimetableSlot.day_of_week, TimetableSlot.start_time).all()
    return [_detail_out(s) for s in slots]


@router.get(
    "/mine",
    response_model=list[MyTimetableSlotOut],
    dependencies=[Depends(require_roles(UserRole.TEACHER)), Depends(require_feature("timetable"))],
)
def list_my_timetable(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    slots = (
        db.query(TimetableSlot)
        .filter_by(school_id=school_id, teacher_user_id=current_user.id)
        .order_by(TimetableSlot.day_of_week, TimetableSlot.start_time)
        .all()
    )
    return [
        MyTimetableSlotOut(**TimetableSlotOut.model_validate(s).model_dump(), class_name=s.school_class.name, subject_name=s.subject.name)
        for s in slots
    ]


@router.post(
    "",
    response_model=TimetableSlotDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*MANAGE_ROLES)), Depends(require_feature("timetable"))],
)
def create_timetable_slot(
    school_id: int, payload: TimetableSlotCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)

    cls = db.query(SchoolClass).filter_by(school_id=school_id, id=payload.class_id).first()
    if cls is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That class does not belong to this school")
    subject = db.query(Subject).filter_by(school_id=school_id, id=payload.subject_id).first()
    if subject is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That subject does not belong to this school")
    if payload.teacher_user_id is not None:
        teacher = db.query(User).filter_by(school_id=school_id, id=payload.teacher_user_id, role=UserRole.TEACHER).first()
        if teacher is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That user is not a teacher at this school")

    _check_collisions(db, school_id, payload)

    slot = TimetableSlot(school_id=school_id, **payload.model_dump())
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return _detail_out(slot)


@router.patch(
    "/{slot_id}",
    response_model=TimetableSlotDetailOut,
    dependencies=[Depends(require_roles(*MANAGE_ROLES)), Depends(require_feature("timetable"))],
)
def update_timetable_slot(
    school_id: int,
    slot_id: int,
    payload: TimetableSlotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    slot = db.query(TimetableSlot).filter_by(school_id=school_id, id=slot_id).first()
    if slot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Timetable slot not found")

    _check_collisions(db, school_id, payload, exclude_id=slot_id)

    for field, value in payload.model_dump().items():
        setattr(slot, field, value)
    db.commit()
    db.refresh(slot)
    return _detail_out(slot)


@router.delete(
    "/{slot_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*MANAGE_ROLES)), Depends(require_feature("timetable"))],
)
def delete_timetable_slot(school_id: int, slot_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    slot = db.query(TimetableSlot).filter_by(school_id=school_id, id=slot_id).first()
    if slot is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Timetable slot not found")
    db.delete(slot)
    db.commit()
