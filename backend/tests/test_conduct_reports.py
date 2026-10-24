"""A teacher files a misconduct report for a student they teach; it's
visible to school leadership, the reporting teacher, the student, and
their guardian — never to an unrelated teacher or another family."""

from app.core.security import hash_password
from app.models.academics import SchoolClass, Student
from app.models.user import User, UserRole
from tests.conftest import auth_headers


def _setup(db_session, school):
    teacher = User(school_id=school.id, email="conductteacher@test-academy.test", full_name="Class Teacher", hashed_password=hash_password("TestPass123!"), role=UserRole.TEACHER)
    other_teacher = User(school_id=school.id, email="otherteacher@test-academy.test", full_name="Other Teacher", hashed_password=hash_password("TestPass123!"), role=UserRole.TEACHER)
    db_session.add_all([teacher, other_teacher])
    db_session.flush()
    cls = SchoolClass(school_id=school.id, name="Grade 5A", homeroom_teacher_id=teacher.id)
    db_session.add(cls)
    db_session.flush()
    guardian = User(school_id=school.id, email="conductparent@test-academy.test", full_name="A Parent", hashed_password=hash_password("TestPass123!"), role=UserRole.PARENT)
    student_user = User(school_id=school.id, email="conductstudent@test-academy.test", full_name="A Kid", hashed_password=hash_password("TestPass123!"), role=UserRole.STUDENT)
    db_session.add_all([guardian, student_user])
    db_session.flush()
    student = Student(
        school_id=school.id, class_id=cls.id, admission_number="CR-001", first_name="A", last_name="Kid",
        guardian_user_id=guardian.id, user_id=student_user.id,
    )
    db_session.add(student)
    db_session.commit()
    return teacher, other_teacher, guardian, student_user, student


def _login(client, user):
    r = client.post("/auth/login", data={"username": user.email, "password": "TestPass123!"})
    return auth_headers(r.json()["access_token"])


def test_teacher_can_report_a_student_they_teach(client, db_session, school):
    teacher, _other, _guardian, _student_user, student = _setup(db_session, school)
    headers = _login(client, teacher)

    r = client.post(
        f"/schools/{school.id}/conduct-reports",
        headers=headers,
        json={"student_id": student.id, "category": "disruption", "description": "Talked back repeatedly in class", "incident_date": "2026-10-20"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "open"
    assert r.json()["student_name"] == "A Kid"


def test_teacher_cannot_report_a_student_they_do_not_teach(client, db_session, school):
    _teacher, other_teacher, _guardian, _student_user, student = _setup(db_session, school)
    headers = _login(client, other_teacher)

    r = client.post(
        f"/schools/{school.id}/conduct-reports",
        headers=headers,
        json={"student_id": student.id, "category": "disruption", "description": "Not my class", "incident_date": "2026-10-20"},
    )
    assert r.status_code == 403


def test_student_and_parent_see_their_own_report(client, db_session, school):
    teacher, _other, guardian, student_user, student = _setup(db_session, school)
    teacher_headers = _login(client, teacher)
    client.post(
        f"/schools/{school.id}/conduct-reports",
        headers=teacher_headers,
        json={"student_id": student.id, "category": "bullying", "description": "Pushed a classmate", "incident_date": "2026-10-20"},
    )

    student_listing = client.get(f"/schools/{school.id}/conduct-reports", headers=_login(client, student_user))
    assert student_listing.status_code == 200
    assert len(student_listing.json()) == 1

    parent_listing = client.get(f"/schools/{school.id}/conduct-reports", headers=_login(client, guardian))
    assert parent_listing.status_code == 200
    assert len(parent_listing.json()) == 1


def test_unrelated_student_cannot_see_someone_elses_report(client, db_session, school):
    teacher, _other, _guardian, _student_user, student = _setup(db_session, school)
    teacher_headers = _login(client, teacher)
    client.post(
        f"/schools/{school.id}/conduct-reports",
        headers=teacher_headers,
        json={"student_id": student.id, "category": "bullying", "description": "Pushed a classmate", "incident_date": "2026-10-20"},
    )

    unrelated_student = User(school_id=school.id, email="unrelated@test-academy.test", full_name="Unrelated Kid", hashed_password=hash_password("TestPass123!"), role=UserRole.STUDENT)
    db_session.add(unrelated_student)
    db_session.flush()
    db_session.add(Student(school_id=school.id, admission_number="CR-002", first_name="Un", last_name="Related", user_id=unrelated_student.id))
    db_session.commit()

    listing = client.get(f"/schools/{school.id}/conduct-reports", headers=_login(client, unrelated_student))
    assert listing.status_code == 200
    assert listing.json() == []


def test_head_of_institution_sees_everything_and_can_respond(client, db_session, school, school_admin_token):
    teacher, _other, _guardian, _student_user, student = _setup(db_session, school)
    teacher_headers = _login(client, teacher)
    client.post(
        f"/schools/{school.id}/conduct-reports",
        headers=teacher_headers,
        json={"student_id": student.id, "category": "fighting", "description": "Got into a fight at break", "incident_date": "2026-10-20"},
    )

    admin_headers = auth_headers(school_admin_token)
    listing = client.get(f"/schools/{school.id}/conduct-reports", headers=admin_headers)
    assert listing.status_code == 200
    assert len(listing.json()) == 1
    report_id = listing.json()[0]["id"]

    resp = client.post(f"/schools/{school.id}/conduct-reports/{report_id}/respond", headers=admin_headers, json={"response": "Both students given a warning"})
    assert resp.status_code == 200
    assert resp.json()["status"] == "reviewed"


def test_teacher_cannot_respond_to_a_report(client, db_session, school):
    teacher, _other, _guardian, _student_user, student = _setup(db_session, school)
    teacher_headers = _login(client, teacher)
    created = client.post(
        f"/schools/{school.id}/conduct-reports",
        headers=teacher_headers,
        json={"student_id": student.id, "category": "other", "description": "Misc", "incident_date": "2026-10-20"},
    )
    report_id = created.json()["id"]

    resp = client.post(f"/schools/{school.id}/conduct-reports/{report_id}/respond", headers=teacher_headers, json={"response": "nope"})
    assert resp.status_code == 403
