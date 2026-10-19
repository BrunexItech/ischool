"""Homework: a teacher posts it for their class/subject, students can
optionally submit a photo digitally, and either way the teacher marks each
student's status — covers whether digital submission was allowed or not."""

import io

from app.core.security import hash_password
from app.models.academics import SchoolClass, Student
from app.models.results import Subject
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import User, UserRole
from tests.conftest import auth_headers


def _setup(db_session, school, allow_digital=True):
    subject = Subject(school_id=school.id, name="English")
    cls = SchoolClass(school_id=school.id, name="Grade 4B")
    db_session.add_all([subject, cls])
    db_session.flush()

    teacher = User(
        school_id=school.id, email="hw.teacher@test-academy.test", full_name="HW Teacher",
        hashed_password=hash_password("TestPass123!"), role=UserRole.TEACHER,
    )
    db_session.add(teacher)
    db_session.flush()
    db_session.add(TeacherAssignment(school_id=school.id, teacher_user_id=teacher.id, class_id=cls.id, subject_id=subject.id))

    student_user = User(
        school_id=school.id, email="hw.student@test-academy.test", full_name="HW Student",
        hashed_password=hash_password("TestPass123!"), role=UserRole.STUDENT,
    )
    db_session.add(student_user)
    db_session.flush()
    student = Student(school_id=school.id, class_id=cls.id, admission_number="HW-1", first_name="Homework", last_name="Student", user_id=student_user.id)
    db_session.add(student)
    db_session.commit()
    return cls, subject, teacher, student, student_user


def _login(client, user):
    response = client.post("/auth/login", data={"username": user.email, "password": "TestPass123!"})
    return auth_headers(response.json()["access_token"])


def test_teacher_can_post_homework_for_their_class(client, db_session, school):
    cls, subject, teacher, student, student_user = _setup(db_session, school)
    headers = _login(client, teacher)

    response = client.post(
        f"/schools/{school.id}/homework",
        headers=headers,
        json={"class_id": cls.id, "subject_id": subject.id, "title": "Read Ch.3", "due_date": "2026-11-01"},
    )
    assert response.status_code == 201, response.text
    assert response.json()["total_students"] == 1
    assert response.json()["submitted_count"] == 0


def test_roster_shows_not_submitted_for_everyone_by_default(client, db_session, school):
    cls, subject, teacher, student, student_user = _setup(db_session, school)
    headers = _login(client, teacher)
    hw_id = client.post(
        f"/schools/{school.id}/homework",
        headers=headers,
        json={"class_id": cls.id, "subject_id": subject.id, "title": "Worksheet 2", "due_date": "2026-11-05"},
    ).json()["id"]

    roster = client.get(f"/schools/{school.id}/homework/{hw_id}", headers=headers).json()
    assert len(roster["submissions"]) == 1
    assert roster["submissions"][0]["status"] == "not_submitted"


def test_teacher_can_mark_submitted_after_checking_the_book(client, db_session, school):
    cls, subject, teacher, student, student_user = _setup(db_session, school)
    headers = _login(client, teacher)
    hw_id = client.post(
        f"/schools/{school.id}/homework",
        headers=headers,
        json={"class_id": cls.id, "subject_id": subject.id, "title": "Times tables", "due_date": "2026-11-05", "allow_digital_submission": False},
    ).json()["id"]

    review = client.patch(
        f"/schools/{school.id}/homework/{hw_id}/submissions/{student.id}",
        headers=headers,
        json={"status": "reviewed", "score": 8, "teacher_comment": "Good work"},
    )
    assert review.status_code == 200
    assert review.json()["status"] == "reviewed"
    assert review.json()["score"] == 8


def test_student_can_submit_digitally_when_allowed(client, db_session, school):
    cls, subject, teacher, student, student_user = _setup(db_session, school)
    teacher_headers = _login(client, teacher)
    hw_id = client.post(
        f"/schools/{school.id}/homework",
        headers=teacher_headers,
        json={"class_id": cls.id, "subject_id": subject.id, "title": "Essay", "due_date": "2026-11-10", "allow_digital_submission": True},
    ).json()["id"]

    student_headers = _login(client, student_user)
    fake_image = io.BytesIO(b"\x89PNG\r\n\x1a\nfakepngcontent")
    response = client.post(
        f"/portal/students/{student.id}/homework/{hw_id}/submit",
        headers=student_headers,
        files={"file": ("essay.png", fake_image, "image/png")},
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "submitted"
    assert response.json()["file_url"]


def test_student_cannot_submit_digitally_when_not_allowed(client, db_session, school):
    cls, subject, teacher, student, student_user = _setup(db_session, school)
    teacher_headers = _login(client, teacher)
    hw_id = client.post(
        f"/schools/{school.id}/homework",
        headers=teacher_headers,
        json={"class_id": cls.id, "subject_id": subject.id, "title": "Spelling", "due_date": "2026-11-10", "allow_digital_submission": False},
    ).json()["id"]

    student_headers = _login(client, student_user)
    fake_image = io.BytesIO(b"\x89PNG\r\n\x1a\nfakepngcontent")
    response = client.post(
        f"/portal/students/{student.id}/homework/{hw_id}/submit",
        headers=student_headers,
        files={"file": ("spelling.png", fake_image, "image/png")},
    )
    assert response.status_code == 400


def test_student_sees_their_own_homework_list(client, db_session, school):
    cls, subject, teacher, student, student_user = _setup(db_session, school)
    teacher_headers = _login(client, teacher)
    client.post(
        f"/schools/{school.id}/homework",
        headers=teacher_headers,
        json={"class_id": cls.id, "subject_id": subject.id, "title": "Project", "due_date": "2026-11-15"},
    )

    student_headers = _login(client, student_user)
    response = client.get(f"/portal/students/{student.id}/homework", headers=student_headers)
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["title"] == "Project"
    assert response.json()[0]["status"] == "not_submitted"


def test_unassigned_teacher_cannot_post_homework_for_a_class_they_do_not_teach(client, db_session, school):
    cls = SchoolClass(school_id=school.id, name="Grade 5C")
    subject = Subject(school_id=school.id, name="Science")
    db_session.add_all([cls, subject])
    db_session.flush()
    teacher = User(
        school_id=school.id, email="unassigned.hw@test-academy.test", full_name="Unassigned",
        hashed_password=hash_password("TestPass123!"), role=UserRole.TEACHER,
    )
    db_session.add(teacher)
    db_session.commit()
    headers = _login(client, teacher)

    response = client.post(
        f"/schools/{school.id}/homework",
        headers=headers,
        json={"class_id": cls.id, "subject_id": subject.id, "title": "Nope", "due_date": "2026-11-20"},
    )
    assert response.status_code == 403
