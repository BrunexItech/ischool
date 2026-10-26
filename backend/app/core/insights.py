"""Everything the Analytics "insights" view needs, computed from the
school's own records. Nothing here predicts or scores risk: every figure is a
count, an average, or a comparison with the previous term."""

from collections import defaultdict
from datetime import date, timedelta
from math import sqrt

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.dates import school_today
from app.core.grading import get_bands, level_for_score
from app.core.lesson_coverage import build_coverage
from app.models.academic_term import AcademicTerm
from app.models.academics import SchoolClass, Student
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.lesson_delivery import LessonDelivery
from app.models.results import Result, Subject
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import User, UserRole
from app.schemas.analytics import (
    AbsenceStreak,
    AttendanceInsights,
    Attention,
    BehindTeacher,
    CalendarDay,
    ClassPoint,
    CoverageFigure,
    DeliveryInsights,
    DroppedLearner,
    ExamTypeAverage,
    InsightsOut,
    LevelBand,
    ReasonCount,
    ScatterPoint,
    Scorecard,
    ScoreFigure,
    SubjectLevels,
    WeakSubject,
)

EXAM_ORDER = ["Opener", "CAT 1", "CAT 2", "Mid Term", "End Term", "Mock"]


def _mean(values: list[float]) -> float | None:
    return sum(values) / len(values) if values else None


def _round(v: float | None, places: int = 1) -> float | None:
    return round(v, places) if v is not None else None


def _previous_term(db: Session, school_id: int, term: AcademicTerm | None) -> AcademicTerm | None:
    if term is None:
        return None
    others = db.query(AcademicTerm).filter(AcademicTerm.school_id == school_id, AcademicTerm.id != term.id).all()
    if term.start_date:
        earlier = [t for t in others if t.start_date and t.start_date < term.start_date]
        return max(earlier, key=lambda t: t.start_date, default=None)
    earlier = [t for t in others if t.id < term.id]
    return max(earlier, key=lambda t: t.id, default=None)


class _Scope:
    """What the viewer may see. Leadership sees the school; a teacher sees the
    classes they teach or run, and only the subjects they teach there (a class
    teacher sees every subject of their own class)."""

    def __init__(self, db: Session, school_id: int, user: User):
        self.is_teacher = user.role == UserRole.TEACHER
        self.class_ids: set[int] | None = None
        self.pairs: set[tuple[int, int]] = set()
        self.homeroom: set[int] = set()
        self.user = user
        if self.is_teacher:
            assignments = db.query(TeacherAssignment).filter_by(school_id=school_id, teacher_user_id=user.id).all()
            self.homeroom = {c.id for c in db.query(SchoolClass).filter_by(school_id=school_id, homeroom_teacher_id=user.id).all()}
            self.class_ids = {a.class_id for a in assignments} | self.homeroom
            self.pairs = {(a.class_id, a.subject_id) for a in assignments if a.subject_id is not None}

    def allows(self, class_id: int | None, subject_id: int) -> bool:
        if not self.is_teacher:
            return True
        return class_id is not None and (class_id in self.homeroom or (class_id, subject_id) in self.pairs)


def _term_means(
    db: Session, school_id: int, term_name: str, students: dict[int, Student], scope: _Scope, subject_id: int | None
) -> tuple[dict[int, dict[int, float]], list[tuple[int, int, str, float]]]:
    """({student: {subject: mean score}}, raw rows [(student, subject, exam_type, score)])."""
    if not students:
        return {}, []
    rows = (
        db.query(Result.student_id, Result.subject_id, Result.exam_type, Result.score)
        .filter(Result.school_id == school_id, Result.term == term_name, Result.student_id.in_(list(students)))
        .all()
    )
    raw: list[tuple[int, int, str, float]] = []
    grouped: dict[int, dict[int, list[float]]] = defaultdict(lambda: defaultdict(list))
    for sid, subj, etype, score in rows:
        if subject_id is not None and subj != subject_id:
            continue
        if not scope.allows(students[sid].class_id, subj):
            continue
        raw.append((sid, subj, etype, float(score)))
        grouped[sid][subj].append(float(score))
    means = {sid: {subj: sum(v) / len(v) for subj, v in subs.items()} for sid, subs in grouped.items()}
    return means, raw


def _student_averages(means: dict[int, dict[int, float]]) -> dict[int, float]:
    return {sid: sum(m.values()) / len(m) for sid, m in means.items() if m}


def _attendance(db: Session, school_id: int, students: dict[int, Student], start: date | None, end: date | None):
    if not students:
        return []
    q = db.query(AttendanceRecord).filter(AttendanceRecord.school_id == school_id, AttendanceRecord.student_id.in_(list(students)))
    if start:
        q = q.filter(AttendanceRecord.date >= start)
    if end:
        q = q.filter(AttendanceRecord.date <= end)
    return q.all()


def _rate(records) -> float | None:
    if not records:
        return None
    absent = sum(1 for r in records if r.status == AttendanceStatus.ABSENT)
    return (len(records) - absent) / len(records) * 100


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 8:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    if sxx == 0 or syy == 0:
        return None
    return sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sqrt(sxx * syy)


def build_insights(
    db: Session, school_id: int, user: User, term_name: str, class_id: int | None, subject_id: int | None
) -> InsightsOut:
    scope = _Scope(db, school_id, user)
    if class_id is not None:
        if db.query(SchoolClass.id).filter_by(school_id=school_id, id=class_id).first() is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
        if scope.class_ids is not None and class_id not in scope.class_ids:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "That class is not one of yours")

    student_query = db.query(Student).filter(Student.school_id == school_id, Student.is_active.is_(True))
    if class_id is not None:
        student_query = student_query.filter(Student.class_id == class_id)
    elif scope.class_ids is not None:
        student_query = student_query.filter(Student.class_id.in_(scope.class_ids or {0}))
    students = {s.id: s for s in student_query.all()}
    class_names = {c.id: c.name for c in db.query(SchoolClass).filter_by(school_id=school_id).all()}
    subject_names = {s.id: s.name for s in db.query(Subject).filter_by(school_id=school_id).all()}

    term_row = db.query(AcademicTerm).filter_by(school_id=school_id, name=term_name).first()
    prev_row = _previous_term(db, school_id, term_row)
    today = school_today(db, school_id)
    start = term_row.start_date if term_row else None
    end = term_row.end_date if term_row else None
    if start is None and end is None:
        start, end = today - timedelta(days=60), today

    bands = get_bands(db, school_id)
    meeting_line = float(bands[1].min_score) if len(bands) >= 2 else None

    means, raw = _term_means(db, school_id, term_name, students, scope, subject_id)
    averages = _student_averages(means)
    prev_means: dict[int, dict[int, float]] = {}
    if prev_row is not None:
        prev_means, _ = _term_means(db, school_id, prev_row.name, students, scope, subject_id)
    prev_averages = _student_averages(prev_means)

    school_avg = _mean(list(averages.values()))
    prev_avg = _mean(list(prev_averages.values()))
    below = sum(1 for a in averages.values() if a < meeting_line) if meeting_line is not None else None
    below_prev = (
        sum(1 for a in prev_averages.values() if a < meeting_line) if meeting_line is not None and prev_row is not None else None
    )

    # --- attendance ---
    records = _attendance(db, school_id, students, start, end)
    prev_records = _attendance(db, school_id, students, prev_row.start_date, prev_row.end_date) if prev_row and prev_row.start_date and prev_row.end_date else []
    by_day: dict[date, list[AttendanceRecord]] = defaultdict(list)
    by_student: dict[int, list[AttendanceRecord]] = defaultdict(list)
    for r in records:
        by_day[r.date].append(r)
        by_student[r.student_id].append(r)
    calendar = [
        CalendarDay(date=d.isoformat(), rate=round(_rate(rs) or 0, 1), marked=len(rs)) for d, rs in sorted(by_day.items())
    ]
    reason_counts: dict[str, int] = defaultdict(int)
    without_reason = 0
    for r in records:
        if r.status == AttendanceStatus.PRESENT:
            continue
        text = (r.reason or "").strip().lower()
        if text:
            reason_counts[text] += 1
        else:
            without_reason += 1
    reasons = [ReasonCount(reason=k.capitalize(), count=v) for k, v in sorted(reason_counts.items(), key=lambda kv: -kv[1])[:6]]
    scatter: list[ScatterPoint] = []
    for sid, rs in by_student.items():
        if sid in averages and len(rs) >= 3:
            scatter.append(ScatterPoint(attendance=round(_rate(rs) or 0, 1), average=round(averages[sid], 1)))
    corr = _pearson([p.attendance for p in scatter], [p.average for p in scatter])

    # --- absence streaks (most recent consecutive absences) ---
    streaks: list[AbsenceStreak] = []
    window_start = today - timedelta(days=21)
    for sid, rs in by_student.items():
        recent = sorted((r for r in rs if r.date >= window_start), key=lambda r: r.date)
        if not recent or recent[-1].date < today - timedelta(days=5):
            continue
        run = 0
        since = None
        for r in reversed(recent):
            if r.status == AttendanceStatus.ABSENT:
                run += 1
                since = r.date
            else:
                break
        if run >= 3 and since:
            s = students[sid]
            streaks.append(
                AbsenceStreak(
                    student_id=sid,
                    name=f"{s.first_name} {s.last_name}",
                    class_name=class_names.get(s.class_id or 0, ""),
                    days=run,
                    since=since.isoformat(),
                )
            )
    streaks.sort(key=lambda a: -a.days)

    # --- learners whose average fell ---
    dropped: list[DroppedLearner] = []
    for sid, avg in averages.items():
        before = prev_averages.get(sid)
        if before is not None and before - avg >= 10:
            s = students[sid]
            dropped.append(
                DroppedLearner(
                    student_id=sid,
                    name=f"{s.first_name} {s.last_name}",
                    class_name=class_names.get(s.class_id or 0, ""),
                    average=round(avg, 1),
                    previous=round(before, 1),
                    drop=round(before - avg, 1),
                )
            )
    dropped.sort(key=lambda d: -d.drop)

    # --- class-and-subject averages: weak spots ---
    def class_subject_means(m: dict[int, dict[int, float]]) -> dict[tuple[int, int], list[float]]:
        out: dict[tuple[int, int], list[float]] = defaultdict(list)
        for sid, subs in m.items():
            cid = students[sid].class_id
            if cid is None:
                continue
            for subj, v in subs.items():
                out[(cid, subj)].append(v)
        return out

    cur_cs = class_subject_means(means)
    prev_cs = class_subject_means(prev_means)
    weak: list[WeakSubject] = []
    for (cid, subj), vals in cur_cs.items():
        if len(vals) < 3:
            continue
        avg = sum(vals) / len(vals)
        before = _mean(prev_cs.get((cid, subj), []))
        low = meeting_line is not None and avg < meeting_line
        fell = before is not None and before - avg >= 8
        if low or fell:
            weak.append(
                WeakSubject(
                    class_id=cid,
                    class_name=class_names.get(cid, ""),
                    subject_id=subj,
                    subject_name=subject_names.get(subj, ""),
                    average=round(avg, 1),
                    previous=_round(before),
                    learners=len(vals),
                )
            )
    weak.sort(key=lambda w: w.average)

    # --- teaching coverage (leadership sees everyone, a teacher only their own) ---
    cov = build_coverage(db, school_id, term_name)
    rows = [r for r in cov.rows if (not scope.is_teacher or r.teacher_user_id == user.id)]
    if class_id is not None:
        rows = [r for r in rows if r.class_id == class_id]
    if subject_id is not None:
        rows = [r for r in rows if r.subject_id == subject_id]
    planned = [r for r in rows if r.plan_id is not None]
    behind_rows = [
        BehindTeacher(
            teacher_name=r.teacher_name,
            class_name=r.class_name,
            subject_name=r.subject_name,
            plan_id=r.plan_id,
            completed=r.completed_count,
            expected=r.expected_covered or 0,
            behind=(r.expected_covered or 0) - r.completed_count,
        )
        for r in planned
        if r.expected_covered is not None and r.completed_count < r.expected_covered
    ]
    behind_rows.sort(key=lambda b: -b.behind)
    expected_total = sum(r.expected_covered for r in planned if r.expected_covered is not None) if any(r.expected_covered is not None for r in planned) else None

    # --- exam type comparison ---
    by_type: dict[str, list[float]] = defaultdict(list)
    for _, _, etype, score in raw:
        by_type[etype].append(score)
    order = {t: i for i, t in enumerate(EXAM_ORDER)}
    exam_types = [
        ExamTypeAverage(exam_type=t, average=round(sum(v) / len(v), 1), count=len(v))
        for t, v in sorted(by_type.items(), key=lambda kv: (order.get(kv[0], 99), kv[0]))
    ]

    # --- class vs class ---
    by_class: dict[int, list[float]] = defaultdict(list)
    for sid, avg in averages.items():
        cid = students[sid].class_id
        if cid is not None:
            by_class[cid].append(avg)
    classes = [
        ClassPoint(class_id=cid, class_name=class_names.get(cid, ""), average=round(sum(v) / len(v), 1), count=len(v))
        for cid, v in by_class.items()
    ]
    classes.sort(key=lambda c: -c.average)

    # --- performance levels per subject ---
    level_counts: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for subs in means.values():
        for subj, v in subs.items():
            level_counts[subj][level_for_score(db, school_id, v)] += 1
    levels = [
        SubjectLevels(subject_id=subj, subject=subject_names.get(subj, ""), counts=dict(c), total=sum(c.values()))
        for subj, c in level_counts.items()
    ]
    levels.sort(key=lambda l: l.subject)

    # --- teaching delivery ---
    dq = db.query(LessonDelivery).filter(LessonDelivery.school_id == school_id)
    if start:
        dq = dq.filter(LessonDelivery.lesson_date >= start)
    if end:
        dq = dq.filter(LessonDelivery.lesson_date <= end)
    if scope.is_teacher:
        dq = dq.filter(LessonDelivery.teacher_user_id == user.id)
    if class_id is not None:
        dq = dq.filter(LessonDelivery.class_id == class_id)
    if subject_id is not None:
        dq = dq.filter(LessonDelivery.subject_id == subject_id)
    delivered = dq.all()
    miss_reasons: dict[str, int] = defaultdict(int)
    for d in delivered:
        if d.status == "not_taught" and d.reason:
            miss_reasons[d.reason] += 1

    return InsightsOut(
        term=term_name,
        start_date=start.isoformat() if start else None,
        end_date=end.isoformat() if end else None,
        scorecard=Scorecard(
            average=ScoreFigure(value=_round(school_avg), previous=_round(prev_avg)),
            attendance_rate=ScoreFigure(value=_round(_rate(records)), previous=_round(_rate(prev_records))),
            coverage=CoverageFigure(
                completed=sum(r.completed_count for r in planned), total=sum(r.entry_count for r in planned), expected=expected_total
            ),
            below_expectation=below,
            below_expectation_previous=below_prev,
            learners=len(students),
            previous_term=prev_row.name if prev_row else None,
        ),
        attention=Attention(
            dropped_learners=dropped[:10],
            absence_streaks=streaks[:10],
            weak_subjects=weak[:8],
            behind_teachers=behind_rows[:8],
            meeting_line=meeting_line,
        ),
        exam_types=exam_types,
        classes=classes,
        school_average=_round(school_avg),
        levels=levels,
        bands=[LevelBand(level_code=b.level_code, label=b.label, min_score=float(b.min_score), max_score=float(b.max_score)) for b in bands],
        attendance=AttendanceInsights(
            calendar=calendar, reasons=reasons, without_reason=without_reason, scatter=scatter, correlation=_round(corr, 2)
        ),
        delivery=DeliveryInsights(
            taught=sum(1 for d in delivered if d.status == "taught"),
            partly=sum(1 for d in delivered if d.status == "partly"),
            not_taught=sum(1 for d in delivered if d.status == "not_taught"),
            reasons=dict(miss_reasons),
        ),
    )
