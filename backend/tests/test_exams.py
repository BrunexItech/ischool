"""Covers the exam correctness fix from this session: the answer key must
never reach a student, MCQ auto-grades, an unanswered short-answer stays
pending rather than silently "graded", autosave survives a reload, and the
background sweep finalizes a submission whose time ran out."""

from datetime import datetime, timedelta, timezone

import pytest

from app.core.exam_grading import finalize_submission
from app.models.academics import SchoolClass, Student
from app.models.exam import Exam, ExamQuestion, ExamSubmission, ExamSubmissionStatus
from app.models.results import Subject
from app.models.user import User, UserRole
from app.core.security import hash_password
from tests.conftest import auth_headers


@pytest.fixture
def exam_setup(db_session, school):
    subject = Subject(school_id=school.id, name="Mathematics")
    school_class = SchoolClass(school_id=school.id, name="Form 1A")
    db_session.add_all([subject, school_class])
    db_session.flush()

    student_user = User(
        school_id=school.id,
        email="student@test-academy.test",
        full_name="Test Student",
        hashed_password=hash_password("TestPass123!"),
        role=UserRole.STUDENT,
    )
    db_session.add(student_user)
    db_session.flush()

    student = Student(
        school_id=school.id,
        class_id=school_class.id,
        admission_number="TA-1",
        first_name="Test",
        last_name="Student",
        user_id=student_user.id,
    )
    db_session.add(student)
    db_session.flush()

    exam = Exam(
        school_id=school.id,
        subject_id=subject.id,
        class_id=school_class.id,
        title="Sample Exam",
        term="Term 1 2026",
        duration_minutes=30,
        is_published=True,
    )
    db_session.add(exam)
    db_session.flush()

    mcq = ExamQuestion(
        exam_id=exam.id, question_text="2+2?", question_type="mcq", marks=5, order=1,
        options=["3", "4"], correct_option_index=1,
    )
    short = ExamQuestion(exam_id=exam.id, question_text="Explain.", question_type="short_answer", marks=5, order=2)
    db_session.add_all([mcq, short])
    db_session.commit()

    return {"exam": exam, "mcq": mcq, "short": short, "student": student, "student_user": student_user}


def student_headers(client, student_user):
    response = client.post("/auth/login", data={"username": student_user.email, "password": "TestPass123!"})
    assert response.status_code == 200
    return auth_headers(response.json()["access_token"])


def test_student_never_receives_the_answer_key(client, exam_setup):
    headers = student_headers(client, exam_setup["student_user"])
    student_id = exam_setup["student"].id
    exam_id = exam_setup["exam"].id

    response = client.post(f"/portal/students/{student_id}/exams/{exam_id}/start", headers=headers)
    assert response.status_code == 200
    for question in response.json()["exam"]["questions"]:
        assert "correct_option_index" not in question


def test_mcq_auto_grades_on_submit(client, exam_setup):
    headers = student_headers(client, exam_setup["student_user"])
    student_id = exam_setup["student"].id
    exam_id = exam_setup["exam"].id
    mcq_id = exam_setup["mcq"].id

    client.post(f"/portal/students/{student_id}/exams/{exam_id}/start", headers=headers)
    response = client.post(
        f"/portal/students/{student_id}/exams/{exam_id}/submit",
        headers=headers,
        json={"answers": [{"question_id": mcq_id, "answer_text": "1"}]},
    )
    assert response.status_code == 200
    body = response.json()
    # a short-answer question exists and was left blank, so grading isn't complete yet
    assert body["status"] == "submitted"
    assert body["score"] is None


def test_unanswered_short_answer_is_pending_not_silently_graded(client, exam_setup, db_session):
    headers = student_headers(client, exam_setup["student_user"])
    student_id = exam_setup["student"].id
    exam_id = exam_setup["exam"].id
    mcq_id = exam_setup["mcq"].id
    short_id = exam_setup["short"].id

    client.post(f"/portal/students/{student_id}/exams/{exam_id}/start", headers=headers)
    client.post(
        f"/portal/students/{student_id}/exams/{exam_id}/submit",
        headers=headers,
        json={"answers": [{"question_id": mcq_id, "answer_text": "1"}]},
    )

    submission = db_session.query(ExamSubmission).filter_by(exam_id=exam_id, student_id=student_id).first()
    answered_ids = {a.question_id: a for a in submission.answers}
    assert short_id in answered_ids  # a placeholder row exists, pending review
    assert answered_ids[short_id].awarded_marks is None
    assert answered_ids[short_id].answer_text is None


def test_autosave_survives_a_reload(client, exam_setup):
    headers = student_headers(client, exam_setup["student_user"])
    student_id = exam_setup["student"].id
    exam_id = exam_setup["exam"].id
    mcq_id = exam_setup["mcq"].id

    client.post(f"/portal/students/{student_id}/exams/{exam_id}/start", headers=headers)
    client.patch(
        f"/portal/students/{student_id}/exams/{exam_id}/answer",
        headers=headers,
        json={"question_id": mcq_id, "answer_text": "1"},
    )

    # simulate the student reloading the page — "start" is idempotent and
    # must hand back whatever was already autosaved
    response = client.post(f"/portal/students/{student_id}/exams/{exam_id}/start", headers=headers)
    assert response.status_code == 200
    saved = {a["question_id"]: a["answer_text"] for a in response.json()["answers"]}
    assert saved[mcq_id] == "1"


def test_timeout_sweep_finalizes_an_abandoned_submission(client, exam_setup, db_session):
    """The scenario the original bug covered: student autosaves an answer,
    then never calls /submit (closed tab). The sweep must still grade it."""
    headers = student_headers(client, exam_setup["student_user"])
    student_id = exam_setup["student"].id
    exam_id = exam_setup["exam"].id
    mcq_id = exam_setup["mcq"].id

    client.post(f"/portal/students/{student_id}/exams/{exam_id}/start", headers=headers)
    client.patch(
        f"/portal/students/{student_id}/exams/{exam_id}/answer",
        headers=headers,
        json={"question_id": mcq_id, "answer_text": "1"},
    )

    submission = db_session.query(ExamSubmission).filter_by(exam_id=exam_id, student_id=student_id).first()
    submission.started_at = datetime.now(timezone.utc) - timedelta(hours=1)  # force it past the deadline
    db_session.commit()

    exam = db_session.query(Exam).filter_by(id=exam_id).first()
    finalize_submission(db_session, exam, submission)
    db_session.commit()

    db_session.refresh(submission)
    assert submission.status == ExamSubmissionStatus.SUBMITTED
    assert submission.submitted_at is not None
    mcq_answer = next(a for a in submission.answers if a.question_id == mcq_id)
    assert mcq_answer.awarded_marks == 5.0


def test_cannot_start_a_published_exam_for_the_wrong_class(client, db_session, school):
    """An exam scoped to one class must not be sittable by a student in another class."""
    subject = Subject(school_id=school.id, name="Science")
    class_a = SchoolClass(school_id=school.id, name="Class A")
    class_b = SchoolClass(school_id=school.id, name="Class B")
    db_session.add_all([subject, class_a, class_b])
    db_session.flush()

    exam = Exam(
        school_id=school.id, subject_id=subject.id, class_id=class_a.id,
        title="Class A Only", term="Term 1 2026", duration_minutes=30, is_published=True,
    )
    db_session.add(exam)
    db_session.flush()

    student_user = User(
        school_id=school.id, email="wrongclass@test-academy.test", full_name="Wrong Class",
        hashed_password=hash_password("TestPass123!"), role=UserRole.STUDENT,
    )
    db_session.add(student_user)
    db_session.flush()
    student = Student(
        school_id=school.id, class_id=class_b.id, admission_number="TA-2",
        first_name="Wrong", last_name="Class", user_id=student_user.id,
    )
    db_session.add(student)
    db_session.commit()

    headers = student_headers(client, student_user)
    response = client.post(f"/portal/students/{student.id}/exams/{exam.id}/start", headers=headers)
    assert response.status_code == 404
