from app.core.subjects import ensure_subject_fits_class
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.academics import SchoolClass
from app.models.results import Subject
from app.models.timetable import TimetableSlot
from app.models.user import User, UserRole
from app.core.approvals import submit_or_apply
from app.core.day_structure import LEVELS, default_day, validate_day
from app.models.school_period import TEACHABLE_KINDS, SchoolPeriod
from app.schemas.timetable import DayIn, DayResult, MyTimetableSlotOut, PeriodOut, TimetableSlotCreate, TimetableSlotDetailOut, TimetableSlotOut

router = APIRouter(prefix="/schools/{school_id}/timetable", tags=["timetable"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.TEACHER, UserRole.STAFF, UserRole.SECRETARY)
MANAGE_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.SECRETARY)


def _detail_out(slot: TimetableSlot) -> TimetableSlotDetailOut:
    return TimetableSlotDetailOut(
        **TimetableSlotOut.model_validate(slot).model_dump(),
        class_name=slot.school_class.name,
        subject_name=slot.subject.name,
        teacher_name=slot.teacher.full_name if slot.teacher else None,
    )


def _level_of(cls: SchoolClass) -> str:
    return cls.grade.level_group.value if cls.grade else "other"


def _resolve_window(db: Session, school_id: int, cls: SchoolClass, payload: TimetableSlotCreate) -> TimetableSlotCreate:
    """Turn a chosen block of the school day into concrete times. Once a level
    has its day set, lessons must sit inside a block, so a lesson can never
    land on a break or off the bell."""
    level = _level_of(cls)
    has_day = db.query(SchoolPeriod.id).filter_by(school_id=school_id, level_group=level).first() is not None
    if payload.period_id is None:
        if has_day:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Choose one of the lesson periods set for {level.replace('_', ' ')} classes")
        return payload
    period = db.query(SchoolPeriod).filter_by(school_id=school_id, id=payload.period_id).first()
    if period is None or period.level_group != level:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"That period does not belong to {cls.name}'s level")
    if period.kind not in TEACHABLE_KINDS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{period.name} is not a teaching period")
    if payload.day_of_week not in period.days:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{period.name} does not run on that day")
    return payload.model_copy(update={"start_time": period.start_time, "end_time": period.end_time})


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
    "/periods",
    response_model=list[PeriodOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES, UserRole.STUDENT, UserRole.PARENT)), Depends(require_feature("timetable"))],
)
def list_periods(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The school day for every level: lessons, breaks, lunch and prep."""
    ensure_school_access(db, current_user, school_id)
    return db.query(SchoolPeriod).filter_by(school_id=school_id).order_by(SchoolPeriod.level_group, SchoolPeriod.position).all()


@router.get(
    "/periods/template",
    dependencies=[Depends(require_roles(*MANAGE_ROLES)), Depends(require_feature("timetable"))],
)
def period_template(school_id: int, level_group: str, with_prep: bool = False, current_user: User = Depends(get_current_user)):
    """A suggested day for a level, to adjust. Nothing is saved."""
    if level_group not in LEVELS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown level")
    return default_day(level_group, with_prep)


@router.put(
    "/periods/{level_group}",
    response_model=DayResult,
    dependencies=[Depends(require_roles(*MANAGE_ROLES)), Depends(require_feature("timetable"))],
)
def set_day(school_id: int, level_group: str, payload: DayIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Set a level's school day. The head's change applies at once; the
    secretary's waits for the head to approve it."""
    ensure_school_access(db, current_user, school_id)
    if level_group not in LEVELS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown level")
    body = [p.model_dump(mode="json") for p in payload.periods]
    validate_day(body)  # reject a bad proposal now, not when the head opens it
    label = level_group.replace("_", " ").title()
    lessons = sum(1 for p in payload.periods if p.kind == "lesson")
    req = submit_or_apply(
        db, school_id, current_user, kind="bell_schedule", scope=level_group,
        title=f"School day for {label}", summary=f"{len(payload.periods)} blocks, {lessons} lessons", payload={"level_group": level_group, "periods": body},
    )
    db.commit()
    if req is not None:
        return DayResult(applied=False, request_id=req.id, message="Sent to the head of institution for approval.")
    return DayResult(applied=True, message="The school day has been saved.")


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
    ensure_subject_fits_class(db, school_id, payload.subject_id, payload.class_id)
    if payload.teacher_user_id is not None:
        teacher = db.query(User).filter_by(school_id=school_id, id=payload.teacher_user_id, role=UserRole.TEACHER).first()
        if teacher is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That user is not a teacher at this school")

    payload = _resolve_window(db, school_id, cls, payload)
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

    cls = db.query(SchoolClass).filter_by(school_id=school_id, id=payload.class_id).first()
    if cls is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That class does not belong to this school")
    ensure_subject_fits_class(db, school_id, payload.subject_id, payload.class_id)
    payload = _resolve_window(db, school_id, cls, payload)
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
