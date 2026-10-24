"""PP1/PP2 competency assessment: seeding the official learning areas,
recording a dated competency observation, the observation log, and the
one rule that matters most — a pre-primary report card must never rank
the learner, while every other grade's report card is unaffected."""

from datetime import date

from app.core.report_card import build_report_card
from app.core.security import hash_password
from app.models.academics import SchoolClass, Student
from app.models.competency_assessment import CompetencyAssessment, PerformanceLevel
from app.models.grade_level import GradeLevel
from app.models.results import Result, Subject
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import User, UserRole
from tests.conftest import _login


def _grade(db_session, code):
    return db_session.query(GradeLevel).filter_by(code=code).first()


def _setup_pp1_class(db_session, school):
    grade = _grade(db_session, "PP1")
    cls = SchoolClass(school_id=school.id, name="PP1 Chui", grade_level_id=grade.id)
    db_session.add(cls)
    db_session.flush()
    subject = Subject(school_id=school.id, name="Language Activities")
    db_session.add(subject)
    teacher = User(
        school_id=school.id, email="pp1teacher@test-academy.test", full_name="PP1 Teacher",
        hashed_password=hash_password("TestPass123!"), role=UserRole.TEACHER,
    )
    db_session.add(teacher)
    db_session.flush()
    db_session.add(TeacherAssignment(school_id=school.id, teacher_user_id=teacher.id, class_id=cls.id, subject_id=subject.id))
    student = Student(school_id=school.id, class_id=cls.id, admission_number="PP1-001", first_name="Tiny", last_name="Learner")
    db_session.add(student)
    db_session.commit()
    return cls, subject, teacher, student


def test_seeding_learning_areas_is_idempotent(client, db_session, school, school_admin_token):
    headers = {"Authorization": f"Bearer {school_admin_token}"}
    first = client.post(f"/schools/{school.id}/subjects/seed-pre-primary-learning-areas", headers=headers)
    assert first.status_code == 200
    assert len(first.json()) == 5

    second = client.post(f"/schools/{school.id}/subjects/seed-pre-primary-learning-areas", headers=headers)
    assert second.status_code == 200
    assert len(second.json()) == 5  # no duplicates created


def test_teacher_can_record_a_competency_assessment_for_their_class(client, db_session, school):
    cls, subject, teacher, student = _setup_pp1_class(db_session, school)
    headers = {"Authorization": f"Bearer {_login(client, teacher.email, 'TestPass123!')}"}

    response = client.post(
        f"/schools/{school.id}/competency-assessments",
        headers=headers,
        json={
            "student_id": student.id, "class_id": cls.id, "subject_id": subject.id, "term": "Term 1 2026",
            "strand": "Listening", "sub_strand": "Common greetings", "criterion": "Responds to greetings",
            "performance_level": "meeting_expectation", "assessment_date": str(date.today()),
        },
    )
    assert response.status_code == 201, response.text
    assert response.json()["performance_level"] == "meeting_expectation"


def test_teacher_cannot_record_competency_for_a_class_they_dont_teach(client, db_session, school):
    cls, subject, _teacher, student = _setup_pp1_class(db_session, school)
    other_teacher = User(
        school_id=school.id, email="other@test-academy.test", full_name="Other Teacher",
        hashed_password=hash_password("TestPass123!"), role=UserRole.TEACHER,
    )
    db_session.add(other_teacher)
    db_session.commit()
    headers = {"Authorization": f"Bearer {_login(client, other_teacher.email, 'TestPass123!')}"}

    response = client.post(
        f"/schools/{school.id}/competency-assessments",
        headers=headers,
        json={
            "student_id": student.id, "class_id": cls.id, "subject_id": subject.id, "term": "Term 1 2026",
            "strand": "Listening", "criterion": "Responds to greetings",
            "performance_level": "meeting_expectation", "assessment_date": str(date.today()),
        },
    )
    assert response.status_code == 403


def test_competency_history_is_never_overwritten(client, db_session, school):
    cls, subject, teacher, student = _setup_pp1_class(db_session, school)
    headers = {"Authorization": f"Bearer {_login(client, teacher.email, 'TestPass123!')}"}

    for level in ("approaching_expectation", "meeting_expectation"):
        client.post(
            f"/schools/{school.id}/competency-assessments",
            headers=headers,
            json={
                "student_id": student.id, "class_id": cls.id, "subject_id": subject.id, "term": "Term 1 2026",
                "strand": "Listening", "criterion": "Responds to greetings",
                "performance_level": level, "assessment_date": str(date.today()),
            },
        )
    history = client.get(f"/schools/{school.id}/competency-assessments", headers=headers, params={"student_id": student.id})
    assert history.status_code == 200
    assert len(history.json()) == 2  # both rows kept, not upserted


def test_observation_note_requires_any_class_assignment(client, db_session, school):
    cls, _subject, teacher, student = _setup_pp1_class(db_session, school)
    headers = {"Authorization": f"Bearer {_login(client, teacher.email, 'TestPass123!')}"}

    response = client.post(
        f"/schools/{school.id}/observation-notes",
        headers=headers,
        json={"student_id": student.id, "class_id": cls.id, "note": "Enjoyed story time today", "noted_on": str(date.today())},
    )
    assert response.status_code == 201, response.text

    history = client.get(f"/schools/{school.id}/observation-notes", headers=headers, params={"student_id": student.id})
    assert len(history.json()) == 1


def test_pre_primary_report_card_never_ranks_the_learner(db_session, school):
    cls, subject, _teacher, student = _setup_pp1_class(db_session, school)
    classmate = Student(school_id=school.id, class_id=cls.id, admission_number="PP1-002", first_name="Other", last_name="Learner")
    db_session.add(classmate)
    db_session.commit()
    for s in (student, classmate):
        db_session.add(Result(school_id=school.id, student_id=s.id, subject_id=subject.id, term="Term 1 2026", score=70, grade="B"))
    db_session.commit()

    card = build_report_card(db_session, student, "Term 1 2026")
    assert card.class_position is None


def test_ordinary_grade_report_card_still_ranks_normally(db_session, school):
    grade = _grade(db_session, "G4")
    cls = SchoolClass(school_id=school.id, name="Grade 4 Simba", grade_level_id=grade.id)
    db_session.add(cls)
    db_session.flush()
    subject = Subject(school_id=school.id, name="Mathematics")
    db_session.add(subject)
    student = Student(school_id=school.id, class_id=cls.id, admission_number="G4-001", first_name="Older", last_name="Learner")
    classmate = Student(school_id=school.id, class_id=cls.id, admission_number="G4-002", first_name="Another", last_name="Learner")
    db_session.add_all([student, classmate])
    db_session.flush()
    db_session.add(Result(school_id=school.id, student_id=student.id, subject_id=subject.id, term="Term 1 2026", score=90, grade="A"))
    db_session.add(Result(school_id=school.id, student_id=classmate.id, subject_id=subject.id, term="Term 1 2026", score=60, grade="C"))
    db_session.commit()

    card = build_report_card(db_session, student, "Term 1 2026")
    assert card.class_position == "1 / 2"
