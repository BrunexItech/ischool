"""The principal's comparison of schools, one module at a time.

Every module is a short list of columns and one function that gives a school's
figure for each. The group row is added up here, properly weighted (a
percentage across schools is built from the totals, never an average of
averages). Nothing here changes a record."""

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta, timezone
from typing import Callable

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dates import school_today, school_tz
from app.core.oversight import attendance_oversight, class_cards, current_term, exam_readiness, homework_grid, performance_overview, week_start
from app.models.academics import SchoolClass, Student
from app.models.conduct_report import ConductReport, ConductStatus
from app.models.expense import Expense, ExpenseStatus
from app.models.fees import FeeInvoice, FeePayment
from app.models.lead import Lead, LeadStage
from app.models.lesson_delivery import LessonDelivery
from app.models.library import Book, BookCopy, Loan
from app.models.module import SchoolModule
from app.models.school import School
from app.models.store import StockItem, StoreRequest
from app.models.timetable import TimetableSlot
from app.models.transport import TransportRun, Vehicle
from app.models.user import User, UserRole


@dataclass
class Col:
    key: str
    label: str
    kind: str                       # count | percent | money | score | decimal
    better: str | None = None       # "high" | "low" | None: which way is good, for highlighting
    hint: str | None = None
    # How the group row is built: "sum", or ("ratio", numerator_key, denominator_key) for a weighted percentage
    total: object = "sum"


@dataclass
class Module:
    key: str
    title: str
    blurb: str
    href: str                       # the page a school's own view of this module lives at
    flag: str | None                # module switch that must be on for the school
    columns: list[Col]
    fn: Callable[[Session, int, date], dict]
    hidden: list[str] = field(default_factory=list)   # raw parts used for weighted totals


def _pct(n: float, d: float) -> float | None:
    return round(100 * n / d, 1) if d else None


def _utc_range(db: Session, school_id: int, start: date, end: date) -> tuple[datetime, datetime]:
    tz = school_tz(db, school_id)
    return (
        datetime.combine(start, time.min, tzinfo=tz).astimezone(timezone.utc),
        datetime.combine(end + timedelta(days=1), time.min, tzinfo=tz).astimezone(timezone.utc),
    )


# --- One function per module ---


def m_classes(db, sid, today):
    cards = class_cards(db, sid)
    learners = sum(c.learners for c in cards)
    return {
        "classes": len(cards),
        "learners": learners,
        "avg_size": round(learners / len(cards), 1) if cards else None,
        "no_class_teacher": sum(1 for c in cards if c.homeroom_teacher_id is None),
        "_size_n": learners,
        "_size_d": len(cards),
    }


def m_teachers(db, sid, today):
    from app.core.staff_presence import build_day

    teachers = db.query(User).filter(User.school_id == sid, User.role == UserRole.TEACHER, User.is_active.is_(True)).all()
    day = build_day(db, sid, today)
    mine = {t.id for t in teachers}
    rows = [r for r in day["rows"] if r["user_id"] in mine]
    start = week_start(today)
    scheduled = db.query(TimetableSlot).filter(TimetableSlot.school_id == sid, TimetableSlot.teacher_user_id.in_(mine or [-1]), TimetableSlot.day_of_week <= today.weekday()).count()
    marked = db.query(LessonDelivery).filter(LessonDelivery.school_id == sid, LessonDelivery.lesson_date >= start, LessonDelivery.lesson_date <= today).count()
    in_ = sum(1 for r in rows if r["status"] in ("present", "late"))
    return {
        "teachers": len(teachers),
        "in_today": in_ if day["school_day"] else None,
        "absent_today": sum(1 for r in rows if r["status"] == "absent") if day["school_day"] else None,
        "class_teachers": db.query(SchoolClass).filter(SchoolClass.school_id == sid, SchoolClass.homeroom_teacher_id.isnot(None)).count(),
        "lessons_marked_pct": _pct(marked, scheduled),
        "_marked": marked,
        "_scheduled": scheduled,
    }


def m_students(db, sid, today):
    term = current_term(db, sid)
    kids = db.query(Student).filter_by(school_id=sid, is_active=True).all()
    since = _utc_range(db, sid, term.start_date, today)[0] if term and term.start_date else None
    ready = exam_readiness(db, sid)
    return {
        "learners": len(kids),
        "boys": sum(1 for k in kids if (k.gender or "").lower().startswith("m")),
        "girls": sum(1 for k in kids if (k.gender or "").lower().startswith("f")),
        "new_this_term": sum(1 for k in kids if since and k.created_at and k.created_at >= since),
        "exam_numbers_missing": sum(g.learners - g.complete for g in ready.groups),
        "no_guardian_phone": sum(1 for k in kids if not (k.guardian_phone or "").strip()),
    }


def m_attendance(db, sid, today):
    att = attendance_oversight(db, sid, today)
    week_recs = 0
    week_ok = 0
    from app.models.attendance import AttendanceRecord, AttendanceStatus

    for status_, in db.query(AttendanceRecord.status).filter(AttendanceRecord.school_id == sid, AttendanceRecord.date >= week_start(today), AttendanceRecord.date <= today):
        week_recs += 1
        week_ok += status_ in (AttendanceStatus.PRESENT, AttendanceStatus.LATE)
    marked = att.learners_marked
    ok = round((att.school_rate or 0) * marked / 100) if marked else 0
    return {
        "rate_today": att.school_rate if att.school_day else None,
        "registers_taken": att.classes_taken if att.school_day else None,
        "registers_total": att.classes_total if att.school_day else None,
        "rate_week": _pct(week_ok, week_recs),
        "_ok_today": ok,
        "_marked_today": marked,
        "_week_ok": week_ok,
        "_week_n": week_recs,
    }


def m_lessons(db, sid, today):
    cards = class_cards(db, sid)
    covered = sum(c.topics_covered for c in cards)
    total = sum(c.topics_total for c in cards)
    start = week_start(today)
    scheduled = db.query(TimetableSlot).filter(TimetableSlot.school_id == sid, TimetableSlot.teacher_user_id.isnot(None), TimetableSlot.day_of_week <= today.weekday()).count()
    marked = db.query(LessonDelivery).filter(LessonDelivery.school_id == sid, LessonDelivery.lesson_date >= start, LessonDelivery.lesson_date <= today).count()
    return {
        "coverage_pct": _pct(covered, total),
        "topics_covered": covered,
        "topics_total": total,
        "lessons_marked_pct": _pct(marked, scheduled),
        "classes_without_plan": sum(1 for c in cards if c.topics_total == 0),
        "_marked": marked,
        "_scheduled": scheduled,
    }


def m_homework(db, sid, today):
    grid = homework_grid(db, sid, None)
    s = grid.summary
    recorded = s.given + s.board + s.none
    return {
        "recorded_pct": _pct(recorded, s.expected),
        "set_homework": s.given + s.board,
        "none_set": s.none,
        "missing": s.missing,
        "_recorded": recorded,
        "_expected": s.expected,
    }


def m_results(db, sid, today):
    term = current_term(db, sid)
    perf = performance_overview(db, sid, term.name if term else None, [])
    marked = sum(c.marked for c in perf.classes)
    passed = sum(round((c.pass_rate or 0) * c.marked / 100) for c in perf.classes)
    return {
        "average": perf.school_average,
        "pass_rate": _pct(passed, marked),
        "learners_marked": marked,
        "weak_classes": sum(1 for c in perf.classes if c.average is not None and c.average < 50),
        "_passed": passed,
        "_marked": marked,
    }


def m_conduct(db, sid, today):
    start = _utc_range(db, sid, week_start(today), today)[0]
    q = db.query(ConductReport).filter_by(school_id=sid)
    return {
        "open_reports": q.filter(ConductReport.status == ConductStatus.OPEN).count(),
        "this_week": q.filter(ConductReport.created_at >= start).count(),
        "this_term": q.count(),
    }


def m_fees(db, sid, today):
    invs = db.query(FeeInvoice).filter_by(school_id=sid).all()
    billed = sum(float(i.amount_due) for i in invs)
    paid = sum(float(i.amount_paid) for i in invs)
    owed: dict[int, float] = defaultdict(float)
    for i in invs:
        owed[i.student_id] += float(i.amount_due) - float(i.amount_paid)
    return {
        "billed": round(billed, 2),
        "collected": round(paid, 2),
        "rate": _pct(paid, billed),
        "outstanding": round(max(0.0, billed - paid), 2),
        "owing_learners": sum(1 for v in owed.values() if v > 0.005),
    }


def m_finance(db, sid, today):
    lo, hi = _utc_range(db, sid, today.replace(day=1), today)
    income = float(sum(float(p.amount) for p in db.query(FeePayment).filter(FeePayment.school_id == sid, FeePayment.paid_at >= lo, FeePayment.paid_at < hi)))
    spent = float(sum(float(e.amount) for e in db.query(Expense).filter(Expense.school_id == sid, Expense.date >= today.replace(day=1), Expense.date <= today, Expense.status == ExpenseStatus.APPROVED)))
    return {
        "income_month": round(income, 2),
        "expenses_month": round(spent, 2),
        "net_month": round(income - spent, 2),
        "pending_expenses": db.query(Expense).filter_by(school_id=sid, status=ExpenseStatus.PENDING).count(),
    }


def m_transport(db, sid, today):
    from app.core.transport_oversight import fleet_alerts

    runs = db.query(TransportRun).filter_by(school_id=sid, run_date=today).all()
    return {
        "vehicles": db.query(Vehicle).filter_by(school_id=sid, is_active=True).count(),
        "riders": db.query(Student).filter(Student.school_id == sid, Student.is_active.is_(True), Student.transport_route_id.isnot(None)).count(),
        "runs_today": len(runs),
        "runs_completed": sum(1 for r in runs if r.status == "completed"),
        "fleet_alerts": sum(1 for a in fleet_alerts(db, sid, today) if a.urgent),
    }


def m_library(db, sid, today):
    copies = db.query(BookCopy).filter_by(school_id=sid).all()
    active = db.query(Loan).filter(Loan.school_id == sid, Loan.returned_at.is_(None)).all()
    leaf = [l for l in active if l.student_id or not any(c.parent_loan_id == l.id for c in active)]
    return {
        "titles": db.query(Book).filter_by(school_id=sid).count(),
        "copies": len(copies),
        "on_loan": sum(1 for c in copies if c.status == "on_loan"),
        "overdue": sum(1 for l in leaf if l.due_date < today),
        "lost": sum(1 for c in copies if c.status == "lost"),
    }


def m_stores(db, sid, today):
    items = db.query(StockItem).filter_by(school_id=sid).all()
    return {
        "items": len(items),
        "stock_value": round(sum(i.quantity * float(i.unit_cost) for i in items), 2),
        "low_stock": sum(1 for i in items if i.quantity <= i.reorder_level),
        "requests_waiting": db.query(StoreRequest).filter_by(school_id=sid, status="requested").count(),
    }


def m_admissions(db, sid, today):
    leads = db.query(Lead).filter_by(school_id=sid).all()
    return {
        "open_enquiries": sum(1 for l in leads if l.stage not in (LeadStage.ENROLLED, LeadStage.LOST)),
        "applied": sum(1 for l in leads if l.stage in (LeadStage.APPLIED, LeadStage.OFFER_SENT)),
        "enrolled": sum(1 for l in leads if l.stage == LeadStage.ENROLLED),
        "lost": sum(1 for l in leads if l.stage == LeadStage.LOST),
    }


def m_staff(db, sid, today):
    from app.core.staff_presence import build_day

    day = build_day(db, sid, today)
    rows = day["rows"]
    in_ = sum(1 for r in rows if r["status"] in ("present", "late"))
    return {
        "tracked": len(rows) if day["school_day"] else None,
        "in_today": in_ if day["school_day"] else None,
        "late": sum(1 for r in rows if r["status"] == "late") if day["school_day"] else None,
        "absent": sum(1 for r in rows if r["status"] == "absent") if day["school_day"] else None,
        "on_leave": sum(1 for r in rows if r["status"] == "on_leave") if day["school_day"] else None,
        "_in": in_,
        "_n": len(rows),
    }


R = lambda n, d: ("ratio", n, d)  # noqa: E731

MODULES: dict[str, Module] = {m.key: m for m in [
    Module("classes", "Classes", "How many classes each school runs and how full they are.", "/dashboard/classes", "students_staff", [
        Col("classes", "Classes", "count"),
        Col("learners", "Learners", "count"),
        Col("avg_size", "Average class size", "decimal", total=R("_size_n", "_size_d")),
        Col("no_class_teacher", "Without a class teacher", "count", "low"),
    ], m_classes),
    Module("teachers", "Teachers", "Who is teaching, who is in today, and how many lessons get marked.", "/dashboard/teachers", "students_staff", [
        Col("teachers", "Teachers", "count"),
        Col("in_today", "In today", "count"),
        Col("absent_today", "Absent today", "count", "low"),
        Col("class_teachers", "Class teachers set", "count"),
        Col("lessons_marked_pct", "Lessons marked this week", "percent", "high", total=R("_marked", "_scheduled")),
    ], m_teachers),
    Module("students", "Students", "Enrolment, and what is still missing from learner records.", "/dashboard/students", "students_staff", [
        Col("learners", "Learners", "count"),
        Col("boys", "Boys", "count"),
        Col("girls", "Girls", "count"),
        Col("new_this_term", "New this term", "count"),
        Col("exam_numbers_missing", "Exam numbers missing", "count", "low", "Grades 6, 9 and 12"),
        Col("no_guardian_phone", "No guardian phone", "count", "low"),
    ], m_students),
    Module("attendance", "Attendance", "Whether registers are taken and how many learners are in school.", "/dashboard/attendance", "attendance", [
        Col("rate_today", "In school today", "percent", "high", total=R("_ok_today", "_marked_today")),
        Col("registers_taken", "Registers taken today", "count"),
        Col("registers_total", "Registers expected", "count"),
        Col("rate_week", "This week", "percent", "high", total=R("_week_ok", "_week_n")),
    ], m_attendance),
    Module("staff", "Staff attendance", "Who is at work today across the school's staff.", "/dashboard/staff-attendance", "staff_attendance", [
        Col("tracked", "Staff tracked", "count"),
        Col("in_today", "In today", "count"),
        Col("late", "Late", "count", "low"),
        Col("absent", "Absent", "count", "low"),
        Col("on_leave", "On leave", "count"),
    ], m_staff),
    Module("lessons", "Lesson plans", "How far each school is through its syllabus and whether lessons are marked.", "/dashboard/lesson-plans", "lesson_plans", [
        Col("coverage_pct", "Syllabus covered", "percent", "high", total=R("topics_covered", "topics_total")),
        Col("topics_covered", "Topics covered", "count"),
        Col("topics_total", "Topics planned", "count"),
        Col("lessons_marked_pct", "Lessons marked this week", "percent", "high", total=R("_marked", "_scheduled")),
        Col("classes_without_plan", "Classes with no plan", "count", "low"),
    ], m_lessons),
    Module("homework", "Homework", "Whether teachers are recording homework this week.", "/dashboard/homework", "homework", [
        Col("recorded_pct", "Lessons with homework recorded", "percent", "high", total=R("_recorded", "_expected")),
        Col("set_homework", "Set homework", "count"),
        Col("none_set", "Said no homework", "count"),
        Col("missing", "Nothing recorded", "count", "low"),
    ], m_homework),
    Module("results", "Grading", "How learners are performing this term.", "/dashboard/results", "results", [
        Col("average", "School average", "score", "high"),
        Col("pass_rate", "Pass rate", "percent", "high", total=R("_passed", "_marked")),
        Col("learners_marked", "Learners with marks", "count"),
        Col("weak_classes", "Classes averaging under 50", "count", "low"),
    ], m_results),
    Module("conduct", "Conduct", "Behaviour reports waiting for the head.", "/dashboard/conduct", "conduct", [
        Col("open_reports", "Open reports", "count", "low"),
        Col("this_week", "Filed this week", "count"),
        Col("this_term", "In all", "count"),
    ], m_conduct),
    Module("fees", "Fees", "What each school has billed, collected and is still owed.", "/dashboard/fees", "fees", [
        Col("billed", "Billed", "money"),
        Col("collected", "Collected", "money"),
        Col("rate", "Collection rate", "percent", "high", total=R("collected", "billed")),
        Col("outstanding", "Still owed", "money", "low"),
        Col("owing_learners", "Learners owing", "count", "low"),
    ], m_fees),
    Module("finance", "Finance", "Money in and out this month, and expenses waiting for a decision.", "/dashboard/finance", "finance", [
        Col("income_month", "Fees received this month", "money"),
        Col("expenses_month", "Spent this month", "money"),
        Col("net_month", "Left over", "money", "high"),
        Col("pending_expenses", "Expenses awaiting approval", "count", "low"),
    ], m_finance),
    Module("transport", "Transport", "The buses: how many ran today and what needs fixing.", "/dashboard/transport", "transport", [
        Col("vehicles", "Vehicles", "count"),
        Col("riders", "Learners on the bus", "count"),
        Col("runs_today", "Runs today", "count"),
        Col("runs_completed", "Completed", "count"),
        Col("fleet_alerts", "Urgent vehicle papers", "count", "low"),
    ], m_transport),
    Module("library", "Library", "Books on loan and overdue.", "/dashboard/library", "library", [
        Col("titles", "Titles", "count"),
        Col("copies", "Copies", "count"),
        Col("on_loan", "On loan", "count"),
        Col("overdue", "Overdue", "count", "low"),
        Col("lost", "Lost", "count", "low"),
    ], m_library),
    Module("stores", "Stores", "Stock levels and what classes have asked for.", "/dashboard/stores", "erp_finance", [
        Col("items", "Items", "count"),
        Col("stock_value", "Stock value", "money"),
        Col("low_stock", "At or below reorder level", "count", "low"),
        Col("requests_waiting", "Requests waiting", "count", "low"),
    ], m_stores),
    Module("admissions", "Admissions", "Enquiries moving towards enrolment.", "/dashboard/crm", "admissions_crm", [
        Col("open_enquiries", "Open enquiries", "count"),
        Col("applied", "Applied or offered", "count"),
        Col("enrolled", "Enrolled", "count", "high"),
        Col("lost", "Lost", "count", "low"),
    ], m_admissions),
]}

ORDER = list(MODULES)


def _enabled(db: Session, school_id: int, flag: str | None) -> bool:
    if flag is None:
        return True
    row = db.query(SchoolModule).filter_by(school_id=school_id, module_key=flag).first()
    return bool(row and row.enabled)


def _group_total(columns: list[Col], rows: list[dict]) -> dict:
    out: dict = {}
    live = [r for r in rows if r["enabled"]]
    for c in columns:
        if c.total == "sum":
            vals = [r["values"].get(c.key) for r in live if r["values"].get(c.key) is not None]
            out[c.key] = round(sum(vals), 2) if vals else None
        else:
            _, n, d = c.total
            num = sum(r["values"].get(n) or 0 for r in live)
            den = sum(r["values"].get(d) or 0 for r in live)
            if c.kind == "decimal":
                out[c.key] = round(num / den, 1) if den else None
            else:
                out[c.key] = _pct(num, den)
    return out


def compare_module(db: Session, schools: list[School], key: str) -> dict | None:
    mod = MODULES.get(key)
    if mod is None:
        return None
    rows = []
    for school in schools:
        today = school_today(db, school.id)
        on = _enabled(db, school.id, mod.flag)
        values = mod.fn(db, school.id, today) if on else {}
        rows.append({"school_id": school.id, "school_name": school.name, "enabled": on, "values": values})
    # Highlight the best and the weakest school for each column that has a direction.
    marks: dict[str, dict[str, str]] = {}
    for c in mod.columns:
        if c.better is None:
            continue
        have = [(r["school_id"], r["values"].get(c.key)) for r in rows if r["enabled"] and r["values"].get(c.key) is not None]
        if len({v for _, v in have}) < 2:
            continue
        best = max(have, key=lambda t: t[1] if c.better == "high" else -t[1])
        worst = min(have, key=lambda t: t[1] if c.better == "high" else -t[1])
        marks[c.key] = {"best": str(best[0]), "weakest": str(worst[0])}
    return {
        "key": mod.key,
        "title": mod.title,
        "blurb": mod.blurb,
        "href": mod.href,
        "columns": [{"key": c.key, "label": c.label, "kind": c.kind, "better": c.better, "hint": c.hint} for c in mod.columns],
        "rows": [{**r, "values": {c.key: r["values"].get(c.key) for c in mod.columns}} for r in rows],
        "group": _group_total(mod.columns, rows),
        "marks": marks,
    }
