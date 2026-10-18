"""The report card is a real document, not just a grade table: it also
carries a class position (ranked against classmates), an attendance rate
for the term, and narrative remarks — the homeroom teacher's own comment,
and a school_admin's (standing in for the head teacher's)."""

from app.models.academic_term import AcademicTerm
from app.models.academics import SchoolClass, Student
from app.models.results import Subject, Result
from app.models.user import UserRole
from tests.conftest import _login, _make_user, auth_headers


def _make_class(db_session, school, name="Grade 7A", teacher_id=None):
    cls = SchoolClass(school_id=school.id, name=name, homeroom_teacher_id=teacher_id)
    db_session.add(cls)
    db_session.flush()
    return cls


def _make_student(db_session, school, cls, admission_number, first_name, last_name="Test"):
    s = Student(school_id=school.id, class_id=cls.id, admission_number=admission_number, first_name=first_name, last_name=last_name)
    db_session.add(s)
    db_session.flush()
    return s


def _score(db_session, school, student, subject, term, score):
    db_session.add(Result(school_id=school.id, student_id=student.id, subject_id=subject.id, term=term, score=score, grade=None))
    db_session.flush()


def test_report_card_includes_class_position(client, db_session, school, school_admin_token):
    cls = _make_class(db_session, school)
    subject = Subject(school_id=school.id, name="Math")
    db_session.add(subject)
    db_session.flush()

    top = _make_student(db_session, school, cls, "S-001", "Top")
    mid = _make_student(db_session, school, cls, "S-002", "Mid")
    _score(db_session, school, top, subject, "Term 1", 95)
    _score(db_session, school, mid, subject, "Term 1", 60)
    db_session.commit()

    response = client.get(
        f"/schools/{school.id}/students/{mid.id}/report-card", params={"term": "Term 1"}, headers=auth_headers(school_admin_token)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["class_position"] == "2 / 2"


def test_homeroom_teacher_can_set_class_teacher_remark(client, db_session, school):
    teacher, password = _make_user(db_session, school, UserRole.TEACHER, "homeroom@test-academy.test")
    cls = _make_class(db_session, school, teacher_id=teacher.id)
    student = _make_student(db_session, school, cls, "S-010", "Learner")
    db_session.commit()


    token = _login(client, teacher.email, password)
    response = client.patch(
        f"/schools/{school.id}/students/{student.id}/report-card-remarks",
        params={"term": "Term 1"},
        headers=auth_headers(token),
        json={"class_teacher_remark": "A hardworking and focused learner."},
    )
    assert response.status_code == 200
    assert response.json()["class_teacher_remark"] == "A hardworking and focused learner."
    assert response.json()["principal_remark"] is None


def test_non_homeroom_teacher_cannot_set_remark_for_a_class_not_theirs(client, db_session, school):
    other_teacher, password = _make_user(db_session, school, UserRole.TEACHER, "other.teacher@test-academy.test")
    cls = _make_class(db_session, school)  # no homeroom teacher assigned
    student = _make_student(db_session, school, cls, "S-011", "Learner")
    db_session.commit()

    token = _login(client, other_teacher.email, password)
    response = client.patch(
        f"/schools/{school.id}/students/{student.id}/report-card-remarks",
        params={"term": "Term 1"},
        headers=auth_headers(token),
        json={"class_teacher_remark": "Trying to sneak a comment in."},
    )
    assert response.status_code == 403


def test_teacher_cannot_set_principal_remark(client, db_session, school):
    teacher, password = _make_user(db_session, school, UserRole.TEACHER, "homeroom2@test-academy.test")
    cls = _make_class(db_session, school, teacher_id=teacher.id)
    student = _make_student(db_session, school, cls, "S-012", "Learner")
    db_session.commit()

    token = _login(client, teacher.email, password)
    response = client.patch(
        f"/schools/{school.id}/students/{student.id}/report-card-remarks",
        params={"term": "Term 1"},
        headers=auth_headers(token),
        json={"principal_remark": "Overstepping."},
    )
    assert response.status_code == 403


def test_school_admin_can_set_both_remarks(client, db_session, school, school_admin_token):
    cls = _make_class(db_session, school)
    student = _make_student(db_session, school, cls, "S-013", "Learner")
    db_session.commit()

    response = client.patch(
        f"/schools/{school.id}/students/{student.id}/report-card-remarks",
        params={"term": "Term 1"},
        headers=auth_headers(school_admin_token),
        json={"class_teacher_remark": "Good progress this term.", "principal_remark": "Keep up the discipline."},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["class_teacher_remark"] == "Good progress this term."
    assert body["principal_remark"] == "Keep up the discipline."


def test_report_card_includes_attendance_rate_when_term_has_dates(client, db_session, school, school_admin_token):
    from datetime import date
    from app.models.attendance import AttendanceRecord, AttendanceStatus

    cls = _make_class(db_session, school)
    student = _make_student(db_session, school, cls, "S-014", "Learner")
    term = AcademicTerm(school_id=school.id, name="Term 1", start_date=date(2026, 1, 1), end_date=date(2026, 3, 31))
    db_session.add(term)
    db_session.flush()
    db_session.add(AttendanceRecord(school_id=school.id, class_id=cls.id, student_id=student.id, date=date(2026, 1, 5), status=AttendanceStatus.PRESENT))
    db_session.add(AttendanceRecord(school_id=school.id, class_id=cls.id, student_id=student.id, date=date(2026, 1, 6), status=AttendanceStatus.ABSENT))
    db_session.commit()

    response = client.get(
        f"/schools/{school.id}/students/{student.id}/report-card", params={"term": "Term 1"}, headers=auth_headers(school_admin_token)
    )
    assert response.status_code == 200
    assert response.json()["attendance_rate"] == 50.0
