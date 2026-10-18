"""The Analytics page's attendance-trend chart is shared across every role
that's allowed to view analytics (teacher, staff, bursar, security...) —
unlike the admin-only dashboard summary it used to ride on, which also
carries finance totals those roles shouldn't see."""

from datetime import date

from app.models.academics import SchoolClass, Student
from app.models.attendance import AttendanceRecord, AttendanceStatus
from tests.conftest import auth_headers


def _seed_attendance(db_session, school):
    cls = SchoolClass(school_id=school.id, name="Grade 6 Kerio")
    db_session.add(cls)
    db_session.flush()
    s1 = Student(school_id=school.id, class_id=cls.id, admission_number="AT-0001", first_name="Amani", last_name="Otieno")
    db_session.add(s1)
    db_session.flush()
    db_session.add(AttendanceRecord(school_id=school.id, class_id=cls.id, student_id=s1.id, date=date.today(), status=AttendanceStatus.PRESENT))
    db_session.commit()


def test_teacher_can_view_attendance_trend(client, teacher_token, school, db_session):
    _seed_attendance(db_session, school)
    response = client.get(f"/schools/{school.id}/analytics/attendance-trend", headers=auth_headers(teacher_token))
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 7
    assert body[-1]["rate"] == 100.0


def test_bursar_can_view_attendance_trend(client, bursar_token, school, db_session):
    _seed_attendance(db_session, school)
    response = client.get(f"/schools/{school.id}/analytics/attendance-trend", headers=auth_headers(bursar_token))
    assert response.status_code == 200


def test_security_can_view_attendance_trend(client, security_token, school):
    response = client.get(f"/schools/{school.id}/analytics/attendance-trend", headers=auth_headers(security_token))
    assert response.status_code == 200


def test_student_cannot_view_attendance_trend(client, db_session, school):
    from app.models.user import UserRole
    from tests.conftest import _make_user, _login

    _, password = _make_user(db_session, school, UserRole.STUDENT, "learner@test-academy.test")
    token = _login(client, "learner@test-academy.test", password)
    response = client.get(f"/schools/{school.id}/analytics/attendance-trend", headers=auth_headers(token))
    assert response.status_code == 403


def test_attendance_trend_matches_dashboard_summary(client, school_admin_token, school, db_session):
    _seed_attendance(db_session, school)
    trend = client.get(f"/schools/{school.id}/analytics/attendance-trend", headers=auth_headers(school_admin_token)).json()
    summary = client.get(f"/schools/{school.id}/dashboard/summary", headers=auth_headers(school_admin_token)).json()
    assert trend == summary["attendance_trend"]
