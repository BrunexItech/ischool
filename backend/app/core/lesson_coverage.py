"""Syllabus coverage per teacher/class/subject for a term — shared by the
head's Coverage tab and the Analytics insights."""

from sqlalchemy.orm import Session

from app.core.dates import school_today
from app.models.academic_term import AcademicTerm
from app.models.lesson_delivery import LessonDelivery
from app.models.lesson_plan import LessonPlan
from app.models.timetable import TimetableSlot
from app.models.user import User
from app.schemas.lesson_delivery import CoverageOut, CoverageRow


def build_coverage(db: Session, school_id: int, term: str) -> CoverageOut:

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
