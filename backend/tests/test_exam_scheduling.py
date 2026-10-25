"""An exam can carry a scheduled opens_at/closes_at window (a student can't
start outside it) and/or a teacher-uploaded PDF paper in place of online
questions (no online start at all — it's a download, graded via Results)."""

from datetime import datetime, timedelta, timezone
from io import BytesIO

from app.core.security import hash_password
from app.models.academics import SchoolClass, Student
from app.models.exam import Exam
from app.models.results import Subject
from app.models.user import User, UserRole
from tests.conftest import auth_headers


def _make_exam_and_student(db_session, school, **exam_kwargs):
    subject = Subject(school_id=school.id, name="Science")
    cls = SchoolClass(school_id=school.id, name="Form 2A")
    db_session.add_all([subject, cls])
    db_session.flush()

    student_user = User(
        school_id=school.id, email="sched.student@test-academy.test", full_name="Sched Student",
        hashed_password=hash_password("TestPass123!"), role=UserRole.STUDENT,
    )
    db_session.add(student_user)
    db_session.flush()
    student = Student(school_id=school.id, class_id=cls.id, admission_number="SCH-1", first_name="Sched", last_name="Student", user_id=student_user.id)
    db_session.add(student)
    db_session.flush()

    exam = Exam(
        school_id=school.id, subject_id=subject.id, class_id=cls.id, title="Scheduled Exam",
        term="Term 1 2026", duration_minutes=30, is_published=True, **exam_kwargs,
    )
    db_session.add(exam)
    db_session.commit()
    return exam, student, student_user


def _student_headers(client, student_user):
    response = client.post("/auth/login", data={"username": student_user.email, "password": "TestPass123!"})
    return auth_headers(response.json()["access_token"])


def test_student_cannot_start_an_exam_before_it_opens(client, db_session, school):
    future = datetime.now(timezone.utc) + timedelta(hours=1)
    exam, student, student_user = _make_exam_and_student(db_session, school, opens_at=future)

    response = client.post(f"/portal/students/{student.id}/exams/{exam.id}/start", headers=_student_headers(client, student_user))
    assert response.status_code == 400
    assert "opens at" in response.json()["detail"]


def test_student_cannot_start_an_exam_after_it_closes(client, db_session, school):
    past = datetime.now(timezone.utc) - timedelta(hours=1)
    exam, student, student_user = _make_exam_and_student(db_session, school, closes_at=past)

    response = client.post(f"/portal/students/{student.id}/exams/{exam.id}/start", headers=_student_headers(client, student_user))
    assert response.status_code == 400
    assert "closed" in response.json()["detail"]


def test_student_can_start_within_the_window(client, db_session, school):
    opens = datetime.now(timezone.utc) - timedelta(minutes=5)
    closes = datetime.now(timezone.utc) + timedelta(hours=1)
    exam, student, student_user = _make_exam_and_student(db_session, school, opens_at=opens, closes_at=closes)

    response = client.post(f"/portal/students/{student.id}/exams/{exam.id}/start", headers=_student_headers(client, student_user))
    assert response.status_code == 200


def test_paper_exam_cannot_be_started_online(client, db_session, school):
    exam, student, student_user = _make_exam_and_student(db_session, school, paper_file_url="http://example.test/paper.pdf")

    response = client.post(f"/portal/students/{student.id}/exams/{exam.id}/start", headers=_student_headers(client, student_user))
    assert response.status_code == 400
    assert "downloadable paper" in response.json()["detail"]


def test_teacher_can_upload_a_pdf_as_the_exam_paper(client, db_session, school, teacher_token):
    exam, student, _ = _make_exam_and_student(db_session, school)

    pdf_bytes = b"%PDF-1.4 fake pdf content"
    response = client.post(
        f"/schools/{school.id}/exams/{exam.id}/paper",
        headers=auth_headers(teacher_token),
        files={"file": ("paper.pdf", BytesIO(pdf_bytes), "application/pdf")},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["paper_file_url"] is not None
    assert body["paper_file_url"].endswith(".pdf")


def test_uploading_a_non_pdf_as_exam_paper_is_rejected(client, db_session, school, teacher_token):
    exam, student, _ = _make_exam_and_student(db_session, school)

    response = client.post(
        f"/schools/{school.id}/exams/{exam.id}/paper",
        headers=auth_headers(teacher_token),
        files={"file": ("paper.txt", BytesIO(b"not a pdf"), "text/plain")},
    )
    assert response.status_code == 400


def test_exam_can_be_created_with_zero_questions_for_a_paper_exam(client, teacher_token, school, db_session):
    subject = Subject(school_id=school.id, name="History")
    db_session.add(subject)
    db_session.commit()

    response = client.post(
        f"/schools/{school.id}/exams",
        headers=auth_headers(teacher_token),
        json={"subject_id": subject.id, "title": "Paper Exam", "term": "Term 1 2026", "duration_minutes": 60, "questions": []},
    )
    assert response.status_code == 201, response.text
    assert response.json()["question_count"] == 0


def test_exam_window_must_be_logically_ordered(client, teacher_token, school, db_session):
    subject = Subject(school_id=school.id, name="Geography")
    db_session.add(subject)
    db_session.commit()

    now = datetime.now(timezone.utc)
    response = client.post(
        f"/schools/{school.id}/exams",
        headers=auth_headers(teacher_token),
        json={
            "subject_id": subject.id,
            "title": "Bad Window Exam",
            "term": "Term 1 2026",
            "duration_minutes": 60,
            "opens_at": (now + timedelta(hours=2)).isoformat(),
            "closes_at": (now + timedelta(hours=1)).isoformat(),
            "questions": [],
        },
    )
    assert response.status_code == 422


def test_head_of_institution_cannot_create_an_exam(client, school_admin_token, school, db_session):
    subject = Subject(school_id=school.id, name="Civics")
    db_session.add(subject)
    db_session.commit()

    response = client.post(
        f"/schools/{school.id}/exams",
        headers=auth_headers(school_admin_token),
        json={"subject_id": subject.id, "title": "Civics Exam", "term": "Term 1 2026", "duration_minutes": 60, "questions": []},
    )
    assert response.status_code == 403
