"""Grades 1-9 reuse the exact same competency-assessment/observation-note
engine built for PP1/PP2 — no separate system, no grade-specific code path
in the models or routers. The one thing that must NOT leak across grades
is the "no ranking" rule, which the official KSRAT source scopes strictly
to PP1/PP2: a Grade 2/Grade 8 report card must still rank normally.

No curriculum content (subject names, strands, learning outcomes) is
seeded here for Grades 1-9 — unlike PP1/PP2's five learning areas, no
primary-source KICD document was verified for this session to the same
citable standard, and the brief explicitly says not to invent it. Schools
add their own subjects via the existing /subjects endpoint, already
functional for any grade with no code change needed."""

from datetime import date

from app.core.report_card import build_report_card
from app.core.security import hash_password
from app.models.academics import SchoolClass, Student
from app.models.grade_level import GradeLevel
from app.models.results import Result, Subject
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import User, UserRole
from tests.conftest import _login


def _grade(db_session, code):
    return db_session.query(GradeLevel).filter_by(code=code).first()


def _setup_class(db_session, school, grade_code, class_name):
    grade = _grade(db_session, grade_code)
    cls = SchoolClass(school_id=school.id, name=class_name, grade_level_id=grade.id)
    db_session.add(cls)
    db_session.flush()
    subject = Subject(school_id=school.id, name="Mathematics")
    db_session.add(subject)
    teacher = User(
        school_id=school.id, email=f"{class_name.lower().replace(' ', '')}@test-academy.test", full_name="Class Teacher",
        hashed_password=hash_password("TestPass123!"), role=UserRole.TEACHER,
    )
    db_session.add(teacher)
    db_session.flush()
    db_session.add(TeacherAssignment(school_id=school.id, teacher_user_id=teacher.id, class_id=cls.id, subject_id=subject.id))
    student = Student(school_id=school.id, class_id=cls.id, admission_number=f"{grade_code}-001", first_name="A", last_name="Learner")
    db_session.add(student)
    db_session.commit()
    return cls, subject, teacher, student


def test_competency_engine_works_unmodified_for_grade_2(client, db_session, school):
    cls, subject, teacher, student = _setup_class(db_session, school, "G2", "Grade 2 Nyati")
    headers = {"Authorization": f"Bearer {_login(client, teacher.email, 'TestPass123!')}"}

    response = client.post(
        f"/schools/{school.id}/competency-assessments",
        headers=headers,
        json={
            "student_id": student.id, "class_id": cls.id, "subject_id": subject.id, "term": "Term 1 2026",
            "strand": "Numbers", "sub_strand": "Addition", "criterion": "Adds two 2-digit numbers",
            "performance_level": "exceeding_expectation", "assessment_date": str(date.today()),
        },
    )
    assert response.status_code == 201, response.text


def test_competency_engine_works_unmodified_for_grade_8(client, db_session, school):
    cls, subject, teacher, student = _setup_class(db_session, school, "G8", "Grade 8 Tai")
    headers = {"Authorization": f"Bearer {_login(client, teacher.email, 'TestPass123!')}"}

    response = client.post(
        f"/schools/{school.id}/observation-notes",
        headers=headers,
        json={"student_id": student.id, "class_id": cls.id, "note": "Strong group-work participation", "noted_on": str(date.today())},
    )
    assert response.status_code == 201, response.text


def test_grade_2_report_card_still_ranks_normally(db_session, school):
    cls, subject, _teacher, student = _setup_class(db_session, school, "G2", "Grade 2 Simba")
    classmate = Student(school_id=school.id, class_id=cls.id, admission_number="G2-002", first_name="B", last_name="Learner")
    db_session.add(classmate)
    db_session.commit()
    db_session.add(Result(school_id=school.id, student_id=student.id, subject_id=subject.id, term="Term 1 2026", score=80, grade="A"))
    db_session.add(Result(school_id=school.id, student_id=classmate.id, subject_id=subject.id, term="Term 1 2026", score=50, grade="D"))
    db_session.commit()

    card = build_report_card(db_session, student, "Term 1 2026")
    assert card.class_position == "1 / 2"


def test_grade_8_report_card_still_ranks_normally(db_session, school):
    cls, subject, _teacher, student = _setup_class(db_session, school, "G8", "Grade 8 Chui")
    classmate = Student(school_id=school.id, class_id=cls.id, admission_number="G8-002", first_name="B", last_name="Learner")
    db_session.add(classmate)
    db_session.commit()
    db_session.add(Result(school_id=school.id, student_id=student.id, subject_id=subject.id, term="Term 1 2026", score=40, grade="E"))
    db_session.add(Result(school_id=school.id, student_id=classmate.id, subject_id=subject.id, term="Term 1 2026", score=90, grade="A"))
    db_session.commit()

    card = build_report_card(db_session, student, "Term 1 2026")
    assert card.class_position == "2 / 2"


def test_cannot_create_a_junior_school_class_if_not_enabled_for_the_school(client, db_session, school, school_admin_token):
    headers = {"Authorization": f"Bearer {school_admin_token}"}
    g7 = _grade(db_session, "G7").id
    response = client.post(f"/schools/{school.id}/classes", headers=headers, json={"name": "Grade 7 Tembo", "grade_level_id": g7})
    assert response.status_code == 400
