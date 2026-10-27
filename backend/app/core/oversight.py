"""What the head of institution needs to see without opening every class.

Everything here is read-only and derived from records teachers already keep:
registers, marks, lesson plans, homework, conduct reports and the timetable."""

from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.core.dates import school_today
from app.core.lesson_coverage import build_coverage
from app.core.results_board import subject_means
from app.core.staff_presence import _Context
from app.models.academic_term import AcademicTerm
from app.models.academics import SchoolClass, StaffProfile, Student
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.conduct_report import ConductReport, ConductStatus
from app.models.grade_level import GradeLevel
from app.models.homework import Homework
from app.models.lesson_delivery import LessonDelivery
from app.models.lesson_plan import LessonPlan
from app.models.results import Subject
from app.models.teacher_assignment import TeacherAssignment
from app.models.timetable import TimetableSlot
from app.models.user import User, UserRole
from app.schemas.oversight import (
    ClassCard,
    ClassConduct,
    ClassDay,
    ClassDetail,
    ClassHomework,
    ClassLearner,
    ClassTeacherRow,
    SubjectAverage,
    TeacherCard,
)

LEVEL_LABEL = {
    "pre_primary": "Pre-Primary",
    "primary": "Primary School",
    "junior_school": "Junior School",
    "senior_school": "Senior School",
}


def current_term(db: Session, school_id: int) -> AcademicTerm | None:
    terms = db.query(AcademicTerm).filter_by(school_id=school_id).all()
    current = next((t for t in terms if t.is_current), None)
    if current:
        return current
    dated = [t for t in terms if t.start_date]
    return max(dated, key=lambda t: t.start_date) if dated else (terms[0] if terms else None)


def week_start(today: date) -> date:
    return today - timedelta(days=today.weekday())


def _rate(records) -> float | None:
    if not records:
        return None
    absent = sum(1 for r in records if r.status == AttendanceStatus.ABSENT)
    return round((len(records) - absent) / len(records) * 100, 1)


def class_cards(db: Session, school_id: int) -> list[ClassCard]:
    today = school_today(db, school_id)
    term = current_term(db, school_id)
    term_name = term.name if term else None
    classes = db.query(SchoolClass).filter_by(school_id=school_id).all()
    grades = {g.id: g for g in db.query(GradeLevel).all()}
    teachers = {u.id: u.full_name for u in db.query(User).filter_by(school_id=school_id)}

    students = db.query(Student).filter_by(school_id=school_id, is_active=True).all()
    by_class_students: dict[int, list[Student]] = defaultdict(list)
    for s in students:
        if s.class_id:
            by_class_students[s.class_id].append(s)

    assignments = db.query(TeacherAssignment).filter_by(school_id=school_id).all()
    teachers_in: dict[int, set[int]] = defaultdict(set)
    subjects_in: dict[int, set[int]] = defaultdict(set)
    for a in assignments:
        teachers_in[a.class_id].add(a.teacher_user_id)
        if a.subject_id:
            subjects_in[a.class_id].add(a.subject_id)

    # Register: most recent day with a register per class, and whether today's was taken.
    recs = (
        db.query(AttendanceRecord)
        .filter(AttendanceRecord.school_id == school_id, AttendanceRecord.date >= today - timedelta(days=14))
        .all()
    )
    by_class_day: dict[tuple[int, date], list[AttendanceRecord]] = defaultdict(list)
    for r in recs:
        by_class_day[(r.class_id, r.date)].append(r)

    # Marks: each learner's average this term, then the class mean.
    ids = [s.id for s in students]
    means = subject_means(db, school_id, ids, term_name, None) if term_name else {}
    student_avg = {sid: sum(m.values()) / len(m) for sid, m in means.items() if m}

    plans = db.query(LessonPlan).filter_by(school_id=school_id, term=term_name).all() if term_name else []
    covered: dict[int, int] = defaultdict(int)
    total: dict[int, int] = defaultdict(int)
    for p in plans:
        covered[p.class_id] += p.completed_count
        total[p.class_id] += p.entry_count

    ws = week_start(today)
    hw_count: dict[int, int] = defaultdict(int)
    for cid, in db.query(Homework.class_id).filter(Homework.school_id == school_id, Homework.created_at >= ws):
        hw_count[cid] += 1

    open_conduct: dict[int, int] = defaultdict(int)
    for cid, in db.query(ConductReport.class_id).filter(ConductReport.school_id == school_id, ConductReport.status == ConductStatus.OPEN, ConductReport.class_id.isnot(None)):
        open_conduct[cid] += 1

    ctx = _Context(db, school_id, today, today)
    school_day = ctx.is_school_day(today)

    cards: list[ClassCard] = []
    for c in classes:
        days = sorted({d for (cid, d) in by_class_day if cid == c.id}, reverse=True)
        latest = days[0] if days else None
        taken_today = (c.id, today) in by_class_day
        grade = grades.get(c.grade_level_id) if c.grade_level_id else None
        avgs = [student_avg[s.id] for s in by_class_students.get(c.id, []) if s.id in student_avg]
        cards.append(
            ClassCard(
                id=c.id,
                name=c.name,
                grade_code=grade.code if grade else None,
                grade_name=grade.display_name if grade else None,
                level=grade.level_group.value if grade else "other",
                homeroom_teacher_id=c.homeroom_teacher_id,
                homeroom_teacher_name=teachers.get(c.homeroom_teacher_id) if c.homeroom_teacher_id else None,
                learners=len(by_class_students.get(c.id, [])),
                teachers=len(teachers_in.get(c.id, set())),
                subjects=len(subjects_in.get(c.id, set())),
                register_today="not_a_school_day" if not school_day else ("taken" if taken_today else "missing"),
                attendance_rate=_rate(by_class_day[(c.id, latest)]) if latest else None,
                attendance_date=latest,
                average=round(sum(avgs) / len(avgs), 1) if avgs else None,
                topics_covered=covered.get(c.id, 0),
                topics_total=total.get(c.id, 0),
                homework_this_week=hw_count.get(c.id, 0),
                open_conduct=open_conduct.get(c.id, 0),
            )
        )
    order = {c.id: (grades[c.grade_level_id].sort_order if c.grade_level_id in grades else 999) for c in classes}
    cards.sort(key=lambda x: (order[x.id], x.name))
    return cards


def class_detail(db: Session, school_id: int, class_id: int) -> ClassDetail | None:
    school_class = db.query(SchoolClass).filter_by(school_id=school_id, id=class_id).first()
    if school_class is None:
        return None
    card = next(c for c in class_cards(db, school_id) if c.id == class_id)
    today = school_today(db, school_id)
    term = current_term(db, school_id)
    term_name = term.name if term else None
    ws = week_start(today)

    students = db.query(Student).filter_by(school_id=school_id, class_id=class_id, is_active=True).order_by(Student.first_name, Student.last_name).all()
    sid_list = [s.id for s in students]
    start = term.start_date if term and term.start_date else today - timedelta(days=60)
    recs = db.query(AttendanceRecord).filter(AttendanceRecord.school_id == school_id, AttendanceRecord.class_id == class_id, AttendanceRecord.date >= start).all() if sid_list else []
    per_student: dict[int, list[AttendanceRecord]] = defaultdict(list)
    per_day: dict[date, list[AttendanceRecord]] = defaultdict(list)
    for r in recs:
        per_student[r.student_id].append(r)
        per_day[r.date].append(r)

    means = subject_means(db, school_id, sid_list, term_name, None) if term_name else {}
    subjects = {s.id: s.name for s in db.query(Subject).filter_by(school_id=school_id)}
    by_subject: dict[int, list[float]] = defaultdict(list)
    for m in means.values():
        for subj, v in m.items():
            by_subject[subj].append(v)

    learners = []
    for s in students:
        m = means.get(s.id)
        learners.append(
            ClassLearner(
                id=s.id,
                name=f"{s.first_name} {s.last_name}",
                admission_number=s.admission_number,
                attendance_rate=_rate(per_student.get(s.id, [])),
                average=round(sum(m.values()) / len(m), 1) if m else None,
            )
        )

    users = {u.id: u.full_name for u in db.query(User).filter_by(school_id=school_id)}
    assigns = db.query(TeacherAssignment).filter(TeacherAssignment.school_id == school_id, TeacherAssignment.class_id == class_id, TeacherAssignment.subject_id.isnot(None)).all()
    plans = {p.subject_id: p for p in db.query(LessonPlan).filter_by(school_id=school_id, class_id=class_id, term=term_name)} if term_name else {}
    last_taught: dict[tuple[int, int], date] = {}
    for tid, sid, d in db.query(LessonDelivery.teacher_user_id, LessonDelivery.subject_id, LessonDelivery.lesson_date).filter(
        LessonDelivery.school_id == school_id, LessonDelivery.class_id == class_id, LessonDelivery.status == "taught"
    ):
        if (tid, sid) not in last_taught or d > last_taught[(tid, sid)]:
            last_taught[(tid, sid)] = d
    homework_rows = db.query(Homework).filter(Homework.school_id == school_id, Homework.class_id == class_id).order_by(Homework.created_at.desc()).limit(8).all()
    week_hw: dict[int, int] = defaultdict(int)
    for h in db.query(Homework).filter(Homework.school_id == school_id, Homework.class_id == class_id, Homework.created_at >= ws):
        week_hw[h.subject_id] += 1

    rows = []
    seen: set[int] = set()
    for a in assigns:
        seen.add(a.subject_id)
        plan = plans.get(a.subject_id)
        rows.append(
            ClassTeacherRow(
                subject_id=a.subject_id,
                subject=subjects.get(a.subject_id, ""),
                teacher_id=a.teacher_user_id,
                teacher=users.get(a.teacher_user_id),
                topics_covered=plan.completed_count if plan else 0,
                topics_total=plan.entry_count if plan else 0,
                homework_this_week=week_hw.get(a.subject_id, 0),
                last_taught=last_taught.get((a.teacher_user_id, a.subject_id)),
            )
        )
    rows.sort(key=lambda r: r.subject)

    conduct = db.query(ConductReport).filter_by(school_id=school_id, class_id=class_id).order_by(ConductReport.created_at.desc()).limit(6).all()
    return ClassDetail(
        card=card,
        term=term_name,
        teacher_rows=rows,
        learners_list=learners,
        attendance_days=[ClassDay(date=d, rate=_rate(r) or 0, marked=len(r)) for d, r in sorted(per_day.items())][-12:],
        subject_averages=sorted(
            (SubjectAverage(subject=subjects.get(sid, ""), average=round(sum(v) / len(v), 1)) for sid, v in by_subject.items()),
            key=lambda x: x.subject,
        ),
        homework=[
            ClassHomework(id=h.id, title=h.title, subject=subjects.get(h.subject_id, ""), due_date=h.due_date, given_on_board=h.given_on_board, teacher=users.get(h.created_by) if h.created_by else None)
            for h in homework_rows
        ],
        conduct=[ClassConduct(id=c.id, student_name=c.student.first_name + " " + c.student.last_name, category=c.category.value, status=c.status.value, incident_date=c.incident_date) for c in conduct],
        boys=sum(1 for s in students if (s.gender or "").lower().startswith("m")),
        girls=sum(1 for s in students if (s.gender or "").lower().startswith("f")),
    )


def teacher_cards(db: Session, school_id: int) -> list[TeacherCard]:
    today = school_today(db, school_id)
    term = current_term(db, school_id)
    term_name = term.name if term else None
    ws = week_start(today)
    teachers = db.query(User).filter(User.school_id == school_id, User.role == UserRole.TEACHER, User.is_active.is_(True)).order_by(User.full_name).all()
    profiles = {p.user_id: p for p in db.query(StaffProfile).filter_by(school_id=school_id)}
    classes = {c.id: c for c in db.query(SchoolClass).filter_by(school_id=school_id)}
    grades = {g.id: g for g in db.query(GradeLevel).all()}
    subjects = {s.id: s.name for s in db.query(Subject).filter_by(school_id=school_id)}

    assigns: dict[int, list[TeacherAssignment]] = defaultdict(list)
    for a in db.query(TeacherAssignment).filter_by(school_id=school_id):
        assigns[a.teacher_user_id].append(a)
    homeroom: dict[int, list[str]] = defaultdict(list)
    for c in classes.values():
        if c.homeroom_teacher_id:
            homeroom[c.homeroom_teacher_id].append(c.name)

    coverage = build_coverage(db, school_id, term_name).rows if term_name else []
    cov: dict[int, dict[str, int | None]] = defaultdict(lambda: {"done": 0, "total": 0, "expected": 0, "plans": 0})
    for r in coverage:
        if r.teacher_user_id is None or r.plan_id is None:
            continue
        c = cov[r.teacher_user_id]
        c["done"] += r.completed_count
        c["total"] += r.entry_count
        c["plans"] += 1
        if r.expected_covered is not None:
            c["expected"] += r.expected_covered

    marked: dict[int, int] = defaultdict(int)
    for tid, in db.query(LessonDelivery.teacher_user_id).filter(LessonDelivery.school_id == school_id, LessonDelivery.lesson_date >= ws):
        marked[tid] += 1
    scheduled: dict[int, int] = defaultdict(int)
    for tid, dow in db.query(TimetableSlot.teacher_user_id, TimetableSlot.day_of_week).filter(TimetableSlot.school_id == school_id, TimetableSlot.teacher_user_id.isnot(None)):
        if dow <= today.weekday():
            scheduled[tid] += 1
    hw: dict[int, int] = defaultdict(int)
    for tid, in db.query(Homework.created_by).filter(Homework.school_id == school_id, Homework.created_at >= ws, Homework.created_by.isnot(None)):
        hw[tid] += 1

    ctx = _Context(db, school_id, today, today)
    tracked = {u.id for u in ctx.users}
    school_day = ctx.is_school_day(today)

    out: list[TeacherCard] = []
    for t in teachers:
        prof = profiles.get(t.id)
        cids = {a.class_id for a in assigns.get(t.id, [])} | {c.id for c in classes.values() if c.homeroom_teacher_id == t.id}
        cats = sorted({LEVEL_LABEL[grades[classes[c].grade_level_id].level_group.value] for c in cids if c in classes and classes[c].grade_level_id in grades})
        info = cov.get(t.id)
        status = ctx.judge(t, today)["status"] if (t.id in tracked and school_day) else None
        out.append(
            TeacherCard(
                user_id=t.id,
                name=t.full_name,
                email=t.email,
                phone=prof.phone if prof else None,
                staff_number=prof.staff_number if prof else None,
                tsc_number=prof.tsc_number if prof else None,
                department=prof.department if prof else None,
                categories=cats,
                classes=sorted(classes[c].name for c in cids if c in classes),
                class_teacher_of=sorted(homeroom.get(t.id, [])),
                subjects=sorted({subjects.get(a.subject_id, "") for a in assigns.get(t.id, []) if a.subject_id}),
                today=status,
                topics_covered=int(info["done"]) if info else 0,
                topics_total=int(info["total"]) if info else 0,
                topics_expected=int(info["expected"]) if info and info["expected"] else None,
                lessons_marked_week=marked.get(t.id, 0),
                lessons_scheduled_week=scheduled.get(t.id, 0),
                homework_week=hw.get(t.id, 0),
                plans=int(info["plans"]) if info else 0,
            )
        )
    return out


# --- Homework: was it given? ---


def homework_grid(db: Session, school_id: int, week: date | None) -> dict:
    from app.core.dates import school_tz  # local import keeps the module header tidy
    from app.models.homework import HomeworkDeclaration
    from app.schemas.oversight import HomeworkCell, HomeworkGrid, HomeworkRow, HomeworkSummary

    today = school_today(db, school_id)
    start = week_start(week or today)
    days = [start + timedelta(days=i) for i in range(5)]
    tz = school_tz(db, school_id)
    ctx = _Context(db, school_id, start, start + timedelta(days=4))

    classes = {c.id: c.name for c in db.query(SchoolClass).filter_by(school_id=school_id)}
    subjects = {s.id: s.name for s in db.query(Subject).filter_by(school_id=school_id)}
    users = {u.id: u.full_name for u in db.query(User).filter_by(school_id=school_id)}

    slots = db.query(TimetableSlot).filter_by(school_id=school_id).all()
    lesson_days: dict[tuple[int, int], set[int]] = defaultdict(set)
    teacher_of: dict[tuple[int, int], int | None] = {}
    for s in slots:
        lesson_days[(s.class_id, s.subject_id)].add(s.day_of_week)
        teacher_of.setdefault((s.class_id, s.subject_id), s.teacher_user_id)
    assigns = db.query(TeacherAssignment).filter(TeacherAssignment.school_id == school_id, TeacherAssignment.subject_id.isnot(None)).all()
    for a in assigns:
        teacher_of.setdefault((a.class_id, a.subject_id), a.teacher_user_id)
    pairs = set(lesson_days) | {(a.class_id, a.subject_id) for a in assigns}

    given: dict[tuple[int, int, date], list[Homework]] = defaultdict(list)
    for h in db.query(Homework).filter(Homework.school_id == school_id, Homework.created_at >= start - timedelta(days=1)):
        local = h.created_at.astimezone(tz).date() if h.created_at.tzinfo else h.created_at.date()
        if start <= local <= days[-1]:
            given[(h.class_id, h.subject_id, local)].append(h)
    declared = {
        (d.class_id, d.subject_id, d.date)
        for d in db.query(HomeworkDeclaration).filter(HomeworkDeclaration.school_id == school_id, HomeworkDeclaration.date >= start, HomeworkDeclaration.date <= days[-1])
    }

    rows = []
    totals = dict(given=0, board=0, none=0, missing=0, expected=0)
    for (cid, sid) in sorted(pairs, key=lambda p: (classes.get(p[0], ""), subjects.get(p[1], ""))):
        if cid not in classes:
            continue
        cells = []
        for d in days:
            items = given.get((cid, sid, d), [])
            typed = [h for h in items if not h.given_on_board]
            board = [h for h in items if h.given_on_board]
            has_lesson = d.weekday() in lesson_days.get((cid, sid), set())
            school_day = ctx.is_school_day(d)
            if typed:
                status = "given"
            elif board:
                status = "board"
            elif (cid, sid, d) in declared:
                status = "none"
            elif d > today:
                status = "upcoming" if has_lesson else "no_lesson"
            elif has_lesson and school_day:
                status = "missing"
            else:
                status = "no_lesson"
            if has_lesson and school_day and d <= today:
                totals["expected"] += 1
                if status in totals:
                    totals[status] += 1
            cells.append(HomeworkCell(date=d, status=status, count=len(items), titles=[h.title for h in items][:3]))
        rows.append(
            HomeworkRow(class_id=cid, class_name=classes[cid], subject_id=sid, subject=subjects.get(sid, ""), teacher=users.get(teacher_of.get((cid, sid))) if teacher_of.get((cid, sid)) else None, cells=cells)
        )
    return HomeworkGrid(week_start=start, days=days, rows=rows, summary=HomeworkSummary(**totals))


# --- Registers: who has taken theirs, and who is away ---


def attendance_oversight(db: Session, school_id: int, day: date):
    from app.schemas.oversight import Absentee, AttendanceClassRow, AttendanceOversight

    ctx = _Context(db, school_id, day, day)
    school_day = ctx.is_school_day(day)
    grades = {g.id: g for g in db.query(GradeLevel).all()}
    classes = db.query(SchoolClass).filter_by(school_id=school_id).all()
    users = {u.id: u.full_name for u in db.query(User).filter_by(school_id=school_id)}
    students = {s.id: s for s in db.query(Student).filter_by(school_id=school_id)}
    recs = db.query(AttendanceRecord).filter_by(school_id=school_id, date=day).all()
    by_class: dict[int, list[AttendanceRecord]] = defaultdict(list)
    for r in recs:
        by_class[r.class_id].append(r)
    active_by_class: dict[int, int] = defaultdict(int)
    for s in students.values():
        if s.is_active and s.class_id:
            active_by_class[s.class_id] += 1

    rows = []
    for c in sorted(classes, key=lambda c: ((grades[c.grade_level_id].sort_order if c.grade_level_id in grades else 999), c.name)):
        rs = by_class.get(c.id, [])
        counts = {k: sum(1 for r in rs if r.status == k) for k in (AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.EXCUSED, AttendanceStatus.ABSENT)}
        recorder = next((r.recorded_by for r in rs if r.recorded_by), None)
        grade = grades.get(c.grade_level_id) if c.grade_level_id else None
        rows.append(
            AttendanceClassRow(
                class_id=c.id,
                class_name=c.name,
                level=grade.level_group.value if grade else "other",
                learners=active_by_class.get(c.id, 0),
                register_status="not_a_school_day" if not school_day and not rs else ("taken" if rs else "missing"),
                taken_by=users.get(recorder) if recorder else None,
                present=counts[AttendanceStatus.PRESENT],
                late=counts[AttendanceStatus.LATE],
                excused=counts[AttendanceStatus.EXCUSED],
                absent=counts[AttendanceStatus.ABSENT],
                rate=_rate(rs),
                absentees=[
                    Absentee(name=f"{students[r.student_id].first_name} {students[r.student_id].last_name}", status=r.status.value, reason=r.reason)
                    for r in rs
                    if r.status != AttendanceStatus.PRESENT and r.student_id in students
                ],
            )
        )
    taken = [r for r in rows if r.register_status == "taken"]
    return AttendanceOversight(
        date=day,
        school_day=school_day,
        holiday=ctx.holiday_on(day),
        classes_total=len(rows),
        classes_taken=len(taken),
        school_rate=_rate(recs),
        learners_marked=len(recs),
        rows=rows,
    )


# --- The head's Overview: today's pulse and what needs a decision ---


def head_overview(db: Session, school_id: int):
    from app.models.complaint import Complaint, ComplaintStatus
    from app.models.expense import Expense, ExpenseStatus
    from app.models.trip import Trip, TripStatus
    from app.schemas.oversight import HeadOverview, InboxItem, Pulse
    from app.core.staff_presence import build_day

    today = school_today(db, school_id)
    day = build_day(db, school_id, today)
    att = attendance_oversight(db, school_id, today)

    status_counts = defaultdict(int)
    for r in day["rows"]:
        status_counts[r["status"]] += 1

    scheduled = 0
    marked = 0
    unmarked_yesterday = 0
    if day["school_day"]:
        scheduled = db.query(TimetableSlot).filter(TimetableSlot.school_id == school_id, TimetableSlot.teacher_user_id.isnot(None), TimetableSlot.day_of_week == today.weekday()).count()
        marked = db.query(LessonDelivery).filter_by(school_id=school_id, lesson_date=today).count()
    y = today - timedelta(days=1)
    while y.weekday() >= 5:
        y -= timedelta(days=1)
    ctx_y = _Context(db, school_id, y, y)
    if ctx_y.is_school_day(y):
        slots_y = db.query(TimetableSlot).filter(TimetableSlot.school_id == school_id, TimetableSlot.teacher_user_id.isnot(None), TimetableSlot.day_of_week == y.weekday()).count()
        done_y = db.query(LessonDelivery).filter_by(school_id=school_id, lesson_date=y).count()
        unmarked_yesterday = max(0, slots_y - done_y)

    inbox: list[InboxItem] = []
    now = school_today(db, school_id)

    def age(dt) -> int:
        return max(0, (now - dt.date()).days) if dt is not None else 0

    for t in db.query(Trip).filter_by(school_id=school_id, status=TripStatus.REQUESTED).order_by(Trip.created_at).limit(10):
        inbox.append(InboxItem(kind="trip", title=f"Trip request: {t.title}", detail=f"{t.destination} on {t.start_date:%d %b}", age_days=age(t.created_at), href="/dashboard/trips"))
    for e in db.query(Expense).filter_by(school_id=school_id, status=ExpenseStatus.PENDING).order_by(Expense.date).limit(10):
        inbox.append(InboxItem(kind="expense", title=f"Expense to approve: {e.description}", detail=f"KES {float(e.amount):,.0f}", age_days=max(0, (now - e.date).days), href="/dashboard/finance"))
    for c in db.query(Complaint).filter_by(school_id=school_id, status=ComplaintStatus.OPEN).order_by(Complaint.created_at).limit(10):
        inbox.append(InboxItem(kind="complaint", title=f"Complaint: {c.subject}", detail=f"From {c.raised_by_name}", age_days=age(c.created_at), href="/dashboard/complaints"))
    for r in db.query(ConductReport).filter_by(school_id=school_id, status=ConductStatus.OPEN).order_by(ConductReport.created_at).limit(10):
        inbox.append(InboxItem(kind="conduct", title="Conduct report awaiting your response", detail=f"{r.student.first_name} {r.student.last_name}: {r.category.value.replace('_', ' ')}", age_days=age(r.created_at), href="/dashboard/conduct"))
    from app.core.approvals import LINKS
    from app.models.change_request import ChangeRequest, ChangeStatus

    for cr in db.query(ChangeRequest).filter_by(school_id=school_id, status=ChangeStatus.PENDING).order_by(ChangeRequest.requested_at).limit(10):
        inbox.append(InboxItem(kind="approval", title=f"To approve: {cr.title}", detail=f"{cr.summary} · prepared by {cr.requester.full_name if cr.requester else 'the office'}", age_days=age(cr.requested_at), href=LINKS.get(cr.kind, "/dashboard")))
    absent_unexplained = [r for r in day["rows"] if r["status"] == "absent" and not r["reason"]]
    if absent_unexplained and day["school_day"]:
        inbox.append(InboxItem(kind="staff", title=f"{len(absent_unexplained)} staff absent with no reason recorded", detail=", ".join(r["name"] for r in absent_unexplained[:3]) + ("..." if len(absent_unexplained) > 3 else ""), age_days=0, href="/dashboard/staff-attendance"))
    inbox.sort(key=lambda i: -i.age_days)

    counts: dict[str, int] = defaultdict(int)
    for i in inbox:
        counts[i.kind] += 1
    return HeadOverview(
        pulse=Pulse(
            school_day=day["school_day"],
            holiday=day["holiday"],
            learners=db.query(Student).filter_by(school_id=school_id, is_active=True).count(),
            teachers=db.query(User).filter(User.school_id == school_id, User.role == UserRole.TEACHER, User.is_active.is_(True)).count(),
            classes=att.classes_total,
            attendance_rate=att.school_rate,
            registers_taken=att.classes_taken,
            registers_total=att.classes_total if att.school_day else 0,
            staff_present=status_counts["present"],
            staff_late=status_counts["late"],
            staff_absent=status_counts["absent"],
            staff_on_leave=status_counts["on_leave"],
            staff_expected=status_counts["expected"],
            lessons_scheduled=scheduled,
            lessons_marked=marked,
            unmarked_yesterday=unmarked_yesterday,
        ),
        inbox=inbox[:12],
        inbox_counts=dict(counts),
    )


# --- How each class is performing, before opening any report card ---

PASS_MARK = 50.0


def performance_overview(db: Session, school_id: int, term: str | None, exam_types: list[str]):
    from app.core.grading import level_for_score
    from app.core.results_board import competition_ranks, subject_means
    from app.models.grade_level import LevelGroup
    from app.models.results import Result
    from app.schemas.oversight import ClassPerformance, PerformanceOverview, SubjectMean, TopLearner

    chosen = term or (current_term(db, school_id).name if current_term(db, school_id) else None)
    available = (
        sorted({r[0] for r in db.query(Result.exam_type).filter(Result.school_id == school_id, Result.term == chosen).distinct()}) if chosen else []
    )
    if chosen is None:
        return PerformanceOverview(term=None, exam_types=[], available_exam_types=[], school_average=None, classes=[], top_learners=[])

    classes = db.query(SchoolClass).filter_by(school_id=school_id).all()
    classes.sort(key=lambda c: ((c.grade.sort_order if c.grade else 999), c.name))
    students = db.query(Student).filter_by(school_id=school_id, is_active=True).all()
    by_class: dict[int, list[Student]] = defaultdict(list)
    for s in students:
        if s.class_id:
            by_class[s.class_id].append(s)
    subject_names = {s.id: s.name for s in db.query(Subject).filter_by(school_id=school_id)}
    users = {u.id: u.full_name for u in db.query(User).filter_by(school_id=school_id)}
    means = subject_means(db, school_id, [s.id for s in students], chosen, exam_types)

    rows: list[ClassPerformance] = []
    everyone: list[TopLearner] = []
    all_averages: list[float] = []
    for c in classes:
        roster = by_class.get(c.id, [])
        averages = {s.id: sum(means[s.id].values()) / len(means[s.id]) for s in roster if means.get(s.id)}
        all_averages.extend(averages.values())
        ranked = not (c.grade is not None and c.grade.level_group == LevelGroup.PRE_PRIMARY)
        ranks = competition_ranks(averages) if ranked else {}
        names = {s.id: s for s in roster}
        top = []
        if ranked:
            for sid in sorted(averages, key=lambda i: -averages[i])[:3]:
                s = names[sid]
                lvl = level_for_score(db, school_id, averages[sid])
                top.append(TopLearner(student_id=sid, name=f"{s.first_name} {s.last_name}", class_name=c.name, admission_number=s.admission_number, average=round(averages[sid], 1), rank=ranks[sid], level=lvl))
        everyone.extend(top)
        per_subject: dict[int, list[float]] = defaultdict(list)
        for sid in averages:
            for subj, v in means[sid].items():
                per_subject[subj].append(v)
        subj_avgs = [SubjectMean(subject=subject_names.get(k, "?"), average=round(sum(v) / len(v), 1)) for k, v in per_subject.items()]
        subj_avgs.sort(key=lambda m: -m.average)
        dist: dict[str, int] = defaultdict(int)
        for a in averages.values():
            lvl = level_for_score(db, school_id, a)
            if lvl:
                dist[lvl] += 1
        rows.append(
            ClassPerformance(
                class_id=c.id,
                class_name=c.name,
                level=c.grade.level_group.value if c.grade else "other",
                teacher=users.get(c.homeroom_teacher_id) if c.homeroom_teacher_id else None,
                learners=len(roster),
                marked=len(averages),
                average=round(sum(averages.values()) / len(averages), 1) if averages else None,
                pass_rate=round(100 * sum(1 for a in averages.values() if a >= PASS_MARK) / len(averages), 1) if averages else None,
                ranked=ranked,
                top=top,
                best_subject=subj_avgs[0] if subj_avgs else None,
                weakest_subject=subj_avgs[-1] if len(subj_avgs) > 1 else None,
                distribution=dict(dist),
            )
        )
    everyone.sort(key=lambda t: -t.average)
    return PerformanceOverview(
        term=chosen,
        exam_types=exam_types,
        available_exam_types=available,
        school_average=round(sum(all_averages) / len(all_averages), 1) if all_averages else None,
        classes=rows,
        top_learners=everyone[:10],
    )
