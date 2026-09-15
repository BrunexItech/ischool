"""An award belongs to exactly one recipient — a student XOR a staff
member — enforced both by a Pydantic validator (fast, friendly error) and
a DB check constraint (the real guarantee, in case anything ever bypasses
the API layer)."""

from datetime import date

from tests.conftest import auth_headers


def test_award_needs_exactly_one_recipient(client, school_admin_token, school):
    response = client.post(
        f"/schools/{school.id}/awards",
        headers=auth_headers(school_admin_token),
        json={"title": "Nobody", "date_awarded": str(date.today())},
    )
    assert response.status_code == 422


def test_award_rejects_both_recipients_at_once(client, school_admin_token, school):
    response = client.post(
        f"/schools/{school.id}/awards",
        headers=auth_headers(school_admin_token),
        json={"student_id": 1, "staff_user_id": 1, "title": "Both", "date_awarded": str(date.today())},
    )
    assert response.status_code == 422


def test_award_for_a_student_from_another_school_is_rejected(client, school_admin_token, school, other_school, db_session):
    from app.models.academics import Student

    intruder = Student(school_id=other_school.id, admission_number="RIV-1", first_name="Not", last_name="Ours")
    db_session.add(intruder)
    db_session.commit()

    response = client.post(
        f"/schools/{school.id}/awards",
        headers=auth_headers(school_admin_token),
        json={"student_id": intruder.id, "title": "Cross-tenant award", "date_awarded": str(date.today())},
    )
    assert response.status_code == 400
