"""An award belongs to exactly one recipient — a student XOR a staff
member — enforced both by a Pydantic validator (fast, friendly error) and
a DB check constraint (the real guarantee, in case anything ever bypasses
the API layer). Also: recognizing a colleague is an admin-level call, and
a teacher can only award their own students, never the whole school's."""

from datetime import date

from app.core.security import hash_password
from app.models.academics import SchoolClass, Student
from app.models.results import Subject
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import User, UserRole
from tests.conftest import _login, auth_headers


def test_award_needs_exactly_one_recipient(client, school_admin_token, school):
    response = client.post(
        f"/schools/{school.id}/awards",
        headers=auth_headers(school_admin_token),
        json={"title": "Nobody", "date_awarded": str(date.today())},
    )
    assert response.status_code == 422


def test_award_rejects_both_recipients_at_once(client, school_admin_token, school):
    response = client.post(
        f"/schools/{school.id}/awards",
        headers=auth_headers(school_admin_token),
        json={"student_id": 1, "staff_user_id": 1, "title": "Both", "date_awarded": str(date.today())},
    )
    assert response.status_code == 422


def test_award_for_a_student_from_another_school_is_rejected(client, school_admin_token, school, other_school, db_session):
    from app.models.academics import Student

    intruder = Student(school_id=other_school.id, admission_number="RIV-1", first_name="Not", last_name="Ours")
    db_session.add(intruder)
    db_session.commit()

    response = client.post(
        f"/schools/{school.id}/awards",
        headers=auth_headers(school_admin_token),
        json={"student_id": intruder.id, "title": "Cross-tenant award", "date_awarded": str(date.today())},
    )
    assert response.status_code == 400


def test_teacher_cannot_award_a_staff_member(client, db_session, school, teacher_token, staff_token):
    staff_user = db_session.query(User).filter_by(email="staff@test-academy.test").first()
    response = client.post(
        f"/schools/{school.id}/awards",
        headers=auth_headers(teacher_token),
        json={"staff_user_id": staff_user.id, "title": "Colleague of the month", "date_awarded": str(date.today())},
    )
    assert response.status_code == 403


def test_admin_can_award_a_staff_member(client, db_session, school, school_admin_token):
    staff_user = User(
        school_id=school.id, email="recognized.staff@test-academy.test", full_name="Recognized Staff",
        hashed_password=hash_password("TestPass123!"), role=UserRole.STAFF,
    )
    db_session.add(staff_user)
    db_session.commit()

    response = client.post(
        f"/schools/{school.id}/awards",
        headers=auth_headers(school_admin_token),
        json={"staff_user_id": staff_user.id, "title": "Staff Excellence", "date_awarded": str(date.today())},
    )
    assert response.status_code == 201, response.text


def test_teacher_can_only_award_their_own_students(client, db_session, school):
    teacher = User(
        school_id=school.id, email="award.teacher@test-academy.test", full_name="Award Teacher",
        hashed_password=hash_password("TestPass123!"), role=UserRole.TEACHER,
    )
    db_session.add(teacher)
    cls_mine = SchoolClass(school_id=school.id, name="Grade 3C")
    cls_other = SchoolClass(school_id=school.id, name="Grade 3D")
    db_session.add_all([cls_mine, cls_other])
    db_session.flush()
    subject = Subject(school_id=school.id, name="Art")
    db_session.add(subject)
    db_session.flush()
    db_session.add(TeacherAssignment(school_id=school.id, teacher_user_id=teacher.id, class_id=cls_mine.id, subject_id=subject.id))
    my_student = Student(school_id=school.id, class_id=cls_mine.id, admission_number="AW-001", first_name="My", last_name="Student")
    other_student = Student(school_id=school.id, class_id=cls_other.id, admission_number="AW-002", first_name="Other", last_name="Student")
    db_session.add_all([my_student, other_student])
    db_session.commit()

    token = _login(client, teacher.email, "TestPass123!")

    allowed = client.post(
        f"/schools/{school.id}/awards",
        headers=auth_headers(token),
        json={"student_id": my_student.id, "title": "Star of the week", "date_awarded": str(date.today())},
    )
    assert allowed.status_code == 201, allowed.text

    rejected = client.post(
        f"/schools/{school.id}/awards",
        headers=auth_headers(token),
        json={"student_id": other_student.id, "title": "Star of the week", "date_awarded": str(date.today())},
    )
    assert rejected.status_code == 403
