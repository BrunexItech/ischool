"""One-screen summaries of every department, written for the head of
institution. The same sections feed the in-app module pages, the printable
weekly report and the Friday email, so the numbers never disagree.

Everything is read-only and derived from the records each department already
keeps. Each section says in one line how the area is doing, shows a handful of
figures, and lists the things that need a person to look."""

from collections import Counter, defaultdict
from datetime import date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dates import school_today
from app.core.oversight import attendance_oversight, current_term, homework_grid, week_start
from app.core.staff_presence import build_summary
from app.models.academic_term import AcademicTerm
from app.models.academics import SchoolClass, Student
from app.models.activity import Activity, ActivityParticipant
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.award import Award
from app.models.calendar_event import CalendarEvent
from app.models.communication import Announcement
from app.models.complaint import Complaint, ComplaintStatus
from app.models.conduct_report import ConductReport, ConductStatus
from app.models.exam import Exam, ExamSubmission
from app.models.expense import Expense, ExpenseStatus
from app.models.fees import FeeInvoice, FeePayment
from app.models.lead import Lead, LeadStage
from app.models.live_classes import LiveClass, LiveClassJoin, LiveClassStatus
from app.models.results import Result, Subject
from app.models.trip import Trip, TripStatus
from app.schemas.oversight import Attention, PulseSection, Tile, WeeklyReport

GOOD, WARN, BAD, NEUTRAL = "good", "warn", "bad", "neutral"


def _kes(n: float) -> str:
    return f"KES {n:,.0f}"


def _plural(n: int, one: str, many: str | None = None) -> str:
    return f"{n} {one}" if n == 1 else f"{n} {many or one + 's'}"


def _hours(delta_seconds: list[float]) -> float | None:
    return round(sum(delta_seconds) / len(delta_seconds) / 3600, 1) if delta_seconds else None


def _section(key: str, title: str, href: str, summary: str, tiles: list[Tile], attention: list[Attention]) -> PulseSection:
    return PulseSection(key=key, title=title, href=href, summary=summary, tiles=tiles, attention=attention)


class _Window:
    """The week being reported on, plus the term it falls in."""

    def __init__(self, db: Session, school_id: int, today: date | None = None):
        self.db = db
        self.school_id = school_id
        self.today = today or school_today(db, school_id)
        self.start = week_start(self.today)
        self.term: AcademicTerm | None = current_term(db, school_id)
        self.term_name = self.term.name if self.term else None
        self.term_start = self.term.start_date if self.term and self.term.start_date else self.today - timedelta(days=90)


# --- Academic departments ---


def students(w: _Window) -> PulseSection:
    db, sid = w.db, w.school_id
    rows = db.query(Student).filter_by(school_id=sid, is_active=True).all()
    total = len(rows)
    new = sum(1 for s in rows if s.created_at and s.created_at.date() >= w.today - timedelta(days=30))
    no_class = sum(1 for s in rows if not s.class_id)
    no_contact = sum(1 for s in rows if not (s.guardian_phone or s.guardian_email))
    left = db.query(Student).filter_by(school_id=sid, is_active=False).count()
    att: list[Attention] = []
    if no_class:
        att.append(Attention(text=f"{_plural(no_class, 'learner')} not placed in a class", href="/dashboard/students"))
    if no_contact:
        att.append(Attention(text=f"{_plural(no_contact, 'learner')} with no guardian phone or email, so parents cannot be reached", href="/dashboard/students"))
    tiles = [
        Tile(label="Learners", value=str(total)),
        Tile(label="Joined in 30 days", value=str(new)),
        Tile(label="Not in a class", value=str(no_class), tone=WARN if no_class else GOOD),
        Tile(label="No guardian contact", value=str(no_contact), tone=WARN if no_contact else GOOD),
        Tile(label="Left or deactivated", value=str(left)),
    ]
    return _section("students", "Learners", "/dashboard/students", f"{total} learners enrolled" + (f", {new} joined this month" if new else ""), tiles, att)


def attendance(w: _Window) -> PulseSection:
    db, sid = w.db, w.school_id
    recs = db.query(AttendanceRecord).filter(AttendanceRecord.school_id == sid, AttendanceRecord.date >= w.start, AttendanceRecord.date <= w.today).all()
    absent = sum(1 for r in recs if r.status == AttendanceStatus.ABSENT)
    rate = round((len(recs) - absent) / len(recs) * 100, 1) if recs else None
    today = attendance_oversight(db, sid, w.today)
    missing = [r for r in today.rows if r.register_status == "missing"]
    # Which learners were absent most this week
    names = {s.id: f"{s.first_name} {s.last_name}" for s in db.query(Student).filter_by(school_id=sid)}
    absences = Counter(r.student_id for r in recs if r.status == AttendanceStatus.ABSENT)
    frequent = [(names.get(i, "?"), n) for i, n in absences.most_common(5) if n >= 3]
    att: list[Attention] = []
    if today.school_day and missing:
        att.append(Attention(text=f"{_plural(len(missing), 'class', 'classes')} have not taken today's register: " + ", ".join(r.class_name for r in missing[:5]) + ("..." if len(missing) > 5 else ""), tone=BAD, href="/dashboard/attendance"))
    for name, n in frequent:
        att.append(Attention(text=f"{name} was absent {n} days this week", href="/dashboard/attendance"))
    if rate is not None and rate < 90:
        att.append(Attention(text=f"Attendance for the week is {rate:.0f}%, below 90%", tone=BAD, href="/dashboard/attendance"))
    tiles = [
        Tile(label="Attendance this week", value=f"{rate:.0f}%" if rate is not None else "—", tone=NEUTRAL if rate is None else GOOD if rate >= 95 else WARN if rate >= 90 else BAD),
        Tile(label="Absences this week", value=str(absent)),
        Tile(label="Registers today", value=f"{today.classes_taken} of {today.classes_total}" if today.school_day else "No school", tone=GOOD if today.school_day and not missing else WARN if today.school_day else NEUTRAL),
        Tile(label="Absent 3+ days", value=str(len(frequent)), tone=WARN if frequent else GOOD),
    ]
    summary = f"Attendance is {rate:.0f}% this week" if rate is not None else "No registers recorded yet this week"
    return _section("attendance", "Attendance", "/dashboard/attendance", summary, tiles, att)


def lessons(w: _Window) -> PulseSection:
    from app.core.lesson_coverage import build_coverage

    rows = build_coverage(w.db, w.school_id, w.term_name).rows if w.term_name else []
    with_plan = [r for r in rows if r.plan_id is not None]
    no_plan = [r for r in rows if r.plan_id is None]
    behind = [r for r in with_plan if r.expected_covered is not None and r.completed_count + 2 < r.expected_covered]
    not_taught = sum(r.not_taught for r in with_plan)
    done = sum(r.completed_count for r in with_plan)
    total = sum(r.entry_count for r in with_plan)
    att: list[Attention] = []
    for r in sorted(behind, key=lambda r: (r.expected_covered or 0) - r.completed_count, reverse=True)[:4]:
        att.append(Attention(text=f"{r.teacher_name}: {r.subject_name}, {r.class_name} is {(r.expected_covered or 0) - r.completed_count} topics behind", href="/dashboard/lesson-plans"))
    if no_plan:
        att.append(Attention(text=f"{_plural(len(no_plan), 'subject')} still without a lesson plan this term", href="/dashboard/lesson-plans"))
    tiles = [
        Tile(label="Syllabus covered", value=f"{round(done / total * 100)}%" if total else "—", hint=f"{done} of {total} topics" if total else None),
        Tile(label="Plans behind schedule", value=str(len(behind)), tone=BAD if len(behind) > 3 else WARN if behind else GOOD),
        Tile(label="Subjects with no plan", value=str(len(no_plan)), tone=WARN if no_plan else GOOD),
        Tile(label="Lessons not taught", value=str(not_taught), tone=WARN if not_taught else GOOD),
    ]
    summary = f"{len(behind)} of {len(with_plan)} lesson plans are behind schedule" if with_plan else "No lesson plans written for this term yet"
    return _section("lessons", "Lesson plans", "/dashboard/lesson-plans", summary, tiles, att)


def homework(w: _Window) -> PulseSection:
    grid = homework_grid(w.db, w.school_id, w.today)
    s = grid.summary
    given = s.given + s.board
    pct = round(given / s.expected * 100) if s.expected else None
    by_teacher: Counter = Counter()
    for r in grid.rows:
        for c in r.cells:
            if c.status == "missing" and r.teacher:
                by_teacher[r.teacher] += 1
    att = [Attention(text=f"{t}: no homework recorded for {_plural(n, 'lesson')} this week", href="/dashboard/homework") for t, n in by_teacher.most_common(4)]
    tiles = [
        Tile(label="Lessons with homework", value=f"{pct}%" if pct is not None else "—", hint=f"{given} of {s.expected}" if s.expected else None, tone=NEUTRAL if pct is None else GOOD if pct >= 80 else WARN if pct >= 60 else BAD),
        Tile(label="Typed on the system", value=str(s.given)),
        Tile(label="Given on the board", value=str(s.board)),
        Tile(label="Nothing recorded", value=str(s.missing), tone=WARN if s.missing else GOOD),
    ]
    summary = f"Homework was recorded for {pct}% of lessons this week" if pct is not None else "No homework expected yet this week"
    return _section("homework", "Homework", "/dashboard/homework", summary, tiles, att)


def exams(w: _Window) -> PulseSection:
    db, sid = w.db, w.school_id
    q = db.query(Exam).filter_by(school_id=sid)
    all_exams = q.filter(Exam.term == w.term_name).all() if w.term_name else q.all()
    published = [e for e in all_exams if e.is_published]
    upcoming = [e for e in published if e.opens_at and w.today <= e.opens_at.date() <= w.today + timedelta(days=14)]
    unpublished_soon = [e for e in all_exams if not e.is_published and e.opens_at and e.opens_at.date() <= w.today + timedelta(days=7)]
    subs = db.query(ExamSubmission).join(Exam, Exam.id == ExamSubmission.exam_id).filter(Exam.school_id == sid, ExamSubmission.submitted_at.isnot(None), ExamSubmission.submitted_at >= w.start).count()
    att = [Attention(text=f"“{e.title}” opens {e.opens_at:%d %b} but is not published yet", href="/dashboard/exams") for e in unpublished_soon[:4]]
    tiles = [
        Tile(label="Exams this term", value=str(len(all_exams))),
        Tile(label="Published", value=str(len(published))),
        Tile(label="Opening in 14 days", value=str(len(upcoming))),
        Tile(label="Submitted this week", value=str(subs)),
    ]
    return _section("exams", "Exams", "/dashboard/exams", f"{_plural(len(all_exams), 'exam')} set this term, {len(upcoming)} opening soon", tiles, att)


def results(w: _Window) -> PulseSection:
    db, sid = w.db, w.school_id
    q = db.query(Result).filter_by(school_id=sid)
    rows = q.filter(Result.term == w.term_name).all() if w.term_name else []
    subjects = {s.id: s.name for s in db.query(Subject).filter_by(school_id=sid)}
    by_subject: dict[int, list[float]] = defaultdict(list)
    for r in rows:
        by_subject[r.subject_id].append(float(r.score))
    means = {subjects.get(i, "?"): sum(v) / len(v) for i, v in by_subject.items() if v}
    overall = sum(float(r.score) for r in rows) / len(rows) if rows else None
    this_week = sum(1 for r in rows if r.created_at and r.created_at.date() >= w.start)
    student_class = {s.id: s.class_id for s in db.query(Student).filter_by(school_id=sid, is_active=True)}
    classes = {c.id: c.name for c in db.query(SchoolClass).filter_by(school_id=sid)}
    with_marks = {student_class.get(r.student_id) for r in rows}
    populated = {c for c in student_class.values() if c}
    without = sorted(classes[c] for c in populated - with_marks if c in classes)
    weakest = sorted(means.items(), key=lambda kv: kv[1])[:2]
    att: list[Attention] = []
    if without and w.term_name:
        att.append(Attention(text=f"No marks recorded this term for: {', '.join(without[:5])}" + ("..." if len(without) > 5 else ""), href="/dashboard/results"))
    for name, m in weakest:
        if m < 40:
            att.append(Attention(text=f"{name} has a school mean of {m:.0f}%, which is low", tone=BAD, href="/dashboard/results"))
    tiles = [
        Tile(label="School mean", value=f"{overall:.0f}%" if overall is not None else "—"),
        Tile(label="Marks entered", value=str(len(rows)), hint=f"{this_week} this week"),
        Tile(label="Strongest subject", value=max(means, key=means.get) if means else "—"),
        Tile(label="Classes with no marks", value=str(len(without)), tone=WARN if without else GOOD),
    ]
    return _section("results", "Results", "/dashboard/results", f"School mean is {overall:.0f}% this term" if overall is not None else "No marks recorded this term yet", tiles, att)


def conduct(w: _Window) -> PulseSection:
    db, sid = w.db, w.school_id
    reps = db.query(ConductReport).filter(ConductReport.school_id == sid, ConductReport.incident_date >= w.today - timedelta(days=30)).all()
    open_all = db.query(ConductReport).filter_by(school_id=sid, status=ConductStatus.OPEN).all()
    week = [r for r in reps if r.incident_date >= w.start]
    responded = [(r.responded_at - r.created_at).total_seconds() for r in db.query(ConductReport).filter(ConductReport.school_id == sid, ConductReport.responded_at.isnot(None), ConductReport.created_at >= datetime.combine(w.term_start, datetime.min.time()).astimezone())]
    classes = {c.id: c.name for c in db.query(SchoolClass).filter_by(school_id=sid)}
    by_class = Counter(r.class_id for r in reps if r.class_id)
    names = {s.id: f"{s.first_name} {s.last_name}" for s in db.query(Student).filter_by(school_id=sid)}
    repeat = Counter(r.student_id for r in reps)
    avg = _hours(responded)
    att: list[Attention] = []
    old = [r for r in open_all if (w.today - r.created_at.date()).days >= 3]
    if old:
        att.append(Attention(text=f"{_plural(len(old), 'report')} waiting more than 3 days for a response", tone=BAD, href="/dashboard/conduct"))
    for cid, n in by_class.most_common(2):
        if n >= 4:
            att.append(Attention(text=f"{classes.get(cid, 'A class')} has {n} conduct reports in 30 days", href="/dashboard/conduct"))
    for sid_, n in repeat.most_common(3):
        if n >= 3:
            att.append(Attention(text=f"{names.get(sid_, 'A learner')} has {n} conduct reports in 30 days", href="/dashboard/conduct"))
    tiles = [
        Tile(label="Filed this week", value=str(len(week))),
        Tile(label="Awaiting response", value=str(len(open_all)), tone=BAD if old else WARN if open_all else GOOD),
        Tile(label="Average response", value=f"{avg:g} h" if avg is not None else "—", hint="this term"),
        Tile(label="Hot spot", value=classes.get(by_class.most_common(1)[0][0], "—") if by_class else "None", hint="last 30 days"),
    ]
    return _section("conduct", "Conduct", "/dashboard/conduct", f"{_plural(len(week), 'report')} filed this week, {len(open_all)} awaiting a response", tiles, att)


def awards(w: _Window) -> PulseSection:
    db, sid = w.db, w.school_id
    rows = db.query(Award).filter(Award.school_id == sid, Award.date_awarded >= w.term_start).all()
    week = [a for a in rows if a.date_awarded >= w.start]
    scopes = Counter(a.scope for a in rows)
    cls_with = {a.class_id for a in rows if a.class_id} | {s.class_id for a in rows if a.student for s in [a.student]}
    classes = {c.id: c.name for c in db.query(SchoolClass).filter_by(school_id=sid)}
    quiet = sorted(n for i, n in classes.items() if i not in cls_with)
    att = [Attention(text=f"No awards this term for: {', '.join(quiet[:6])}" + ("..." if len(quiet) > 6 else ""), tone=WARN, href="/dashboard/awards")] if quiet and rows else []
    tiles = [
        Tile(label="Given this week", value=str(len(week))),
        Tile(label="This term", value=str(len(rows))),
        Tile(label="Learners", value=str(scopes.get("student", 0))),
        Tile(label="Whole classes", value=str(scopes.get("class", 0))),
        Tile(label="School and staff", value=str(scopes.get("school", 0) + scopes.get("staff", 0))),
    ]
    return _section("awards", "Awards", "/dashboard/awards", f"{_plural(len(rows), 'award')} given this term", tiles, att)


def activities(w: _Window) -> PulseSection:
    db, sid = w.db, w.school_id
    acts = db.query(Activity).filter_by(school_id=sid).all()
    upcoming = sorted((a for a in acts if a.date >= w.today), key=lambda a: a.date)
    held = [a for a in acts if w.start <= a.date < w.today]
    ids = {a.id for a in acts if a.date >= w.term_start}
    people = db.query(ActivityParticipant.student_id).filter(ActivityParticipant.activity_id.in_(ids)).distinct().count() if ids else 0
    att = [Attention(text=f"“{a.name}” on {a.date:%d %b} has no participants listed yet", href="/dashboard/activities") for a in upcoming[:5] if not a.participants and (a.date - w.today).days <= 7]
    tiles = [
        Tile(label="Coming up", value=str(len(upcoming)), hint=f"next: {upcoming[0].name}, {upcoming[0].date:%d %b}" if upcoming else None),
        Tile(label="Held this week", value=str(len(held))),
        Tile(label="Learners taking part", value=str(people), hint="this term"),
    ]
    return _section("activities", "Activities", "/dashboard/activities", f"{len(upcoming)} activities coming up", tiles, att)


def calendar(w: _Window) -> PulseSection:
    db, sid = w.db, w.school_id
    events = db.query(CalendarEvent).filter(CalendarEvent.school_id == sid, CalendarEvent.start_date >= w.today, CalendarEvent.start_date <= w.today + timedelta(days=30)).order_by(CalendarEvent.start_date).all()
    next14 = [e for e in events if e.start_date <= w.today + timedelta(days=14)]
    att: list[Attention] = []
    term = w.term
    days_left = (term.end_date - w.today).days if term and term.end_date else None
    if term is None or not term.start_date or not term.end_date:
        att.append(Attention(text="This term has no start and end dates, so attendance and lesson coverage cannot be judged properly", tone=BAD, href="/dashboard/academic-terms"))
    elif 0 <= days_left <= 14:
        later = db.query(AcademicTerm).filter(AcademicTerm.school_id == sid, AcademicTerm.start_date > term.end_date).first()
        if later is None:
            att.append(Attention(text=f"{term.name} ends in {days_left} days and the next term's dates are not set", tone=BAD, href="/dashboard/academic-terms"))
    tiles = [
        Tile(label="Current term", value=term.name if term else "Not set", hint=f"{days_left} days left" if days_left is not None and days_left >= 0 else None, tone=NEUTRAL if term else BAD),
        Tile(label="Events in 14 days", value=str(len(next14))),
        Tile(label="Next event", value=events[0].title if events else "None", hint=f"{events[0].start_date:%a %d %b}" if events else None),
    ]
    return _section("calendar", "Calendar and terms", "/dashboard/calendar", f"{_plural(len(next14), 'event')} in the next two weeks", tiles, att)


def trips(w: _Window) -> PulseSection:
    db, sid = w.db, w.school_id
    ts = db.query(Trip).filter_by(school_id=sid).all()
    requested = [t for t in ts if t.status == TripStatus.REQUESTED]
    upcoming = [t for t in ts if t.status == TripStatus.APPROVED and t.start_date >= w.today]
    on_road = [t for t in ts if t.status == TripStatus.IN_PROGRESS]
    done = [t for t in ts if t.status == TripStatus.COMPLETED and t.end_date >= w.term_start]
    att = [Attention(text=f"Trip “{t.title}” on {t.start_date:%d %b} is waiting for a decision (KES {float(t.estimated_cost):,.0f})", tone=BAD if (t.start_date - w.today).days <= 3 else WARN, href="/dashboard/trips") for t in requested[:5]]
    tiles = [
        Tile(label="Awaiting decision", value=str(len(requested)), tone=WARN if requested else GOOD),
        Tile(label="Approved and coming", value=str(len(upcoming))),
        Tile(label="On the road now", value=str(len(on_road))),
        Tile(label="Completed this term", value=str(len(done))),
    ]
    return _section("trips", "Trips", "/dashboard/trips", f"{len(requested)} trip requests waiting" if requested else "No trip requests waiting", tiles, att)


def live_classes(w: _Window) -> PulseSection:
    db, sid = w.db, w.school_id
    start_dt = datetime.combine(w.start, datetime.min.time()).astimezone()
    lcs = db.query(LiveClass).filter(LiveClass.school_id == sid, LiveClass.scheduled_start >= start_dt).all()
    live = [c for c in lcs if c.status == LiveClassStatus.LIVE]
    ended = [c for c in lcs if c.status == LiveClassStatus.ENDED]
    missed = [c for c in lcs if c.status == LiveClassStatus.SCHEDULED and c.scheduled_start < datetime.now().astimezone() - timedelta(hours=3)]
    ids = [c.id for c in lcs]
    joiners = db.query(LiveClassJoin.identity).filter(LiveClassJoin.live_class_id.in_(ids)).distinct().count() if ids else 0
    att = [Attention(text=f"“{c.title}” was scheduled for {c.scheduled_start:%a %H:%M} and never started", href="/dashboard/live-classes") for c in missed[:4]]
    tiles = [
        Tile(label="Scheduled this week", value=str(len(lcs))),
        Tile(label="Held", value=str(len(ended))),
        Tile(label="Live now", value=str(len(live)), tone=GOOD if live else NEUTRAL),
        Tile(label="People who joined", value=str(joiners)),
    ]
    return _section("live_classes", "Live classes", "/dashboard/live-classes", f"{len(ended)} of {len(lcs)} live classes held this week", tiles, att)


def announcements(w: _Window) -> PulseSection:
    db, sid = w.db, w.school_id
    start_dt = datetime.combine(w.start, datetime.min.time()).astimezone()
    week = db.query(Announcement).filter(Announcement.school_id == sid, Announcement.created_at >= start_dt).count()
    last = db.query(func.max(Announcement.created_at)).filter(Announcement.school_id == sid).scalar()
    quiet = (w.today - last.date()).days if last else None
    att = [Attention(text=f"Nothing has been announced for {quiet} days" if quiet is not None else "No announcement has ever been posted", href="/dashboard/announcements")] if quiet is None or quiet >= 14 else []
    tiles = [
        Tile(label="Posted this week", value=str(week)),
        Tile(label="Last announcement", value=("today" if quiet == 0 else f"{_plural(quiet, 'day')} ago") if quiet is not None else "Never", tone=WARN if quiet is None or quiet >= 14 else NEUTRAL),
    ]
    return _section("announcements", "Announcements", "/dashboard/announcements", f"{_plural(week, 'announcement')} this week", tiles, att)


def complaints(w: _Window) -> PulseSection:
    db, sid = w.db, w.school_id
    rows = db.query(Complaint).filter_by(school_id=sid).all()
    open_ = [c for c in rows if c.status == ComplaintStatus.OPEN]
    week = [c for c in rows if c.created_at.date() >= w.start]
    resp = [(c.responded_at - c.created_at).total_seconds() for c in rows if c.responded_at and c.created_at.date() >= w.term_start]
    avg = _hours(resp)
    old = [c for c in open_ if (w.today - c.created_at.date()).days >= 3]
    att = [Attention(text=f"“{c.subject}” from {c.raised_by_name} has waited {(w.today - c.created_at.date()).days} days", tone=BAD, href="/dashboard/complaints") for c in sorted(old, key=lambda c: c.created_at)[:4]]
    tiles = [
        Tile(label="Received this week", value=str(len(week))),
        Tile(label="Waiting for a reply", value=str(len(open_)), tone=BAD if old else WARN if open_ else GOOD),
        Tile(label="Average reply time", value=f"{avg:g} h" if avg is not None else "—", hint="this term"),
    ]
    return _section("complaints", "Complaints", "/dashboard/complaints", f"{len(open_)} complaints waiting for a reply" if open_ else "No complaints waiting", tiles, att)


def admissions(w: _Window) -> PulseSection:
    db, sid = w.db, w.school_id
    leads = db.query(Lead).filter_by(school_id=sid).all()
    stages = Counter(l.stage for l in leads)
    new = [l for l in leads if l.created_at.date() >= w.start]
    live = [l for l in leads if l.stage not in (LeadStage.ENROLLED, LeadStage.LOST)]
    stale = [l for l in live if (w.today - l.updated_at.date()).days >= 14]
    att = [Attention(text=f"{_plural(len(stale), 'enquiry', 'enquiries')} not followed up in two weeks", href="/dashboard/crm")] if stale else []
    tiles = [
        Tile(label="New enquiries this week", value=str(len(new))),
        Tile(label="In the pipeline", value=str(len(live))),
        Tile(label="Offers sent", value=str(stages.get(LeadStage.OFFER_SENT, 0))),
        Tile(label="Enrolled", value=str(stages.get(LeadStage.ENROLLED, 0))),
        Tile(label="Gone quiet", value=str(len(stale)), tone=WARN if stale else GOOD),
    ]
    return _section("admissions", "Admissions", "/dashboard/crm", f"{len(new)} new enquiries this week, {len(live)} in the pipeline", tiles, att)


def staff(w: _Window) -> PulseSection:
    summary = build_summary(w.db, w.school_id, w.start, w.today)
    rows = summary["rows"]
    unexplained = sum(r["absent_unexplained"] for r in rows)
    explained = sum(r["absent_explained"] for r in rows)
    leave = sum(r["on_leave"] for r in rows)
    late = sum(r["late"] for r in rows)
    counted = sum(r["school_days"] for r in rows)
    present = sum(r["present"] + r["late"] for r in rows)
    rate = round(present / counted * 100) if counted else None
    worst = sorted((r for r in rows if r["absent_unexplained"] > 0), key=lambda r: -r["absent_unexplained"])[:4]
    att = [Attention(text=f"{r['name']} was absent {r['absent_unexplained']} day(s) with no reason recorded", tone=BAD, href="/dashboard/staff-attendance") for r in worst]
    latecomers = [r for r in rows if r["late"] >= 3]
    att += [Attention(text=f"{r['name']} arrived late {r['late']} times this week", href="/dashboard/staff-attendance") for r in latecomers[:3]]
    tiles = [
        Tile(label="Staff attendance", value=f"{rate}%" if rate is not None else "—", tone=NEUTRAL if rate is None else GOOD if rate >= 95 else WARN if rate >= 85 else BAD),
        Tile(label="Absent, no reason", value=str(unexplained), tone=BAD if unexplained else GOOD),
        Tile(label="Absent, with reason", value=str(explained)),
        Tile(label="On leave", value=str(leave)),
        Tile(label="Late arrivals", value=str(late), tone=WARN if late > 5 else NEUTRAL),
    ]
    return _section("staff", "Staff attendance", "/dashboard/staff-attendance", f"Staff attendance is {rate}% this week" if rate is not None else "No staff attendance to report yet", tiles, att)


# --- Money ---


def finance(w: _Window) -> PulseSection:
    db, sid = w.db, w.school_id
    start_dt = datetime.combine(w.start, datetime.min.time()).astimezone()
    week = float(db.query(func.coalesce(func.sum(FeePayment.amount), 0)).filter(FeePayment.school_id == sid, FeePayment.paid_at >= start_dt).scalar())
    invoices = db.query(FeeInvoice).filter(FeeInvoice.school_id == sid, FeeInvoice.term == w.term_name).all() if w.term_name else []
    billed = sum(float(i.amount_due) for i in invoices)
    paid = sum(float(i.amount_paid) for i in invoices)
    rate = round(paid / billed * 100) if billed else None
    outstanding = sum(max(0.0, float(i.amount_due) - float(i.amount_paid)) for i in db.query(FeeInvoice).filter_by(school_id=sid))
    buckets = {"0-30": 0.0, "31-60": 0.0, "60+": 0.0}
    for i in db.query(FeeInvoice).filter(FeeInvoice.school_id == sid, FeeInvoice.due_date.isnot(None), FeeInvoice.due_date < w.today):
        owed = float(i.amount_due) - float(i.amount_paid)
        if owed <= 0:
            continue
        d = (w.today - i.due_date).days
        buckets["0-30" if d <= 30 else "31-60" if d <= 60 else "60+"] += owed
    pending = db.query(Expense).filter_by(school_id=sid, status=ExpenseStatus.PENDING).all()
    spent = float(db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(Expense.school_id == sid, Expense.status == ExpenseStatus.APPROVED, Expense.date >= w.start).scalar())
    att: list[Attention] = []
    if pending:
        att.append(Attention(text=f"{_plural(len(pending), 'expense')} worth {_kes(sum(float(e.amount) for e in pending))} waiting for your approval", tone=BAD if len(pending) > 3 else WARN, href="/dashboard/finance"))
    if buckets["60+"] > 0:
        att.append(Attention(text=f"{_kes(buckets['60+'])} in fees is more than 60 days overdue", tone=BAD, href="/dashboard/fees"))
    if rate is not None and rate < 60 and w.term and w.term.start_date and (w.today - w.term.start_date).days > 45:
        att.append(Attention(text=f"Only {rate}% of this term's fees have been collected", tone=BAD, href="/dashboard/fees"))
    tiles = [
        Tile(label="Collected this week", value=_kes(week)),
        Tile(label="Term collection", value=f"{rate}%" if rate is not None else "—", hint=f"{_kes(paid)} of {_kes(billed)}" if billed else None, tone=NEUTRAL if rate is None else GOOD if rate >= 80 else WARN if rate >= 60 else BAD),
        Tile(label="Outstanding fees", value=_kes(outstanding)),
        Tile(label="Overdue 60+ days", value=_kes(buckets["60+"]), tone=BAD if buckets["60+"] else GOOD),
        Tile(label="Spent this week", value=_kes(spent)),
        Tile(label="Awaiting your approval", value=str(len(pending)), tone=WARN if pending else GOOD),
    ]
    return _section("finance", "Finance", "/dashboard/finance", f"{_kes(week)} collected this week" + (f", {rate}% of the term's fees in" if rate is not None else ""), tiles, att)


def boarding_security_transport(w: _Window) -> list[PulseSection]:
    """Only included when the school actually uses these departments."""
    from app.services.weekly_reports import _boarding_week, _security_week, _transport_week

    out: list[PulseSection] = []
    sec = _security_week(w.db, w.school_id)
    if any(isinstance(v, int) and v for v in sec.values()):
        open_ = int(sec["Still open"])
        out.append(_section("security", "Security", "/dashboard/security", f"{sec['Incidents this week']} incidents this week", [Tile(label=k, value=str(v), tone=BAD if k == "Still open" and v else NEUTRAL) for k, v in sec.items()], [Attention(text=f"{_plural(open_, 'security incident')} still open", tone=BAD, href="/dashboard/security")] if open_ else []))
    brd = _boarding_week(w.db, w.school_id)
    if any(isinstance(v, int) and v for v in brd.values()):
        pend = int(brd["Awaiting approval"])
        out.append(_section("boarding", "Boarding", "/dashboard/boarding", f"{brd['Sick bay visits']} sick bay visits this week", [Tile(label=k, value=str(v), tone=WARN if k == "Awaiting approval" and v else NEUTRAL) for k, v in brd.items()], [Attention(text=f"{_plural(pend, 'exeat')} waiting for approval", href="/dashboard/boarding")] if pend else []))
    trn = _transport_week(w.db, w.school_id)
    if any(isinstance(v, int) and v for v in trn.values()):
        out.append(_section("transport", "Transport", "/dashboard/transport", f"{trn['Trips requested this week']} trips requested this week", [Tile(label=k, value=str(v)) for k, v in trn.items()], []))
    return out


# --- Registry ---

PULSES = {
    "students": students,
    "attendance": attendance,
    "lessons": lessons,
    "homework": homework,
    "exams": exams,
    "results": results,
    "conduct": conduct,
    "awards": awards,
    "activities": activities,
    "calendar": calendar,
    "trips": trips,
    "live_classes": live_classes,
    "announcements": announcements,
    "complaints": complaints,
    "admissions": admissions,
    "staff": staff,
    "finance": finance,
}

# The order a head reads the report in: teaching and learning first, then people, then money.
REPORT_ORDER = ["attendance", "lessons", "homework", "results", "exams", "conduct", "students", "staff", "admissions", "complaints", "finance", "trips", "calendar", "live_classes", "announcements", "activities", "awards"]


def module_pulse(db: Session, school_id: int, key: str) -> PulseSection | None:
    fn = PULSES.get(key)
    return fn(_Window(db, school_id)) if fn else None


def weekly_report(db: Session, school) -> WeeklyReport:
    w = _Window(db, school.id)
    sections = [PULSES[k](w) for k in REPORT_ORDER]
    sections += boarding_security_transport(w)
    count = sum(len(s.attention) for s in sections)
    urgent = sum(1 for s in sections for a in s.attention if a.tone == BAD)
    headline = (
        "A quiet week: nothing needs your attention." if count == 0
        else f"{_plural(count, 'thing')} need{'s' if count == 1 else ''} your attention" + (f", {urgent} of them urgent." if urgent else ".")
    )
    return WeeklyReport(school_name=school.name, term=w.term_name, week_start=w.start, week_end=w.today, headline=headline, attention_count=count, sections=sections)
