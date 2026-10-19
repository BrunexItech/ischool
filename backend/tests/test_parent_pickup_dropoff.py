"""A parent can self-report picking up or dropping off their own child —
one tap, no form to fill: who and when are always set by the server from
their own session, never typed in."""

from app.core.security import hash_password
from app.models.academics import SchoolClass, Student
from app.models.user import User, UserRole
from tests.conftest import auth_headers


def _setup(db_session, school):
    cls = SchoolClass(school_id=school.id, name="Grade 2B")
    db_session.add(cls)
    db_session.flush()
    guardian = User(
        school_id=school.id, email="pickup.parent@test-academy.test", full_name="Pickup Parent",
        hashed_password=hash_password("TestPass123!"), role=UserRole.PARENT,
    )
    other_guardian = User(
        school_id=school.id, email="other.parent@test-academy.test", full_name="Other Parent",
        hashed_password=hash_password("TestPass123!"), role=UserRole.PARENT,
    )
    db_session.add_all([guardian, other_guardian])
    db_session.flush()
    student = Student(
        school_id=school.id, class_id=cls.id, admission_number="PD-001",
        first_name="My", last_name="Child", guardian_user_id=guardian.id,
    )
    db_session.add(student)
    db_session.commit()
    return guardian, other_guardian, student


def _login(client, user):
    response = client.post("/auth/login", data={"username": user.email, "password": "TestPass123!"})
    return auth_headers(response.json()["access_token"])


def test_parent_can_report_pickup(client, db_session, school):
    guardian, _, student = _setup(db_session, school)
    headers = _login(client, guardian)

    response = client.post(
        f"/portal/students/{student.id}/pickup-dropoff",
        headers=headers,
        json={"event_type": "pickup"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["event_type"] == "pickup"
    assert body["person_name"] == "Pickup Parent"
    assert body["occurred_at"] is not None


def test_parent_report_shows_up_in_the_log(client, db_session, school):
    guardian, _, student = _setup(db_session, school)
    headers = _login(client, guardian)

    client.post(f"/portal/students/{student.id}/pickup-dropoff", headers=headers, json={"event_type": "dropoff", "notes": "Dropped at gate"})
    listing = client.get(f"/portal/students/{student.id}/pickup-dropoff", headers=headers)
    assert listing.status_code == 200
    assert len(listing.json()) == 1
    assert listing.json()[0]["notes"] == "Dropped at gate"


def test_parent_cannot_report_for_a_child_not_theirs(client, db_session, school):
    _, other_guardian, student = _setup(db_session, school)
    headers = _login(client, other_guardian)

    response = client.post(
        f"/portal/students/{student.id}/pickup-dropoff",
        headers=headers,
        json={"event_type": "pickup"},
    )
    assert response.status_code == 404
