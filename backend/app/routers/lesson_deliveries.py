from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dates import school_today
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.academic_term import AcademicTerm
from app.models.calendar_event import CalendarEvent, CalendarEventType
from app.models.lesson_delivery import LessonDelivery
from app.models.lesson_plan import LessonPlan, LessonPlanEntry, LessonPlanEntryStatus
from app.models.timetable import TimetableSlot
from app.models.user import User, UserRole
from app.schemas.lesson_delivery import (
    CoverageOut,
    CoverageRow,
    DeliveryCreate,
    DeliveryOut,
    LessonDayOut,
    LessonItemOut,
    LessonPlanRef,
    RecordOfWorkRow,
)
from app.schemas.lesson_plan import LessonPlanEntryOut

router = APIRouter(prefix="/schools/{school_id}/lessons", tags=["lesson-deliveries"])

ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL)
FEATURE = Depends(require_feature("lesson_plans"))


def _delivery_out(d: LessonDelivery) -> DeliveryOut:
    return DeliveryOut(id=d.id, entry_id=d.entry_id, status=d.status, reason=d.reason, remark=d.remark, topic=d.topic)


def _term_for(db: Session, school_id: int, on: date) -> AcademicTerm | None:
    terms = db.query(AcademicTerm).filter_by(school_id=school_id).all()
    for t in terms:
        if t.start_date and t.end_date and t.start_date <= on <= t.end_date:
            return t
    return next((t for t in terms if t.is_current), None)


def _holiday_on(db: Session, school_id: int, on: date) -> str | None:
    events = db.query(CalendarEvent).filter_by(school_id=school_id, event_type=CalendarEventType.HOLIDAY).all()
    for e in events:
        if e.start_date <= on <= (e.end_date or e.start_date):
            return e.title
    return None


def _plan_for(db: Session, school_id: int, class_id: int, subject_id: int, term: AcademicTerm | None) -> LessonPlan | None:
    plans = db.query(LessonPlan).filter_by(school_id=school_id, class_id=class_id, subject_id=subject_id).all()
    if not plans:
        return None
    if term is not None:
        for p in plans:
            if p.term == term.name:
                return p
    return sorted(plans, key=lambda p: p.updated_at, reverse=True)[0]


def _sync_entry(db: Session, entry_id: int | None) -> None:
    """An entry counts as covered while at least one lesson was marked taught
    against it; undoing that lesson puts it back to planned."""
    if entry_id is None:
        return
    entry = db.get(LessonPlanEntry, entry_id)
    if entry is None:
        return
    taught = db.query(LessonDelivery.id).filter_by(entry_id=entry_id, status="taught").first() is not None
    entry.status = LessonPlanEntryStatus.COMPLETED if taught else LessonPlanEntryStatus.PLANNED


@router.get("/day", response_model=LessonDayOut, dependencies=[Depends(require_roles(UserRole.TEACHER)), FEATURE])
def lessons_for_day(
    school_id: int,
    on: date | None = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The teacher's timetabled lessons for one date, each with what was
    planned for it and whether it has been marked yet."""
    ensure_school_access(db, current_user, school_id)
    today = school_today(db, school_id)
    day = on or today
    term = _term_for(db, school_id, day)

    slots = (
        db.query(TimetableSlot)
        .filter_by(school_id=school_id, teacher_user_id=current_user.id, day_of_week=day.weekday())
        .order_by(TimetableSlot.start_time)
        .all()
    )
    deliveries = {
        d.timetable_slot_id: d
        for d in db.query(LessonDelivery).filter_by(teacher_user_id=current_user.id, lesson_date=day).all()
    }

    used_entries: set[int] = set()
    items: list[LessonItemOut] = []
    for slot in slots:
        plan = _plan_for(db, school_id, slot.class_id, slot.subject_id, term)
        delivery = deliveries.get(slot.id)
        entry = None
        if plan is not None:
            if delivery is not None and delivery.entry_id is not None:
                entry = next((e for e in plan.entries if e.id == delivery.entry_id), None)
            if entry is None and delivery is None:
                # A date-pinned entry wins; otherwise the next uncovered one.
                pinned = [e for e in plan.entries if e.scheduled_date == day and e.status == LessonPlanEntryStatus.PLANNED]
                open_entries = [
                    e
                    for e in plan.entries
                    if e.status == LessonPlanEntryStatus.PLANNED and (e.scheduled_date is None or e.scheduled_date <= day)
                ]
                entry = next((e for e in pinned + open_entries if e.id not in used_entries), None)
            if entry is not None:
                used_entries.add(entry.id)
        items.append(
            LessonItemOut(
                slot_id=slot.id,
                class_id=slot.class_id,
                class_name=slot.school_class.name,
                subject_id=slot.subject_id,
                subject_name=slot.subject.name,
                start_time=slot.start_time,
                end_time=slot.end_time,
                room=slot.room,
                plan=LessonPlanRef(plan_id=plan.id, term=plan.term, entry_count=plan.entry_count, completed_count=plan.completed_count)
                if plan
                else None,
                entry=LessonPlanEntryOut.model_validate(entry) if entry else None,
                delivery=_delivery_out(delivery) if delivery else None,
            )
        )
    return LessonDayOut(date=day, is_today=day == today, holiday=_holiday_on(db, school_id, day), lessons=items)


@router.post(
    "/deliveries", response_model=DeliveryOut, status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(UserRole.TEACHER)), FEATURE],
)
def mark_lesson(
    school_id: int, payload: DeliveryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Marks one timetabled lesson on one date as taught, partly taught or not
    taught. Marking it again simply corrects the earlier mark."""
    ensure_school_access(db, current_user, school_id)
    slot = db.query(TimetableSlot).filter_by(school_id=school_id, id=payload.timetable_slot_id).first()
    if slot is None or slot.teacher_user_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "That lesson is not on your timetable")
    if payload.lesson_date.weekday() != slot.day_of_week:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That lesson does not fall on this date")
    if payload.lesson_date > school_today(db, school_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A lesson can only be marked once its day has started")
    if payload.status == "not_taught" and not payload.reason:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Say why the lesson was not taught")

    entry: LessonPlanEntry | None = None
    if payload.entry_id is not None:
        entry = db.get(LessonPlanEntry, payload.entry_id)
        if entry is None or entry.lesson_plan.school_id != school_id or entry.lesson_plan.class_id != slot.class_id or entry.lesson_plan.subject_id != slot.subject_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That topic does not belong to this class and subject")

    delivery = (
        db.query(LessonDelivery)
        .filter_by(teacher_user_id=current_user.id, timetable_slot_id=slot.id, lesson_date=payload.lesson_date)
        .first()
    )
    previous_entry_id = delivery.entry_id if delivery else None
    if delivery is None:
        delivery = LessonDelivery(
            school_id=school_id,
            teacher_user_id=current_user.id,
            class_id=slot.class_id,
            subject_id=slot.subject_id,
            timetable_slot_id=slot.id,
            lesson_date=payload.lesson_date,
            start_time=slot.start_time,
            end_time=slot.end_time,
            status=payload.status,
        )
        db.add(delivery)

    delivery.status = payload.status
    delivery.reason = payload.reason if payload.status == "not_taught" else None
    delivery.remark = (payload.remark or "").strip() or None
    if payload.status != "not_taught" or entry is not None:
        delivery.entry_id = entry.id if entry else delivery.entry_id
    if entry is not None:
        delivery.topic = entry.topic
    db.flush()
    _sync_entry(db, delivery.entry_id)
    if previous_entry_id != delivery.entry_id:
        _sync_entry(db, previous_entry_id)
    db.commit()
    db.refresh(delivery)
    return _delivery_out(delivery)


@router.delete(
    "/deliveries/{delivery_id}", status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(UserRole.TEACHER)), FEATURE],
)
def undo_mark(school_id: int, delivery_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    delivery = db.query(LessonDelivery).filter_by(school_id=school_id, id=delivery_id, teacher_user_id=current_user.id).first()
    if delivery is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lesson record not found")
    entry_id = delivery.entry_id
    db.delete(delivery)
    db.flush()
    _sync_entry(db, entry_id)
    db.commit()


@router.get(
    "/deliveries", response_model=list[RecordOfWorkRow],
    dependencies=[Depends(require_roles(UserRole.TEACHER, *ADMIN_ROLES)), FEATURE],
)
def record_of_work(
    school_id: int,
    date_from: date | None = None,
    date_to: date | None = None,
    teacher_user_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The Record of Work Covered. A teacher gets their own; leadership can
    ask for any teacher's, or everyone's."""
    ensure_school_access(db, current_user, school_id)
    query = db.query(LessonDelivery).filter_by(school_id=school_id)
    if current_user.role == UserRole.TEACHER:
        query = query.filter_by(teacher_user_id=current_user.id)
    elif teacher_user_id is not None:
        query = query.filter_by(teacher_user_id=teacher_user_id)
    if date_from:
        query = query.filter(LessonDelivery.lesson_date >= date_from)
    if date_to:
        query = query.filter(LessonDelivery.lesson_date <= date_to)
    rows = query.order_by(LessonDelivery.lesson_date, LessonDelivery.start_time).all()
    return [
        RecordOfWorkRow(
            id=d.id,
            lesson_date=d.lesson_date,
            start_time=d.start_time,
            end_time=d.end_time,
            teacher_user_id=d.teacher_user_id,
            teacher_name=d.teacher.full_name,
            class_name=d.school_class.name,
            subject_name=d.subject.name,
            topic=d.topic,
            status=d.status,
            reason=d.reason,
            remark=d.remark,
        )
        for d in rows
    ]


@router.get("/coverage", response_model=CoverageOut, dependencies=[Depends(require_roles(*ADMIN_ROLES)), FEATURE])
def coverage(school_id: int, term: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """For the head of institution: per teacher, class and subject — how much
    of the plan is covered, how that compares with where the term should be
    by now, and what was missed and why."""
    ensure_school_access(db, current_user, school_id)
    term_row = db.query(AcademicTerm).filter_by(school_id=school_id, name=term).first()
    start = term_row.start_date if term_row else None
    end = term_row.end_date if term_row else None
    today = school_today(db, school_id)

    elapsed: float | None = None
    if start and end and end > start:
        elapsed = min(1.0, max(0.0, (today - start).days / (end - start).days))

    deliveries = db.query(LessonDelivery).filter_by(school_id=school_id)
    if start:
        deliveries = deliveries.filter(LessonDelivery.lesson_date >= start)
    if end:
        deliveries = deliveries.filter(LessonDelivery.lesson_date <= end)
    by_key: dict[tuple[int, int, int], list[LessonDelivery]] = {}
    for d in deliveries.all():
        by_key.setdefault((d.teacher_user_id, d.class_id, d.subject_id), []).append(d)

    slots = db.query(TimetableSlot).filter_by(school_id=school_id).all()
    plans = db.query(LessonPlan).filter_by(school_id=school_id, term=term).all()
    plan_by_scope = {(p.class_id, p.subject_id): p for p in plans}

    keys: dict[tuple[int | None, int, int], None] = {}
    for s in slots:
        keys[(s.teacher_user_id, s.class_id, s.subject_id)] = None
    for p in plans:
        keys.setdefault((p.created_by, p.class_id, p.subject_id), None)

    rows: list[CoverageRow] = []
    for teacher_id, class_id, subject_id in keys:
        plan = plan_by_scope.get((class_id, subject_id))
        ds = by_key.get((teacher_id, class_id, subject_id), []) if teacher_id else []
        sample = next((s for s in slots if s.class_id == class_id and s.subject_id == subject_id and s.teacher_user_id == teacher_id), None)
        teacher = db.get(User, teacher_id) if teacher_id else None
        class_name = sample.school_class.name if sample else (plan.school_class.name if plan else "")
        subject_name = sample.subject.name if sample else (plan.subject.name if plan else "")
        reasons: dict[str, int] = {}
        for d in ds:
            if d.status == "not_taught" and d.reason:
                reasons[d.reason] = reasons.get(d.reason, 0) + 1
        taught_dates = [d.lesson_date for d in ds if d.status == "taught"]
        rows.append(
            CoverageRow(
                teacher_user_id=teacher_id,
                teacher_name=teacher.full_name if teacher else "Unassigned",
                class_id=class_id,
                class_name=class_name,
                subject_id=subject_id,
                subject_name=subject_name,
                plan_id=plan.id if plan else None,
                entry_count=plan.entry_count if plan else 0,
                completed_count=plan.completed_count if plan else 0,
                expected_covered=round(plan.entry_count * elapsed) if plan and elapsed is not None else None,
                taught=sum(1 for d in ds if d.status == "taught"),
                partly=sum(1 for d in ds if d.status == "partly"),
                not_taught=sum(1 for d in ds if d.status == "not_taught"),
                reasons=reasons,
                last_taught=max(taught_dates) if taught_dates else None,
            )
        )
    rows.sort(key=lambda r: (r.teacher_name.lower(), r.class_name, r.subject_name))
    return CoverageOut(term=term, start_date=start, end_date=end, rows=rows)
