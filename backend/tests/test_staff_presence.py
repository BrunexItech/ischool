"""Who was expected, who came, who was away and why. A teacher does not have
to scan before marking a learner register, and a register they mark counts as
proof they were in."""

from datetime import date, datetime, time, timedelta, timezone

from app.core.dates import school_today
from app.models.academic_term import AcademicTerm
from app.models.academics import SchoolClass, Student
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.calendar_event import CalendarEvent, CalendarEventType
from app.models.staff_attendance import StaffAttendance
from app.models.timetable import TimetableSlot
from app.models.results import Subject
from app.models.user import UserRole
from tests.conftest import _login, _make_user, auth_headers


def _last_school_day(db_session, school, back=1):
    d = school_today(db_session, school.id) - timedelta(days=back)
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d


def _setup(db_session, school):
    today = school_today(db_session, school.id)
    db_session.add(AcademicTerm(school_id=school.id, name="Term 3", start_date=today - timedelta(days=60), end_date=today + timedelta(days=30), is_current=True))
    teachers = {}
    for key in ("scanner", "ghost", "onleave", "registrar"):
        user, pw = _make_user(db_session, school, UserRole.TEACHER, f"{key}@test-academy.test")
        teachers[key] = (user, pw)
    db_session.commit()
    return teachers


def _scan(db_session, school, user, day, hour=7, minute=30):
    when = datetime(day.year, day.month, day.day, hour, minute, tzinfo=timezone.utc) - timedelta(hours=3)  # Nairobi is UTC+3
    db_session.add(StaffAttendance(school_id=school.id, user_id=user.id, date=day, clocked_in_at=when))
    db_session.commit()


def _day(client, school, token, day):
    r = client.get(f"/schools/{school.id}/staff-attendance/day", params={"date": day.isoformat()}, headers=auth_headers(token))
    assert r.status_code == 200, r.text
    return {row["name"].split()[0]: row for row in r.json()["rows"]}, r.json()


def test_a_teacher_who_never_scanned_shows_as_absent(client, db_session, school, school_admin_token):
    t = _setup(db_session, school)
    day = _last_school_day(db_session, school)
    _scan(db_session, school, t["scanner"][0], day, 7, 30)
    rows, body = _day(client, school, school_admin_token, day)
    assert rows["Scanner"]["status"] == "present"
    assert rows["Ghost"]["status"] == "absent"          # no scan, no record: now visible
    assert body["school_day"] is True


def test_late_scan_leave_reason_and_register_evidence(client, db_session, school, school_admin_token):
    t = _setup(db_session, school)
    day = _last_school_day(db_session, school)
    _scan(db_session, school, t["scanner"][0], day, 8, 20)       # after 07:45
    head = auth_headers(school_admin_token)

    # Leave granted by leadership turns an absence into "on leave".
    r = client.post(f"/schools/{school.id}/staff-attendance/leaves", headers=head,
                    json={"user_id": t["onleave"][0].id, "start_date": day.isoformat(), "end_date": day.isoformat(), "leave_type": "sick"})
    assert r.status_code == 201, r.text
    # A reason can be attached to a plain absence.
    assert client.put(f"/schools/{school.id}/staff-attendance/notes", headers=head,
                      json={"user_id": t["ghost"][0].id, "date": day.isoformat(), "reason": "official_duty"}).status_code == 204

    # A register marked by a teacher who never scanned counts as presence.
    cls = SchoolClass(school_id=school.id, name="Grade 6 North", homeroom_teacher_id=t["registrar"][0].id)
    db_session.add(cls)
    db_session.flush()
    kid = Student(school_id=school.id, class_id=cls.id, admission_number="K-1", first_name="K", last_name="K")
    db_session.add(kid)
    db_session.flush()
    db_session.add(AttendanceRecord(school_id=school.id, class_id=cls.id, student_id=kid.id, date=day, status=AttendanceStatus.PRESENT, recorded_by=t["registrar"][0].id))
    db_session.commit()

    rows, _ = _day(client, school, school_admin_token, day)
    assert rows["Scanner"]["status"] == "late"
    assert rows["Onleave"]["status"] == "on_leave" and rows["Onleave"]["leave_type"] == "sick"
    assert rows["Ghost"]["status"] == "absent" and rows["Ghost"]["reason"] == "official_duty"
    assert rows["Registrar"]["status"] == "present" and rows["Registrar"]["source"] == "register"
    assert rows["Registrar"]["register_status"] == "self"


def test_holidays_and_weekends_are_not_school_days(client, db_session, school, school_admin_token):
    _setup(db_session, school)
    day = _last_school_day(db_session, school)
    db_session.add(CalendarEvent(school_id=school.id, title="Mashujaa Day", event_type=CalendarEventType.HOLIDAY, start_date=day))
    db_session.commit()
    _, body = _day(client, school, school_admin_token, day)
    assert body["school_day"] is False and body["holiday"] == "Mashujaa Day" and body["rows"] == []
    sunday = day
    while sunday.weekday() != 6:
        sunday += timedelta(days=1)
    assert _day(client, school, school_admin_token, sunday)[1]["school_day"] is False


def test_summary_counts_and_only_leadership_grants_leave(client, db_session, school, school_admin_token):
    t = _setup(db_session, school)
    d1 = _last_school_day(db_session, school)
    d2 = d1 - timedelta(days=1)
    while d2.weekday() >= 5:
        d2 -= timedelta(days=1)
    _scan(db_session, school, t["scanner"][0], d1, 7, 30)
    _scan(db_session, school, t["scanner"][0], d2, 8, 30)
    head = auth_headers(school_admin_token)
    start = min(d1, d2)
    r = client.get(f"/schools/{school.id}/staff-attendance/summary", params={"date_from": start.isoformat(), "date_to": d1.isoformat()}, headers=head).json()
    rows = {x["name"].split()[0]: x for x in r["rows"]}
    assert rows["Scanner"]["present"] >= 1 and rows["Scanner"]["late"] >= 1
    assert rows["Ghost"]["absent_unexplained"] == rows["Ghost"]["school_days"] >= 1

    # A teacher can neither grant leave nor see anyone else's summary.
    mine = auth_headers(_login(client, t["ghost"][0].email, t["ghost"][1]))
    grant = client.post(f"/schools/{school.id}/staff-attendance/leaves", headers=mine,
                        json={"user_id": t["ghost"][0].id, "start_date": d1.isoformat(), "end_date": d1.isoformat(), "leave_type": "annual"})
    assert grant.status_code == 403
    own = client.get(f"/schools/{school.id}/staff-attendance/summary", params={"date_from": start.isoformat(), "date_to": d1.isoformat()}, headers=mine).json()
    assert [x["name"].split()[0] for x in own["rows"]] == ["Ghost"]


def test_excluded_staff_are_not_expected_and_settings_move_the_late_line(client, db_session, school, school_admin_token):
    t = _setup(db_session, school)
    day = _last_school_day(db_session, school)
    head = auth_headers(school_admin_token)
    assert client.put(f"/schools/{school.id}/staff-attendance/tracking", headers=head, json={"user_id": t["ghost"][0].id, "tracked": False}).status_code == 204
    rows, _ = _day(client, school, school_admin_token, day)
    assert "Ghost" not in rows

    _scan(db_session, school, t["scanner"][0], day, 8, 10)
    assert client.put(f"/schools/{school.id}/staff-attendance/settings", headers=head, json={"late_after": "08:30:00", "absent_after": "10:30:00"}).status_code == 200
    rows, _ = _day(client, school, school_admin_token, day)
    assert rows["Scanner"]["status"] == "present"          # 08:10 is no longer late
    bad = client.put(f"/schools/{school.id}/staff-attendance/settings", headers=head, json={"late_after": "10:00:00", "absent_after": "09:00:00"})
    assert bad.status_code == 400


def test_marking_a_register_never_requires_a_scan(client, db_session, school):
    t = _setup(db_session, school)
    cls = SchoolClass(school_id=school.id, name="Grade 5 West", homeroom_teacher_id=t["registrar"][0].id)
    db_session.add(cls)
    db_session.flush()
    kid = Student(school_id=school.id, class_id=cls.id, admission_number="K-2", first_name="K", last_name="K")
    db_session.add(kid)
    db_session.commit()
    h = auth_headers(_login(client, t["registrar"][0].email, t["registrar"][1]))
    today = school_today(db_session, school.id)
    r = client.post(f"/schools/{school.id}/attendance", headers=h,
                    json={"class_id": cls.id, "date": today.isoformat(), "records": [{"student_id": kid.id, "status": "present"}]})
    assert r.status_code in (200, 201), r.text
