from app.core.security import hash_password
from app.models.academics import SchoolClass, Student
from app.models.user import User, UserRole
from tests.conftest import auth_headers


def _setup(db_session, school):
    teacher = User(school_id=school.id, email="classteacher@test-academy.test", full_name="Class Teacher", hashed_password=hash_password("TestPass123!"), role=UserRole.TEACHER)
    db_session.add(teacher)
    db_session.flush()
    cls = SchoolClass(school_id=school.id, name="Grade 3A", homeroom_teacher_id=teacher.id)
    db_session.add(cls)
    db_session.flush()
    guardian = User(school_id=school.id, email="complainparent@test-academy.test", full_name="A Parent", hashed_password=hash_password("TestPass123!"), role=UserRole.PARENT)
    db_session.add(guardian)
    db_session.flush()
    student = Student(school_id=school.id, class_id=cls.id, admission_number="CP-001", first_name="A", last_name="Kid", guardian_user_id=guardian.id)
    db_session.add(student)
    db_session.commit()
    return teacher, guardian, student


def _login(client, user):
    r = client.post("/auth/login", data={"username": user.email, "password": "TestPass123!"})
    return auth_headers(r.json()["access_token"])


def test_parent_can_raise_complaint_to_class_teacher(client, db_session, school):
    teacher, guardian, student = _setup(db_session, school)
    headers = _login(client, guardian)

    r = client.post(
        f"/schools/{school.id}/complaints",
        headers=headers,
        json={"audience": "class_teacher", "subject": "Bullying", "message": "My child is being bullied", "student_id": student.id},
    )
    assert r.status_code == 201, r.text
    assert r.json()["class_id"] == student.class_id


def test_class_teacher_sees_and_can_respond(client, db_session, school):
    teacher, guardian, student = _setup(db_session, school)
    parent_headers = _login(client, guardian)
    client.post(
        f"/schools/{school.id}/complaints",
        headers=parent_headers,
        json={"audience": "class_teacher", "subject": "Bullying", "message": "My child is being bullied", "student_id": student.id},
    )

    teacher_headers = _login(client, teacher)
    listing = client.get(f"/schools/{school.id}/complaints", headers=teacher_headers)
    assert listing.status_code == 200
    assert len(listing.json()) == 1
    complaint_id = listing.json()[0]["id"]

    resp = client.post(f"/schools/{school.id}/complaints/{complaint_id}/respond", headers=teacher_headers, json={"response": "Looking into it"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "resolved"


def test_other_teacher_cannot_see_or_respond(client, db_session, school):
    teacher, guardian, student = _setup(db_session, school)
    other_teacher = User(school_id=school.id, email="other@test-academy.test", full_name="Other Teacher", hashed_password=hash_password("TestPass123!"), role=UserRole.TEACHER)
    db_session.add(other_teacher)
    db_session.commit()

    parent_headers = _login(client, guardian)
    created = client.post(
        f"/schools/{school.id}/complaints",
        headers=parent_headers,
        json={"audience": "class_teacher", "subject": "Bullying", "message": "Issue", "student_id": student.id},
    ).json()

    other_headers = _login(client, other_teacher)
    listing = client.get(f"/schools/{school.id}/complaints", headers=other_headers)
    assert listing.json() == []

    resp = client.post(f"/schools/{school.id}/complaints/{created['id']}/respond", headers=other_headers, json={"response": "x"})
    assert resp.status_code == 403


def test_admin_sees_all_complaints(client, db_session, school, school_admin_token):
    teacher, guardian, student = _setup(db_session, school)
    parent_headers = _login(client, guardian)
    client.post(
        f"/schools/{school.id}/complaints",
        headers=parent_headers,
        json={"audience": "principal", "subject": "Fees", "message": "Question about fees"},
    )

    listing = client.get(f"/schools/{school.id}/complaints", headers=auth_headers(school_admin_token))
    assert listing.status_code == 200
    assert len(listing.json()) == 1
