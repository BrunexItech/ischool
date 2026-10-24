"""Scores convert to a CBC level (EE/ME/AE/BE) using the school's own
configurable bands — same mechanism for every grade, PP1/PP2 included,
replacing the old hardcoded A-E percentage scale."""

from app.models.academics import SchoolClass, Student
from app.models.grade_level import GradeLevel
from app.models.results import Subject
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import User, UserRole
from app.core.security import hash_password
from tests.conftest import _login


def _grade(db_session, code):
    return db_session.query(GradeLevel).filter_by(code=code).first()


def _setup(db_session, school, grade_code="G6"):
    grade = _grade(db_session, grade_code)
    cls = SchoolClass(school_id=school.id, name=f"{grade_code} Kerio", grade_level_id=grade.id)
    db_session.add(cls)
    db_session.flush()
    subject = Subject(school_id=school.id, name="Mathematics")
    db_session.add(subject)
    teacher = User(
        school_id=school.id, email=f"{grade_code.lower()}teacher@test-academy.test", full_name="Class Teacher",
        hashed_password=hash_password("TestPass123!"), role=UserRole.TEACHER,
    )
    db_session.add(teacher)
    db_session.flush()
    db_session.add(TeacherAssignment(school_id=school.id, teacher_user_id=teacher.id, class_id=cls.id, subject_id=subject.id))
    student = Student(school_id=school.id, class_id=cls.id, admission_number=f"{grade_code}-001", first_name="A", last_name="Learner")
    db_session.add(student)
    db_session.commit()
    return cls, subject, teacher, student


def test_default_bands_are_seeded_on_first_access(client, db_session, school, school_admin_token):
    headers = {"Authorization": f"Bearer {school_admin_token}"}
    response = client.get(f"/schools/{school.id}/grading-bands", headers=headers)
    assert response.status_code == 200
    codes = {b["level_code"] for b in response.json()}
    assert codes == {"EE", "ME", "AE", "BE"}


def test_score_converts_to_the_correct_default_band(client, db_session, school):
    cls, subject, teacher, student = _setup(db_session, school)
    headers = {"Authorization": f"Bearer {_login(client, teacher.email, 'TestPass123!')}"}

    response = client.post(
        f"/schools/{school.id}/results",
        headers=headers,
        json={"student_id": student.id, "subject_id": subject.id, "term": "Term 1 2026", "score": 85},
    )
    assert response.status_code == 200, response.text
    assert response.json()["grade"] == "EE"


def test_admin_can_customize_bands_and_scoring_uses_the_new_bands(client, db_session, school, school_admin_token):
    cls, subject, teacher, student = _setup(db_session, school, "G5")
    admin_headers = {"Authorization": f"Bearer {school_admin_token}"}

    custom = [
        {"level_code": "X1", "label": "Top", "min_score": 90, "max_score": 100, "points": 4},
        {"level_code": "X2", "label": "Mid", "min_score": 0, "max_score": 89, "points": 1},
    ]
    update = client.put(f"/schools/{school.id}/grading-bands", headers=admin_headers, json={"bands": custom})
    assert update.status_code == 200, update.text

    teacher_headers = {"Authorization": f"Bearer {_login(client, teacher.email, 'TestPass123!')}"}
    response = client.post(
        f"/schools/{school.id}/results",
        headers=teacher_headers,
        json={"student_id": student.id, "subject_id": subject.id, "term": "Term 1 2026", "score": 95},
    )
    assert response.status_code == 200, response.text
    assert response.json()["grade"] == "X1"


def test_teacher_cannot_change_grading_bands(client, db_session, school):
    _cls, _subject, teacher, _student = _setup(db_session, school, "G4")
    headers = {"Authorization": f"Bearer {_login(client, teacher.email, 'TestPass123!')}"}
    response = client.put(
        f"/schools/{school.id}/grading-bands", headers=headers,
        json={"bands": [{"level_code": "X", "label": "X", "min_score": 0, "max_score": 100, "points": 1}]},
    )
    assert response.status_code == 403


def test_pp2_score_also_converts_via_the_same_bands(client, db_session, school):
    cls, subject, teacher, student = _setup(db_session, school, "PP2")
    headers = {"Authorization": f"Bearer {_login(client, teacher.email, 'TestPass123!')}"}

    response = client.post(
        f"/schools/{school.id}/results",
        headers=headers,
        json={"student_id": student.id, "subject_id": subject.id, "term": "Term 1 2026", "score": 35},
    )
    assert response.status_code == 200, response.text
    assert response.json()["grade"] == "AE"
