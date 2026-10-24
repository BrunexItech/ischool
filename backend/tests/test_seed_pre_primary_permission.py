"""Seeding the official PP1/PP2 learning areas is an admin power, plus a
narrow exception: a teacher can do it too, but only when they actually
teach a PP1/PP2 class — not as a general subject-management shortcut."""

from app.core.security import hash_password
from app.models.academics import SchoolClass, Student
from app.models.grade_level import GradeLevel
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import User, UserRole
from tests.conftest import auth_headers


def _grade(db_session, code):
    return db_session.query(GradeLevel).filter_by(code=code).first()


def _login(client, email, password="TestPass123!"):
    r = client.post("/auth/login", data={"username": email, "password": password})
    return auth_headers(r.json()["access_token"])


def test_teacher_who_teaches_pp1_can_seed(client, db_session, school):
    grade = _grade(db_session, "PP1")
    cls = SchoolClass(school_id=school.id, name="PP1 Simba", grade_level_id=grade.id)
    db_session.add(cls)
    db_session.flush()
    teacher = User(school_id=school.id, email="pp1owner@test-academy.test", full_name="PP1 Owner", hashed_password=hash_password("TestPass123!"), role=UserRole.TEACHER)
    db_session.add(teacher)
    db_session.flush()
    db_session.add(TeacherAssignment(school_id=school.id, teacher_user_id=teacher.id, class_id=cls.id, subject_id=None))
    db_session.commit()

    response = client.post(f"/schools/{school.id}/subjects/seed-pre-primary-learning-areas", headers=_login(client, teacher.email))
    assert response.status_code == 200, response.text
    assert len(response.json()) == 5


def test_teacher_who_does_not_teach_a_pre_primary_class_is_forbidden(client, db_session, school):
    grade = _grade(db_session, "G4")
    cls = SchoolClass(school_id=school.id, name="Grade 4 Twiga", grade_level_id=grade.id)
    db_session.add(cls)
    db_session.flush()
    teacher = User(school_id=school.id, email="g4teacher@test-academy.test", full_name="G4 Teacher", hashed_password=hash_password("TestPass123!"), role=UserRole.TEACHER)
    db_session.add(teacher)
    db_session.flush()
    db_session.add(TeacherAssignment(school_id=school.id, teacher_user_id=teacher.id, class_id=cls.id, subject_id=None))
    db_session.commit()

    response = client.post(f"/schools/{school.id}/subjects/seed-pre-primary-learning-areas", headers=_login(client, teacher.email))
    assert response.status_code == 403


def test_homeroom_teacher_of_pp2_can_seed(client, db_session, school):
    grade = _grade(db_session, "PP2")
    teacher = User(school_id=school.id, email="pp2homeroom@test-academy.test", full_name="PP2 Homeroom", hashed_password=hash_password("TestPass123!"), role=UserRole.TEACHER)
    db_session.add(teacher)
    db_session.flush()
    cls = SchoolClass(school_id=school.id, name="PP2 Chui", grade_level_id=grade.id, homeroom_teacher_id=teacher.id)
    db_session.add(cls)
    db_session.commit()

    response = client.post(f"/schools/{school.id}/subjects/seed-pre-primary-learning-areas", headers=_login(client, teacher.email))
    assert response.status_code == 200, response.text
