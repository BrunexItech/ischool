"""A dated trail of what happened at the school.

One function turns the records every module already keeps into a single
timeline for any span of days. The head's "Recent activity" panel reads a
few days of it; "Find by date" reads exactly one. Nothing is stored twice:
every event points back at the record it came from."""

from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.dates import school_tz
from app.models.academics import SchoolClass, Student
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.audit_log import AuditLog
from app.models.award import Award
from app.models.calendar_event import CalendarEvent
from app.models.communication import Announcement
from app.models.complaint import Complaint
from app.models.conduct_report import ConductReport
from app.models.expense import Expense
from app.models.fees import FeePayment
from app.models.homework import Homework
from app.models.lesson_delivery import LessonDelivery
from app.models.pickup_dropoff import PickupDropoffLog
from app.models.results import Result, Subject
from app.models.trip import Trip
from app.models.user import User
from app.schemas.oversight import ActivityEvent

# What each kind of event is called in the filter, in the order shown.
KINDS = {
    "attendance": "Registers",
    "lessons": "Lessons",
    "homework": "Homework",
    "marks": "Marks",
    "conduct": "Conduct",
    "awards": "Awards",
    "announcements": "Notices",
    "calendar": "Calendar",
    "trips": "Trips",
    "transport": "Transport",
    "security": "Security",
    "boarding": "Boarding",
    "complaints": "Complaints",
    "finance": "Finance",
    "changes": "Changes",
}


def _bounds(db: Session, school_id: int, start: date, end: date) -> tuple[datetime, datetime]:
    tz = school_tz(db, school_id)
    lo = datetime.combine(start, time.min, tzinfo=tz).astimezone(timezone.utc)
    hi = datetime.combine(end + timedelta(days=1), time.min, tzinfo=tz).astimezone(timezone.utc)
    return lo, hi


def _stamp(dt: datetime | None, tz) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(tz)


def build_activity(db: Session, school_id: int, start: date, end: date, kinds: set[str] | None = None, limit: int = 400) -> list[ActivityEvent]:
    tz = school_tz(db, school_id)
    lo, hi = _bounds(db, school_id, start, end)
    users = {u.id: u.full_name for u in db.query(User).filter_by(school_id=school_id)}
    classes = {c.id: c.name for c in db.query(SchoolClass).filter_by(school_id=school_id)}
    subjects = {s.id: s.name for s in db.query(Subject).filter_by(school_id=school_id)}
    students = {s.id: f"{s.first_name} {s.last_name}" for s in db.query(Student).filter_by(school_id=school_id)}
    events: list[ActivityEvent] = []

    def want(kind: str) -> bool:
        return kinds is None or kind in kinds

    def add(kind: str, at: datetime | None, title: str, detail: str = "", actor: int | str | None = None, href: str = "") -> None:
        stamped = _stamp(at, tz)
        if stamped is None:
            return
        name = actor if isinstance(actor, str) else (users.get(actor) if actor else None)
        events.append(ActivityEvent(kind=kind, label=KINDS[kind], at=stamped, title=title, detail=detail, actor=name, href=href))

    if want("attendance"):
        groups: dict[tuple[int, date, int | None], list[AttendanceRecord]] = defaultdict(list)
        for r in db.query(AttendanceRecord).filter(AttendanceRecord.school_id == school_id, AttendanceRecord.created_at >= lo, AttendanceRecord.created_at < hi):
            groups[(r.class_id, r.date, r.recorded_by)].append(r)
        for (cid, d, by), rs in groups.items():
            away = sum(1 for r in rs if r.status != AttendanceStatus.PRESENT)
            add("attendance", max(r.created_at for r in rs), f"Register taken: {classes.get(cid, 'Class')}", f"{len(rs)} marked, {away} away" + (f" (register for {d:%d %b})" if d != _stamp(rs[0].created_at, tz).date() else ""), by, "/dashboard/attendance")

    if want("lessons"):
        for l in db.query(LessonDelivery).filter(LessonDelivery.school_id == school_id, LessonDelivery.created_at >= lo, LessonDelivery.created_at < hi):
            what = {"taught": "Lesson taught", "not_taught": "Lesson not taught", "partial": "Lesson partly taught"}.get(l.status, "Lesson recorded")
            add("lessons", l.created_at, f"{what}: {subjects.get(l.subject_id, 'Subject')}, {classes.get(l.class_id, 'class')}", l.topic or l.remark or "", l.teacher_user_id, "/dashboard/lesson-plans")

    if want("homework"):
        for h in db.query(Homework).filter(Homework.school_id == school_id, Homework.created_at >= lo, Homework.created_at < hi):
            how = "given on the board" if h.given_on_board else f"due {h.due_date:%d %b}"
            add("homework", h.created_at, f"Homework: {h.title}", f"{subjects.get(h.subject_id, '')}, {classes.get(h.class_id, '')}, {how}", h.created_by, "/dashboard/homework")

    if want("marks"):
        mark_groups: dict[tuple, list[Result]] = defaultdict(list)
        for r in db.query(Result).filter(Result.school_id == school_id, Result.created_at >= lo, Result.created_at < hi):
            mark_groups[(r.recorded_by, r.subject_id, r.term, r.exam_type)].append(r)
        for (by, sid, term, etype), rs in mark_groups.items():
            add("marks", max(r.created_at for r in rs), f"Marks entered: {subjects.get(sid, 'Subject')}", f"{etype}, {term}: {len(rs)} learner{'s' if len(rs) != 1 else ''}", by, "/dashboard/results")

    if want("conduct"):
        for c in db.query(ConductReport).filter(ConductReport.school_id == school_id, ConductReport.created_at >= lo, ConductReport.created_at < hi):
            add("conduct", c.created_at, f"Conduct report: {students.get(c.student_id, 'Learner')}", c.category.value.replace("_", " "), c.reported_by, "/dashboard/conduct")
        for c in db.query(ConductReport).filter(ConductReport.school_id == school_id, ConductReport.responded_at >= lo, ConductReport.responded_at < hi):
            add("conduct", c.responded_at, f"Conduct report answered: {students.get(c.student_id, 'Learner')}", (c.response or "")[:140], c.responded_by, "/dashboard/conduct")

    if want("awards"):
        for a in db.query(Award).filter(Award.school_id == school_id, Award.created_at >= lo, Award.created_at < hi):
            who = students.get(a.student_id) if a.student_id else (users.get(a.staff_user_id) if a.staff_user_id else classes.get(a.class_id, "Whole school"))
            add("awards", a.created_at, f"Award: {a.title}", who or "", a.awarded_by, "/dashboard/awards")

    if want("announcements"):
        for a in db.query(Announcement).filter(Announcement.school_id == school_id, Announcement.created_at >= lo, Announcement.created_at < hi):
            add("announcements", a.created_at, f"Notice: {a.title}", a.audience.value.replace("_", " "), a.created_by, "/dashboard/announcements")

    if want("calendar"):
        for e in db.query(CalendarEvent).filter(CalendarEvent.school_id == school_id, CalendarEvent.created_at >= lo, CalendarEvent.created_at < hi):
            add("calendar", e.created_at, f"Calendar: {e.title}", f"On {e.start_date:%d %b %Y}", e.created_by, "/dashboard/calendar")

    if want("trips"):
        for t in db.query(Trip).filter(Trip.school_id == school_id, Trip.created_at >= lo, Trip.created_at < hi):
            add("trips", t.created_at, f"Trip requested: {t.title}", f"{t.destination}, {t.start_date:%d %b}", t.requested_by, "/dashboard/trips")

    if want("transport"):
        for p in db.query(PickupDropoffLog).filter(PickupDropoffLog.school_id == school_id, PickupDropoffLog.occurred_at >= lo, PickupDropoffLog.occurred_at < hi):
            verb = "picked up" if p.event_type.value == "pickup" else "dropped off"
            add("transport", p.occurred_at, f"{students.get(p.student_id, 'Learner')} {verb}", f"By {p.person_name}", p.recorded_by, "/dashboard/pickup-dropoff")

    if want("security"):
        from app.models.security import SecurityIncident, VisitorLog

        for i in db.query(SecurityIncident).filter(SecurityIncident.school_id == school_id, SecurityIncident.created_at >= lo, SecurityIncident.created_at < hi):
            add("security", i.created_at, f"Security incident: {i.type}", f"{i.location} · {i.severity.value} · {i.status.value}", i.logged_by, "/dashboard/security")
        for v in db.query(VisitorLog).filter(VisitorLog.school_id == school_id, VisitorLog.signed_in_at >= lo, VisitorLog.signed_in_at < hi):
            add("security", v.signed_in_at, f"Visitor signed in: {v.name}", f"To see {v.host_name} · {v.purpose}", None, "/dashboard/security")

    if want("boarding"):
        from app.models.boarding import BoardingIncident, Exeat, SickBayVisit

        for e in db.query(Exeat).filter(Exeat.school_id == school_id, Exeat.created_at >= lo, Exeat.created_at < hi):
            add("boarding", e.created_at, f"Exeat requested: {students.get(e.student_id, 'Learner')}", f"{e.from_date:%d %b} to {e.to_date:%d %b} · {e.status.value}", None, "/dashboard/boarding")
        for v in db.query(SickBayVisit).filter(SickBayVisit.school_id == school_id, SickBayVisit.created_at >= lo, SickBayVisit.created_at < hi):
            add("boarding", v.created_at, f"Sick bay: {students.get(v.student_id, 'Learner')}", v.complaint, v.logged_by, "/dashboard/boarding")
        for b in db.query(BoardingIncident).filter(BoardingIncident.school_id == school_id, BoardingIncident.created_at >= lo, BoardingIncident.created_at < hi):
            add("boarding", b.created_at, f"Boarding incident: {b.type}", b.status.value, b.logged_by, "/dashboard/boarding")

    if want("complaints"):
        for c in db.query(Complaint).filter(Complaint.school_id == school_id, Complaint.created_at >= lo, Complaint.created_at < hi):
            add("complaints", c.created_at, f"Complaint: {c.subject}", f"From {c.raised_by_name}", c.raised_by, "/dashboard/complaints")

    if want("finance"):
        for p in db.query(FeePayment).filter(FeePayment.school_id == school_id, FeePayment.paid_at >= lo, FeePayment.paid_at < hi):
            add("finance", p.paid_at, f"Fee payment: KES {float(p.amount):,.0f}", p.method, p.recorded_by, "/dashboard/fees")
        for e in db.query(Expense).filter(Expense.school_id == school_id, Expense.created_at >= lo, Expense.created_at < hi):
            add("finance", e.created_at, f"Expense: {e.description}", f"KES {float(e.amount):,.0f}, {e.status.value.lower()}", e.recorded_by, "/dashboard/finance")

    if want("changes"):
        for a in db.query(AuditLog).filter(AuditLog.school_id == school_id, AuditLog.created_at >= lo, AuditLog.created_at < hi):
            add("changes", a.created_at, a.action.replace(".", " ").replace("_", " ").capitalize(), a.entity_type.replace("_", " "), a.actor.full_name if a.actor else None, "/dashboard/activity-log")

    events.sort(key=lambda e: e.at, reverse=True)
    return events[:limit]


def activity_counts(events: list[ActivityEvent]) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for e in events:
        counts[e.kind] += 1
    return dict(counts)
