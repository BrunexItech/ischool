"""A teacher only ever sees students in classes they actually teach or are
class teacher of — never the whole school's roster, unlike every other
role that can see everyone."""

from app.core.security import hash_password
from app.models.academics import SchoolClass, Student
from app.models.results import Subject
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import User, UserRole
from tests.conftest import _login, auth_headers


def test_teacher_only_sees_students_in_their_own_classes(client, db_session, school):
    teacher, password = User(
        school_id=school.id, email="scope.teacher@test-academy.test", full_name="Scope Teacher",
        hashed_password=hash_password("TestPass123!"), role=UserRole.TEACHER,
    ), "TestPass123!"
    db_session.add(teacher)
    cls_mine = SchoolClass(school_id=school.id, name="Grade 9A")
    cls_other = SchoolClass(school_id=school.id, name="Grade 9B")
    db_session.add_all([cls_mine, cls_other])
    db_session.flush()
    subject = Subject(school_id=school.id, name="Chemistry")
    db_session.add(subject)
    db_session.flush()
    db_session.add(TeacherAssignment(school_id=school.id, teacher_user_id=teacher.id, class_id=cls_mine.id, subject_id=subject.id))
    db_session.add(Student(school_id=school.id, class_id=cls_mine.id, admission_number="SC-001", first_name="In", last_name="Class"))
    db_session.add(Student(school_id=school.id, class_id=cls_other.id, admission_number="SC-002", first_name="Not", last_name="MyClass"))
    db_session.commit()

    token = _login(client, teacher.email, password)
    response = client.get(f"/schools/{school.id}/students", headers=auth_headers(token))
    assert response.status_code == 200
    names = [f"{s['first_name']} {s['last_name']}" for s in response.json()]
    assert names == ["In Class"]


def test_teacher_cannot_filter_by_a_class_not_theirs(client, db_session, school):
    teacher = User(
        school_id=school.id, email="blocked.teacher@test-academy.test", full_name="Blocked Teacher",
        hashed_password=hash_password("TestPass123!"), role=UserRole.TEACHER,
    )
    db_session.add(teacher)
    other_cls = SchoolClass(school_id=school.id, name="Grade 10A")
    db_session.add(other_cls)
    db_session.commit()

    token = _login(client, teacher.email, "TestPass123!")
    response = client.get(f"/schools/{school.id}/students", params={"class_id": other_cls.id}, headers=auth_headers(token))
    assert response.status_code == 403


def test_homeroom_teacher_sees_their_class_students_without_assignment(client, db_session, school):
    teacher = User(
        school_id=school.id, email="homeroom.scope@test-academy.test", full_name="Homeroom Scope",
        hashed_password=hash_password("TestPass123!"), role=UserRole.TEACHER,
    )
    db_session.add(teacher)
    db_session.flush()
    cls = SchoolClass(school_id=school.id, name="Grade 11A", homeroom_teacher_id=teacher.id)
    db_session.add(cls)
    db_session.flush()
    db_session.add(Student(school_id=school.id, class_id=cls.id, admission_number="SC-003", first_name="Home", last_name="Room"))
    db_session.commit()

    token = _login(client, teacher.email, "TestPass123!")
    response = client.get(f"/schools/{school.id}/students", headers=auth_headers(token))
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_school_admin_still_sees_every_student(client, db_session, school, school_admin_token):
    cls = SchoolClass(school_id=school.id, name="Grade 12A")
    db_session.add(cls)
    db_session.flush()
    db_session.add(Student(school_id=school.id, class_id=cls.id, admission_number="SC-004", first_name="Admin", last_name="Visible"))
    db_session.commit()

    response = client.get(f"/schools/{school.id}/students", headers=auth_headers(school_admin_token))
    assert response.status_code == 200
    assert any(s["admission_number"] == "SC-004" for s in response.json())
