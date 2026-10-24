"""A teacher marking a student absent/late can attach a free-text reason;
Heads of Institution and Group Principals can see the register but never
record or change it — that stays with whoever actually takes it."""

from app.models.academics import SchoolClass, Student
from app.models.user import User
from tests.conftest import auth_headers


def _class_and_student(db_session, school, teacher_email):
    teacher = db_session.query(User).filter_by(school_id=school.id, email=teacher_email).first()
    cls = SchoolClass(school_id=school.id, name="Grade 6 Kerio", homeroom_teacher_id=teacher.id)
    db_session.add(cls)
    db_session.flush()
    student = Student(school_id=school.id, class_id=cls.id, admission_number="G6-001", first_name="A", last_name="Learner")
    db_session.add(student)
    db_session.commit()
    return cls, student


def test_teacher_can_record_an_absence_reason(client, db_session, school, teacher_token):
    cls, student = _class_and_student(db_session, school, "teacher@test-academy.test")

    response = client.post(
        f"/schools/{school.id}/attendance",
        headers=auth_headers(teacher_token),
        json={
            "class_id": cls.id,
            "date": "2026-10-24",
            "records": [{"student_id": student.id, "status": "absent", "reason": "Sick — flu"}],
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()[0]["reason"] == "Sick — flu"


def test_reason_is_cleared_when_resubmitted_present(client, db_session, school, teacher_token):
    cls, student = _class_and_student(db_session, school, "teacher@test-academy.test")

    client.post(
        f"/schools/{school.id}/attendance",
        headers=auth_headers(teacher_token),
        json={"class_id": cls.id, "date": "2026-10-24", "records": [{"student_id": student.id, "status": "absent", "reason": "Dentist"}]},
    )
    response = client.post(
        f"/schools/{school.id}/attendance",
        headers=auth_headers(teacher_token),
        json={"class_id": cls.id, "date": "2026-10-24", "records": [{"student_id": student.id, "status": "present"}]},
    )
    assert response.status_code == 200, response.text
    assert response.json()[0]["reason"] is None


def test_head_of_institution_cannot_mark_attendance(client, db_session, school, teacher_token, school_admin_token):
    cls, student = _class_and_student(db_session, school, "teacher@test-academy.test")

    response = client.post(
        f"/schools/{school.id}/attendance",
        headers=auth_headers(school_admin_token),
        json={"class_id": cls.id, "date": "2026-10-24", "records": [{"student_id": student.id, "status": "absent"}]},
    )
    assert response.status_code == 403


def test_head_of_institution_can_view_attendance(client, db_session, school, teacher_token, school_admin_token):
    cls, student = _class_and_student(db_session, school, "teacher@test-academy.test")
    client.post(
        f"/schools/{school.id}/attendance",
        headers=auth_headers(teacher_token),
        json={"class_id": cls.id, "date": "2026-10-24", "records": [{"student_id": student.id, "status": "absent", "reason": "Travel"}]},
    )

    response = client.get(f"/schools/{school.id}/attendance?class_id={cls.id}&date=2026-10-24", headers=auth_headers(school_admin_token))
    assert response.status_code == 200, response.text
    assert response.json()[0]["reason"] == "Travel"
