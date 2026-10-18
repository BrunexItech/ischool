"""Historical lookups by date range — "what was attendance between these
two dates", "what fees came in last month", "who visited last week" — on
every module that keeps a dated record."""

from datetime import date, timedelta

from app.models.academics import SchoolClass, Student
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.expense import Expense, ExpenseStatus
from app.models.fees import FeeInvoice, FeePayment
from app.models.security import VisitorLog
from tests.conftest import auth_headers

TODAY = date.today()
OLD = TODAY - timedelta(days=40)


def test_attendance_date_range_excludes_records_outside_it(client, db_session, school, school_admin_token):
    cls = SchoolClass(school_id=school.id, name="Grade 3A")
    db_session.add(cls)
    db_session.flush()
    student = Student(school_id=school.id, class_id=cls.id, admission_number="DR-001", first_name="A", last_name="B")
    db_session.add(student)
    db_session.flush()
    db_session.add(AttendanceRecord(school_id=school.id, class_id=cls.id, student_id=student.id, date=TODAY, status=AttendanceStatus.PRESENT))
    db_session.add(AttendanceRecord(school_id=school.id, class_id=cls.id, student_id=student.id, date=OLD, status=AttendanceStatus.ABSENT))
    db_session.commit()

    response = client.get(
        f"/schools/{school.id}/attendance",
        params={"date_from": (TODAY - timedelta(days=3)).isoformat(), "date_to": TODAY.isoformat()},
        headers=auth_headers(school_admin_token),
    )
    assert response.status_code == 200
    dates = [r["date"] for r in response.json()]
    assert TODAY.isoformat() in dates
    assert OLD.isoformat() not in dates


def test_finance_expenses_date_range(client, db_session, school, school_admin_token):
    db_session.add(Expense(school_id=school.id, category="supplies", description="Recent", amount=1000, date=TODAY, status=ExpenseStatus.APPROVED))
    db_session.add(Expense(school_id=school.id, category="supplies", description="Old", amount=2000, date=OLD, status=ExpenseStatus.APPROVED))
    db_session.commit()

    response = client.get(
        f"/schools/{school.id}/finance/expenses",
        params={"date_from": (TODAY - timedelta(days=3)).isoformat()},
        headers=auth_headers(school_admin_token),
    )
    assert response.status_code == 200
    descriptions = [e["description"] for e in response.json()]
    assert "Recent" in descriptions
    assert "Old" not in descriptions


def test_fee_payments_history_date_range(client, db_session, school, school_admin_token):
    student = Student(school_id=school.id, admission_number="DR-002", first_name="C", last_name="D")
    db_session.add(student)
    db_session.flush()
    invoice = FeeInvoice(school_id=school.id, student_id=student.id, term="Term 1", amount_due=10000, amount_paid=5000)
    db_session.add(invoice)
    db_session.flush()
    from datetime import datetime, timezone

    db_session.add(FeePayment(school_id=school.id, invoice_id=invoice.id, amount=3000, method="mpesa", paid_at=datetime.now(timezone.utc)))
    db_session.add(FeePayment(school_id=school.id, invoice_id=invoice.id, amount=2000, method="cash", paid_at=datetime.now(timezone.utc) - timedelta(days=40)))
    db_session.commit()

    response = client.get(
        f"/schools/{school.id}/fees/payments",
        params={"date_from": (TODAY - timedelta(days=3)).isoformat(), "date_to": TODAY.isoformat()},
        headers=auth_headers(school_admin_token),
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["amount"] == 3000.0
    assert body[0]["student_name"] == "C D"


def test_security_visitor_date_range(client, db_session, school, school_admin_token):
    from datetime import datetime, timezone

    db_session.add(VisitorLog(
        school_id=school.id, badge="V-1", name="Recent Visitor", id_number_masked="***1234", phone="0700000000",
        purpose="Meeting", host_name="Admin", signed_in_at=datetime.now(timezone.utc),
    ))
    db_session.add(VisitorLog(
        school_id=school.id, badge="V-2", name="Old Visitor", id_number_masked="***5678", phone="0700000001",
        purpose="Meeting", host_name="Admin", signed_in_at=datetime.now(timezone.utc) - timedelta(days=40),
    ))
    db_session.commit()

    response = client.get(
        f"/schools/{school.id}/security/visitors",
        params={"date_from": (TODAY - timedelta(days=3)).isoformat()},
        headers=auth_headers(school_admin_token),
    )
    assert response.status_code == 200
    names = [v["name"] for v in response.json()]
    assert "Recent Visitor" in names
    assert "Old Visitor" not in names
