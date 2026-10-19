"""A class's homeroom teacher — assigning one via the Classes page, and
that assignment alone granting register-marking rights without needing a
separate teaching assignment."""

from datetime import date

from app.models.academics import SchoolClass, Student
from app.models.results import Subject
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import User, UserRole
from tests.conftest import auth_headers


def _teacher_id(db_session, email="teacher@test-academy.test") -> int:
    return db_session.query(User).filter_by(email=email).first().id


def test_admin_can_assign_class_teacher(client, db_session, school, school_admin_token, teacher_token):
    cls = SchoolClass(school_id=school.id, name="Grade 5A")
    db_session.add(cls)
    db_session.commit()
    teacher_id = _teacher_id(db_session)

    response = client.patch(
        f"/schools/{school.id}/classes/{cls.id}",
        json={"homeroom_teacher_id": teacher_id},
        headers=auth_headers(school_admin_token),
    )
    assert response.status_code == 200, response.text
    assert response.json()["homeroom_teacher_id"] == teacher_id


def test_assigning_non_teacher_as_class_teacher_is_rejected(client, db_session, school, school_admin_token, staff_token):
    cls = SchoolClass(school_id=school.id, name="Grade 5B")
    db_session.add(cls)
    db_session.commit()
    staff_id = _teacher_id(db_session, "staff@test-academy.test")

    response = client.patch(
        f"/schools/{school.id}/classes/{cls.id}",
        json={"homeroom_teacher_id": staff_id},
        headers=auth_headers(school_admin_token),
    )
    assert response.status_code == 400


def test_homeroom_teacher_can_mark_attendance_without_separate_assignment(
    client, db_session, school, school_admin_token, teacher_token
):
    cls = SchoolClass(school_id=school.id, name="Grade 6A")
    db_session.add(cls)
    db_session.flush()
    student = Student(school_id=school.id, class_id=cls.id, admission_number="CT-001", first_name="A", last_name="B")
    db_session.add(student)
    db_session.commit()
    teacher_id = _teacher_id(db_session)

    # Not yet the class teacher — marking should be rejected.
    reject = client.post(
        f"/schools/{school.id}/attendance",
        json={"class_id": cls.id, "date": date.today().isoformat(), "records": [{"student_id": student.id, "status": "present"}]},
        headers=auth_headers(teacher_token),
    )
    assert reject.status_code == 403

    # Admin assigns them as class teacher — no separate TeacherAssignment row created.
    assign = client.patch(
        f"/schools/{school.id}/classes/{cls.id}",
        json={"homeroom_teacher_id": teacher_id},
        headers=auth_headers(school_admin_token),
    )
    assert assign.status_code == 200

    allowed = client.post(
        f"/schools/{school.id}/attendance",
        json={"class_id": cls.id, "date": date.today().isoformat(), "records": [{"student_id": student.id, "status": "present"}]},
        headers=auth_headers(teacher_token),
    )
    assert allowed.status_code == 200, allowed.text


def test_unrelated_teacher_still_rejected(client, db_session, school, school_admin_token, teacher_token):
    cls = SchoolClass(school_id=school.id, name="Grade 7A")
    db_session.add(cls)
    db_session.flush()
    student = Student(school_id=school.id, class_id=cls.id, admission_number="CT-002", first_name="C", last_name="D")
    db_session.add(student)
    # A different teacher is the class teacher — not the one in teacher_token.
    other = User(
        school_id=school.id,
        email="other.teacher@test-academy.test",
        full_name="Other Teacher",
        hashed_password=db_session.query(User).filter_by(email="teacher@test-academy.test").first().hashed_password,
        role=UserRole.TEACHER,
    )
    db_session.add(other)
    db_session.flush()
    cls.homeroom_teacher_id = other.id
    db_session.commit()

    response = client.post(
        f"/schools/{school.id}/attendance",
        json={"class_id": cls.id, "date": date.today().isoformat(), "records": [{"student_id": student.id, "status": "present"}]},
        headers=auth_headers(teacher_token),
    )
    assert response.status_code == 403


def test_subject_only_assignment_does_not_grant_register_rights(client, db_session, school, teacher_token):
    """Teaching one subject in a class is not the same as being its class
    teacher — the register belongs to the class teacher alone, unless the
    admin explicitly gave someone an 'attendance only' assignment."""
    cls = SchoolClass(school_id=school.id, name="Grade 8A")
    subject = Subject(school_id=school.id, name="Mathematics")
    db_session.add_all([cls, subject])
    db_session.flush()
    student = Student(school_id=school.id, class_id=cls.id, admission_number="CT-003", first_name="E", last_name="F")
    db_session.add(student)
    teacher_id = _teacher_id(db_session)
    db_session.add(TeacherAssignment(school_id=school.id, teacher_user_id=teacher_id, class_id=cls.id, subject_id=subject.id))
    db_session.commit()

    response = client.post(
        f"/schools/{school.id}/attendance",
        json={"class_id": cls.id, "date": date.today().isoformat(), "records": [{"student_id": student.id, "status": "present"}]},
        headers=auth_headers(teacher_token),
    )
    assert response.status_code == 403


def test_attendance_only_assignment_grants_register_rights(client, db_session, school, teacher_token):
    """An explicit 'attendance only' assignment (no subject) is the admin's
    way to give someone register rights without making them the official
    class teacher — e.g. a co-teacher or substitute."""
    cls = SchoolClass(school_id=school.id, name="Grade 8B")
    db_session.add(cls)
    db_session.flush()
    student = Student(school_id=school.id, class_id=cls.id, admission_number="CT-004", first_name="G", last_name="H")
    db_session.add(student)
    teacher_id = _teacher_id(db_session)
    db_session.add(TeacherAssignment(school_id=school.id, teacher_user_id=teacher_id, class_id=cls.id, subject_id=None))
    db_session.commit()

    response = client.post(
        f"/schools/{school.id}/attendance",
        json={"class_id": cls.id, "date": date.today().isoformat(), "records": [{"student_id": student.id, "status": "present"}]},
        headers=auth_headers(teacher_token),
    )
    assert response.status_code == 200, response.text
