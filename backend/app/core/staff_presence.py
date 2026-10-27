"""Who was expected at school, and what actually happened.

A staff row only exists when someone scans, so an absence leaves no trace.
Here the school's own calendar says who should have been in (every school
day, minus holidays, leave and anyone excluded), and each of them gets a
status: present, late, on leave, or absent (with a reason when one has been
recorded). Nothing here requires a teacher to scan before marking a learner
register: a register a teacher marks is itself counted as proof they were in."""

from collections import defaultdict
from datetime import date, time, timedelta

from sqlalchemy.orm import Session

from app.core.dates import school_now, school_today, school_tz
from app.models.academic_term import AcademicTerm
from app.models.academics import SchoolClass
from app.models.attendance import AttendanceRecord
from app.models.calendar_event import CalendarEvent, CalendarEventType
from app.models.staff_attendance import (
    StaffAbsenceNote,
    StaffAttendance,
    StaffAttendanceSettings,
    StaffLeave,
    StaffTrackingExclusion,
)
from app.models.timetable import TimetableSlot
from app.models.user import User, UserRole

TRACKED_ROLES = (
    UserRole.TEACHER,
    UserRole.STAFF,
    UserRole.BURSAR,
    UserRole.SECURITY,
    UserRole.BOARDING_STAFF,
    UserRole.TRANSPORT_STAFF,
    UserRole.SECRETARY,
    UserRole.TRANSPORT_ATTENDANT,
    UserRole.LIBRARIAN,
    UserRole.STORE_KEEPER,
    UserRole.ACCOUNTANT,
    UserRole.PROCUREMENT_OFFICER,
)
DEFAULT_LATE = time(7, 45)
DEFAULT_ABSENT = time(10, 0)


def get_settings(db: Session, school_id: int) -> tuple[time, time]:
    row = db.get(StaffAttendanceSettings, school_id)
    return (row.late_after, row.absent_after) if row else (DEFAULT_LATE, DEFAULT_ABSENT)


def tracked_staff(db: Session, school_id: int) -> list[User]:
    excluded = {e.user_id for e in db.query(StaffTrackingExclusion).filter_by(school_id=school_id).all()}
    users = (
        db.query(User)
        .filter(User.school_id == school_id, User.is_active.is_(True), User.role.in_(TRACKED_ROLES))
        .order_by(User.full_name)
        .all()
    )
    return [u for u in users if u.id not in excluded]


class _Context:
    """Everything needed to judge days between two dates, loaded once."""

    def __init__(self, db: Session, school_id: int, start: date, end: date):
        self.db = db
        self.school_id = school_id
        self.tz = school_tz(db, school_id)
        self.today = school_today(db, school_id)
        self.now_local = school_now(db, school_id)
        self.late_after, self.absent_after = get_settings(db, school_id)
        self.users = tracked_staff(db, school_id)
        ids = [u.id for u in self.users] or [0]
        self.terms = db.query(AcademicTerm).filter_by(school_id=school_id).all()
        self.holidays = [
            e for e in db.query(CalendarEvent).filter_by(school_id=school_id, event_type=CalendarEventType.HOLIDAY).all()
            if e.start_date <= end and (e.end_date or e.start_date) >= start
        ]
        self.scans: dict[tuple[int, date], StaffAttendance] = {
            (r.user_id, r.date): r
            for r in db.query(StaffAttendance).filter(StaffAttendance.school_id == school_id, StaffAttendance.user_id.in_(ids), StaffAttendance.date >= start, StaffAttendance.date <= end)
        }
        self.leaves: dict[int, list[StaffLeave]] = defaultdict(list)
        for lv in db.query(StaffLeave).filter(StaffLeave.school_id == school_id, StaffLeave.start_date <= end, StaffLeave.end_date >= start):
            self.leaves[lv.user_id].append(lv)
        self.notes: dict[tuple[int, date], StaffAbsenceNote] = {
            (n.user_id, n.date): n
            for n in db.query(StaffAbsenceNote).filter(StaffAbsenceNote.school_id == school_id, StaffAbsenceNote.date >= start, StaffAbsenceNote.date <= end)
        }
        # Learner registers marked by each person, by date: proof of presence.
        self.registers: dict[tuple[int, date], set[int]] = defaultdict(set)
        for uid, d, cid in db.query(AttendanceRecord.recorded_by, AttendanceRecord.date, AttendanceRecord.class_id).filter(
            AttendanceRecord.school_id == school_id, AttendanceRecord.date >= start, AttendanceRecord.date <= end, AttendanceRecord.recorded_by.isnot(None)
        ).distinct():
            self.registers[(uid, d)].add(cid)
        self.register_classes: dict[tuple[date, int], set[int]] = defaultdict(set)  # (date, class) -> recorders
        for uid, d, cid in db.query(AttendanceRecord.recorded_by, AttendanceRecord.date, AttendanceRecord.class_id).filter(
            AttendanceRecord.school_id == school_id, AttendanceRecord.date >= start, AttendanceRecord.date <= end
        ).distinct():
            self.register_classes[(d, cid)].add(uid or 0)
        self.homerooms: dict[int, list[int]] = defaultdict(list)
        for c in db.query(SchoolClass).filter_by(school_id=school_id).all():
            if c.homeroom_teacher_id:
                self.homerooms[c.homeroom_teacher_id].append(c.id)
        self.slots_per_weekday: dict[tuple[int, int], int] = defaultdict(int)
        for s in db.query(TimetableSlot).filter(TimetableSlot.school_id == school_id, TimetableSlot.teacher_user_id.in_(ids)):
            self.slots_per_weekday[(s.teacher_user_id, s.day_of_week)] += 1

    def holiday_on(self, d: date) -> str | None:
        for e in self.holidays:
            if e.start_date <= d <= (e.end_date or e.start_date):
                return e.title
        return None

    def is_school_day(self, d: date) -> bool:
        if d.weekday() >= 5 or self.holiday_on(d):
            return False
        dated = [t for t in self.terms if t.start_date and t.end_date]
        return True if not dated else any(t.start_date <= d <= t.end_date for t in dated)

    def leave_for(self, user_id: int, d: date) -> StaffLeave | None:
        return next((lv for lv in self.leaves.get(user_id, []) if lv.start_date <= d <= lv.end_date), None)

    def judge(self, user: User, d: date) -> dict:
        scan = self.scans.get((user.id, d))
        leave = self.leave_for(user.id, d)
        note = self.notes.get((user.id, d))
        out = dict(status="expected", source=None, leave_type=None, reason=None, note=None, scan=scan)
        if scan is not None and scan.clocked_in_at is not None:
            local = scan.clocked_in_at.astimezone(self.tz).time()
            out.update(status="late" if local > self.late_after else "present", source="scan")
        elif self.registers.get((user.id, d)):
            out.update(status="present", source="register")
        elif leave is not None:
            out.update(status="on_leave", leave_type=leave.leave_type, note=leave.note)
        elif d > self.today:
            out.update(status="expected")
        elif d == self.today and self.now_local.time() < self.absent_after:
            out.update(status="expected")
        else:
            out.update(status="absent", reason=note.reason if note else None, note=note.note if note else None)
        return out

    def register_state(self, user: User, d: date) -> str | None:
        classes = self.homerooms.get(user.id)
        if not classes:
            return None
        recorders: set[int] = set()
        for cid in classes:
            recorders |= self.register_classes.get((d, cid), set())
        if not recorders:
            return "missing"
        return "self" if user.id in recorders else "other"


def build_day(db: Session, school_id: int, d: date) -> dict:
    ctx = _Context(db, school_id, d, d)
    school_day = ctx.is_school_day(d)
    rows = []
    if school_day:
        for u in ctx.users:
            j = ctx.judge(u, d)
            scan = j["scan"]
            rows.append(
                dict(
                    user_id=u.id,
                    name=u.full_name,
                    role=u.role.value,
                    status=j["status"],
                    source=j["source"],
                    clocked_in_at=scan.clocked_in_at if scan else None,
                    clocked_out_at=scan.clocked_out_at if scan else None,
                    leave_type=j["leave_type"],
                    reason=j["reason"],
                    note=j["note"],
                    lessons=ctx.slots_per_weekday.get((u.id, d.weekday()), 0),
                    register_status=ctx.register_state(u, d),
                )
            )
    return dict(date=d, school_day=school_day, holiday=ctx.holiday_on(d), rows=rows)


def build_summary(db: Session, school_id: int, start: date, end: date, only_user: int | None = None) -> dict:
    ctx = _Context(db, school_id, start, end)
    end = min(end, ctx.today)
    days = [start + timedelta(days=i) for i in range((end - start).days + 1)] if end >= start else []
    days = [d for d in days if ctx.is_school_day(d)]
    rows = []
    for u in ctx.users:
        if only_user is not None and u.id != only_user:
            continue
        counts = dict(present=0, late=0, absent_explained=0, absent_unexplained=0, on_leave=0)
        counted = 0
        for d in days:
            j = ctx.judge(u, d)
            if j["status"] == "expected":
                continue
            counted += 1
            if j["status"] == "present":
                counts["present"] += 1
            elif j["status"] == "late":
                counts["late"] += 1
            elif j["status"] == "on_leave":
                counts["on_leave"] += 1
            elif j["reason"]:
                counts["absent_explained"] += 1
            else:
                counts["absent_unexplained"] += 1
        rows.append(dict(user_id=u.id, name=u.full_name, role=u.role.value, school_days=counted, **counts))
    return dict(date_from=start, date_to=end, school_days=len(days), rows=rows)
