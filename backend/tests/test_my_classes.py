"""A teacher's own 'My Classes' landing view: every class/subject they're
assigned to teach, plus any class they're the homeroom teacher of even
without an explicit assignment row — and never another teacher's classes."""

from datetime import date

from app.models.academics import SchoolClass, Student
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.results import Subject
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import UserRole
from tests.conftest import _login, _make_user, auth_headers


def test_teacher_sees_only_their_own_assigned_classes(client, db_session, school):
    teacher, password = _make_user(db_session, school, UserRole.TEACHER, "t1@test-academy.test")
    other_teacher, _ = _make_user(db_session, school, UserRole.TEACHER, "t2@test-academy.test")
    cls_mine = SchoolClass(school_id=school.id, name="Grade 2A")
    cls_other = SchoolClass(school_id=school.id, name="Grade 3A")
    db_session.add_all([cls_mine, cls_other])
    db_session.flush()
    subject = Subject(school_id=school.id, name="Math")
    db_session.add(subject)
    db_session.flush()
    db_session.add(TeacherAssignment(school_id=school.id, teacher_user_id=teacher.id, class_id=cls_mine.id, subject_id=subject.id))
    db_session.add(TeacherAssignment(school_id=school.id, teacher_user_id=other_teacher.id, class_id=cls_other.id, subject_id=subject.id))
    db_session.commit()

    token = _login(client, teacher.email, password)
    response = client.get(f"/schools/{school.id}/teacher-assignments/mine", headers=auth_headers(token))
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["class_name"] == "Grade 2A"
    assert body[0]["subject_name"] == "Math"
    assert body[0]["is_homeroom_teacher"] is False


def test_homeroom_teacher_sees_their_class_even_without_an_assignment_row(client, db_session, school):
    teacher, password = _make_user(db_session, school, UserRole.TEACHER, "homeroom@test-academy.test")
    cls = SchoolClass(school_id=school.id, name="Grade 4A", homeroom_teacher_id=teacher.id)
    db_session.add(cls)
    db_session.flush()
    db_session.add(Student(school_id=school.id, class_id=cls.id, admission_number="MC-001", first_name="A", last_name="B"))
    db_session.commit()

    token = _login(client, teacher.email, password)
    response = client.get(f"/schools/{school.id}/teacher-assignments/mine", headers=auth_headers(token))
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["is_homeroom_teacher"] is True
    assert body[0]["student_count"] == 1
    assert body[0]["attendance_marked_today"] is False


def test_attendance_marked_today_reflects_real_records(client, db_session, school):
    teacher, password = _make_user(db_session, school, UserRole.TEACHER, "marked@test-academy.test")
    cls = SchoolClass(school_id=school.id, name="Grade 5A", homeroom_teacher_id=teacher.id)
    db_session.add(cls)
    db_session.flush()
    student = Student(school_id=school.id, class_id=cls.id, admission_number="MC-002", first_name="C", last_name="D")
    db_session.add(student)
    db_session.flush()
    db_session.add(AttendanceRecord(school_id=school.id, class_id=cls.id, student_id=student.id, date=date.today(), status=AttendanceStatus.PRESENT))
    db_session.commit()

    token = _login(client, teacher.email, password)
    response = client.get(f"/schools/{school.id}/teacher-assignments/mine", headers=auth_headers(token))
    assert response.json()[0]["attendance_marked_today"] is True


def test_non_teacher_cannot_call_my_classes(client, school_admin_token, school):
    response = client.get(f"/schools/{school.id}/teacher-assignments/mine", headers=auth_headers(school_admin_token))
    assert response.status_code == 403
