"""Dashboard summary: the real, aggregated figures an admin's home screen
needs — headcounts, fee collection, an attendance trend, which registers are
still unmarked today, the largest outstanding balances, and recent activity."""

from datetime import timedelta

from app.core.dates import school_today
from app.models.academics import SchoolClass, Student
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.audit_log import AuditLog
from app.models.fees import FeeInvoice
from tests.conftest import auth_headers


def _seed(db_session, school):
    cls = SchoolClass(school_id=school.id, name="Grade 6 Kerio")
    db_session.add(cls)
    db_session.flush()

    s1 = Student(school_id=school.id, class_id=cls.id, admission_number="ELS-0001", first_name="Amani", last_name="Otieno")
    s2 = Student(school_id=school.id, class_id=cls.id, admission_number="ELS-0002", first_name="Brian", last_name="Mutiso")
    db_session.add_all([s1, s2])
    db_session.flush()

    db_session.add_all(
        [
            AttendanceRecord(school_id=school.id, class_id=cls.id, student_id=s1.id, date=school_today(db_session, school.id), status=AttendanceStatus.PRESENT),
            AttendanceRecord(school_id=school.id, class_id=cls.id, student_id=s2.id, date=school_today(db_session, school.id), status=AttendanceStatus.ABSENT),
            AttendanceRecord(school_id=school.id, class_id=cls.id, student_id=s1.id, date=school_today(db_session, school.id) - timedelta(days=1), status=AttendanceStatus.PRESENT),
            AttendanceRecord(school_id=school.id, class_id=cls.id, student_id=s2.id, date=school_today(db_session, school.id) - timedelta(days=1), status=AttendanceStatus.PRESENT),
        ]
    )

    db_session.add(FeeInvoice(school_id=school.id, student_id=s1.id, term="Term 2", amount_due=20000, amount_paid=5000))
    db_session.add(FeeInvoice(school_id=school.id, student_id=s2.id, term="Term 2", amount_due=15000, amount_paid=15000))

    db_session.add(AuditLog(school_id=school.id, actor_user_id=None, action="create", entity_type="student", entity_id=s1.id))
    db_session.commit()
    return cls, s1, s2


def test_dashboard_summary_aggregates_real_data(client, school_admin_token, school, db_session):
    cls, s1, s2 = _seed(db_session, school)

    response = client.get(f"/schools/{school.id}/dashboard/summary", headers=auth_headers(school_admin_token))
    assert response.status_code == 200
    body = response.json()

    assert body["total_students"] == 2
    assert body["amount_billed"] == 35000
    assert body["amount_paid"] == 20000
    assert body["fee_collection_rate"] == round(20000 / 35000 * 100, 1)
    assert body["today_attendance_rate"] == 50.0
    assert body["yesterday_attendance_rate"] == 100.0
    assert len(body["attendance_trend"]) == 7
    assert body["classes_total"] == 1
    assert body["classes_marked_today"] == 1
    assert body["pending_registers"] == []

    assert len(body["top_balances"]) == 1
    assert body["top_balances"][0]["student_name"] == "Amani Otieno"
    assert body["top_balances"][0]["balance"] == 15000

    assert len(body["recent_activity"]) == 1
    assert body["recent_activity"][0]["entity_type"] == "student"


def test_dashboard_lists_classes_with_unmarked_registers(client, school_admin_token, school, db_session):
    cls = SchoolClass(school_id=school.id, name="Grade 7 Kerio")
    db_session.add(cls)
    db_session.flush()
    db_session.add(Student(school_id=school.id, class_id=cls.id, admission_number="ELS-0003", first_name="Cynthia", last_name="Wanjiru"))
    db_session.commit()

    response = client.get(f"/schools/{school.id}/dashboard/summary", headers=auth_headers(school_admin_token))
    assert response.status_code == 200
    body = response.json()
    assert body["classes_marked_today"] == 0
    assert len(body["pending_registers"]) == 1
    assert body["pending_registers"][0]["class_name"] == "Grade 7 Kerio"
    assert body["pending_registers"][0]["student_count"] == 1


def test_teacher_cannot_view_dashboard_summary(client, teacher_token, school):
    response = client.get(f"/schools/{school.id}/dashboard/summary", headers=auth_headers(teacher_token))
    assert response.status_code == 403


def test_cannot_view_another_schools_dashboard(client, school_admin_token, other_school):
    response = client.get(f"/schools/{other_school.id}/dashboard/summary", headers=auth_headers(school_admin_token))
    assert response.status_code == 403
