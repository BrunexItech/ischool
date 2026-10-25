"""The server runs in UTC, but a school's registers belong to the school's
own calendar day — a register taken at 01:00 on Thursday in Eldoret is
Thursday's, even though UTC still says Wednesday."""

from datetime import date, datetime, timezone

from app.core.dates import school_today
from app.models.academics import SchoolClass, Student
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.user import UserRole
from tests.conftest import _login, _make_user, auth_headers


def test_utc_evening_is_already_tomorrow_in_nairobi(db_session, school):
    # 22:30 UTC on 28 Oct is 01:30 on 29 Oct in Kenya.
    now = datetime(2026, 10, 28, 22, 30, tzinfo=timezone.utc)
    assert school_today(db_session, school.id, now=now) == date(2026, 10, 29)


def test_before_the_utc_offset_it_is_still_the_same_day(db_session, school):
    now = datetime(2026, 10, 28, 20, 59, tzinfo=timezone.utc)  # 23:59 in Kenya
    assert school_today(db_session, school.id, now=now) == date(2026, 10, 28)


def test_each_school_uses_its_own_timezone(db_session, school):
    school.timezone = "Pacific/Auckland"  # UTC+13 in October
    db_session.commit()
    now = datetime(2026, 10, 28, 12, 0, tzinfo=timezone.utc)
    assert school_today(db_session, school.id, now=now) == date(2026, 10, 29)


def test_an_unknown_timezone_falls_back_instead_of_crashing(db_session, school):
    school.timezone = "Not/AZone"
    db_session.commit()
    now = datetime(2026, 10, 28, 22, 30, tzinfo=timezone.utc)
    assert school_today(db_session, school.id, now=now) == date(2026, 10, 29)  # Africa/Nairobi default


def test_my_classes_register_flag_follows_the_school_day(client, db_session, school):
    teacher, password = _make_user(db_session, school, UserRole.TEACHER, "tz-teacher@test-academy.test")
    cls = SchoolClass(school_id=school.id, name="Grade 3 TZ", homeroom_teacher_id=teacher.id)
    db_session.add(cls)
    db_session.flush()
    student = Student(school_id=school.id, class_id=cls.id, admission_number="TZ-1", first_name="T", last_name="Z")
    db_session.add(student)
    db_session.flush()
    db_session.add(
        AttendanceRecord(
            school_id=school.id, class_id=cls.id, student_id=student.id,
            date=school_today(db_session, school.id), status=AttendanceStatus.PRESENT,
        )
    )
    db_session.commit()

    headers = auth_headers(_login(client, teacher.email, password))
    rows = client.get(f"/schools/{school.id}/teacher-assignments/mine", headers=headers)
    assert rows.status_code == 200, rows.text
    assert rows.json()[0]["attendance_marked_today"] is True
