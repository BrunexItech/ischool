"""A supervisor account: created by the super-admin, linked to an arbitrary
set of schools (not a parent/branch hierarchy), can view the named domains
(students, staff, attendance, activities) in any linked school, and can
register staff there — but nothing outside their links."""

from app.models.academics import SchoolClass, Student
from app.models.school import School
from tests.conftest import _login, auth_headers


def test_super_admin_can_create_a_supervisor_and_link_schools(client, super_admin_token, school, other_school):
    headers = auth_headers(super_admin_token)
    created = client.post(
        "/supervisors", headers=headers,
        json={"email": "super.visor@test-academy.test", "full_name": "Super Visor", "password": "SuperVisorPass123!"},
    )
    assert created.status_code == 201, created.text
    supervisor_id = created.json()["id"]

    linked = client.post(f"/supervisors/{supervisor_id}/schools", headers=headers, json={"school_id": school.id})
    assert linked.status_code == 200
    assert linked.json()["schools"] == [{"id": school.id, "name": school.name}]

    linked2 = client.post(f"/supervisors/{supervisor_id}/schools", headers=headers, json={"school_id": other_school.id})
    assert len(linked2.json()["schools"]) == 2


def test_supervisor_sees_only_linked_schools_in_their_switcher(client, db_session, super_admin_token, school, other_school):
    headers = auth_headers(super_admin_token)
    created = client.post(
        "/supervisors", headers=headers,
        json={"email": "s2@test-academy.test", "full_name": "S2", "password": "SuperVisorPass123!"},
    ).json()
    client.post(f"/supervisors/{created['id']}/schools", headers=headers, json={"school_id": school.id})

    token = _login(client, "s2@test-academy.test", "SuperVisorPass123!")
    response = client.get("/supervisor/schools", headers=auth_headers(token))
    assert response.status_code == 200
    assert [s["id"] for s in response.json()] == [school.id]


def test_supervisor_can_view_students_and_staff_in_a_linked_school(client, db_session, super_admin_token, school):
    headers = auth_headers(super_admin_token)
    created = client.post(
        "/supervisors", headers=headers,
        json={"email": "s3@test-academy.test", "full_name": "S3", "password": "SuperVisorPass123!"},
    ).json()
    client.post(f"/supervisors/{created['id']}/schools", headers=headers, json={"school_id": school.id})

    cls = SchoolClass(school_id=school.id, name="Grade 1A")
    db_session.add(cls)
    db_session.flush()
    db_session.add(Student(school_id=school.id, class_id=cls.id, admission_number="SV-001", first_name="A", last_name="B"))
    db_session.commit()

    token = _login(client, "s3@test-academy.test", "SuperVisorPass123!")
    students = client.get(f"/schools/{school.id}/students", headers=auth_headers(token))
    assert students.status_code == 200
    assert len(students.json()) == 1

    staff = client.get(f"/schools/{school.id}/staff", headers=auth_headers(token))
    assert staff.status_code == 200


def test_supervisor_can_register_staff_in_a_linked_school(client, db_session, super_admin_token, school):
    headers = auth_headers(super_admin_token)
    created = client.post(
        "/supervisors", headers=headers,
        json={"email": "s4@test-academy.test", "full_name": "S4", "password": "SuperVisorPass123!"},
    ).json()
    client.post(f"/supervisors/{created['id']}/schools", headers=headers, json={"school_id": school.id})

    token = _login(client, "s4@test-academy.test", "SuperVisorPass123!")
    response = client.post(
        f"/schools/{school.id}/staff", headers=auth_headers(token),
        json={"email": "new.teacher@test-academy.test", "full_name": "New Teacher", "password": "TeacherPass123!", "role": "teacher", "staff_number": "T-900"},
    )
    assert response.status_code == 201, response.text


def test_supervisor_cannot_touch_an_unlinked_school(client, db_session, super_admin_token, school, other_school):
    headers = auth_headers(super_admin_token)
    created = client.post(
        "/supervisors", headers=headers,
        json={"email": "s5@test-academy.test", "full_name": "S5", "password": "SuperVisorPass123!"},
    ).json()
    client.post(f"/supervisors/{created['id']}/schools", headers=headers, json={"school_id": school.id})

    token = _login(client, "s5@test-academy.test", "SuperVisorPass123!")
    response = client.get(f"/schools/{other_school.id}/students", headers=auth_headers(token))
    assert response.status_code == 403


def test_supervisor_overview_aggregates_linked_schools(client, db_session, super_admin_token, school, other_school):
    headers = auth_headers(super_admin_token)
    created = client.post(
        "/supervisors", headers=headers,
        json={"email": "s6@test-academy.test", "full_name": "S6", "password": "SuperVisorPass123!"},
    ).json()
    client.post(f"/supervisors/{created['id']}/schools", headers=headers, json={"school_id": school.id})
    client.post(f"/supervisors/{created['id']}/schools", headers=headers, json={"school_id": other_school.id})

    token = _login(client, "s6@test-academy.test", "SuperVisorPass123!")
    response = client.get("/supervisor/overview", headers=auth_headers(token))
    assert response.status_code == 200
    assert len(response.json()["schools"]) == 2


def test_non_super_admin_cannot_create_supervisors(client, school_admin_token):
    response = client.post(
        "/supervisors", headers=auth_headers(school_admin_token),
        json={"email": "nope@test-academy.test", "full_name": "Nope", "password": "SuperVisorPass123!"},
    )
    assert response.status_code == 403
