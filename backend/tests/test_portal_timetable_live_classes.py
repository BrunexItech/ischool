"""Students and parents should only see the timetable and live classes for
their own class — never another class's schedule or session."""

from app.models.academics import SchoolClass, Student
from app.models.live_classes import LiveClass
from app.models.results import Subject
from app.models.timetable import TimetableSlot
from app.models.user import User, UserRole
from app.core.security import hash_password
from tests.conftest import auth_headers


def _setup(db_session, school):
    cls_a = SchoolClass(school_id=school.id, name="Grade 5A")
    cls_b = SchoolClass(school_id=school.id, name="Grade 5B")
    db_session.add_all([cls_a, cls_b])
    db_session.flush()
    math = Subject(school_id=school.id, name="Math")
    db_session.add(math)
    db_session.flush()

    db_session.add(TimetableSlot(school_id=school.id, class_id=cls_a.id, subject_id=math.id, day_of_week=0, start_time="08:00:00", end_time="09:00:00"))
    db_session.add(TimetableSlot(school_id=school.id, class_id=cls_b.id, subject_id=math.id, day_of_week=0, start_time="09:00:00", end_time="10:00:00"))

    student_user = User(
        school_id=school.id, email="kid@test-academy.test", full_name="A Student",
        hashed_password=hash_password("TestPass123!"), role=UserRole.STUDENT,
    )
    guardian = User(
        school_id=school.id, email="mum@test-academy.test", full_name="A Parent",
        hashed_password=hash_password("TestPass123!"), role=UserRole.PARENT,
    )
    db_session.add_all([student_user, guardian])
    db_session.flush()

    live_a = LiveClass(school_id=school.id, class_id=cls_a.id, title="A's class", scheduled_start="2025-01-01T08:00:00", room_name="room-a", join_code="code-a", created_by=guardian.id)
    live_b = LiveClass(school_id=school.id, class_id=cls_b.id, title="B's class", scheduled_start="2025-01-01T09:00:00", room_name="room-b", join_code="code-b", created_by=guardian.id)
    db_session.add_all([live_a, live_b])
    db_session.flush()

    student = Student(
        school_id=school.id, class_id=cls_a.id, admission_number="TT-001",
        first_name="A", last_name="Student", user_id=student_user.id, guardian_user_id=guardian.id,
    )
    db_session.add(student)
    db_session.commit()
    return student, live_a, live_b


def _login(client, user):
    response = client.post("/auth/login", data={"username": user.email, "password": "TestPass123!"})
    return auth_headers(response.json()["access_token"])


def test_student_sees_only_their_own_class_timetable(client, db_session, school):
    student, _, _ = _setup(db_session, school)
    headers = _login(client, db_session.query(User).filter_by(id=student.user_id).first())

    response = client.get(f"/portal/students/{student.id}/timetable", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["class_name"] == "Grade 5A"


def test_parent_sees_only_their_child_class_live_classes(client, db_session, school):
    student, live_a, live_b = _setup(db_session, school)
    headers = _login(client, db_session.query(User).filter_by(id=student.guardian_user_id).first())

    response = client.get(f"/portal/students/{student.id}/live-classes", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == live_a.id


def test_student_can_get_a_join_token_for_their_own_classs_live_class(client, db_session, school):
    student, live_a, _ = _setup(db_session, school)
    headers = _login(client, db_session.query(User).filter_by(id=student.user_id).first())

    response = client.post(f"/portal/students/{student.id}/live-classes/{live_a.id}/join-token", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["room_name"] == "room-a"


def test_student_cannot_join_another_classs_live_class(client, db_session, school):
    student, _, live_b = _setup(db_session, school)
    headers = _login(client, db_session.query(User).filter_by(id=student.user_id).first())

    response = client.post(f"/portal/students/{student.id}/live-classes/{live_b.id}/join-token", headers=headers)
    assert response.status_code == 404


def test_parent_cannot_get_a_join_token(client, db_session, school):
    student, live_a, _ = _setup(db_session, school)
    headers = _login(client, db_session.query(User).filter_by(id=student.guardian_user_id).first())

    response = client.post(f"/portal/students/{student.id}/live-classes/{live_a.id}/join-token", headers=headers)
    assert response.status_code == 403


def test_family_overview_and_class_name_and_result_subjects(client, db_session, school):
    from app.models.results import Result
    from app.models.fees import FeeInvoice

    student, _, _ = _setup(db_session, school)
    math = db_session.query(Subject).filter_by(school_id=school.id, name="Math").first()
    db_session.add(Result(school_id=school.id, student_id=student.id, subject_id=math.id, term="Term 1", exam_type="CAT", score=70, grade="B"))
    db_session.add(FeeInvoice(school_id=school.id, student_id=student.id, term="Term 1", category="tuition", amount_due=1000, amount_paid=400))
    db_session.commit()
    guardian = db_session.query(User).filter_by(id=student.guardian_user_id).first()
    headers = _login(client, guardian)

    kids = client.get("/portal/children", headers=headers).json()
    assert kids[0]["class_name"] == "Grade 5A"
    results = client.get(f"/portal/students/{student.id}/results", headers=headers).json()
    assert results[0]["subject_name"] == "Math"
    body = client.get("/portal/overview", headers=headers)
    assert body.status_code == 200, body.text
    card = body.json()["children"][0]
    assert card["student"]["class_name"] == "Grade 5A"
    assert card["student"]["id"] == student.id

    # a student gets their own card
    mine = client.get("/portal/overview", headers=_login(client, db_session.query(User).filter_by(id=student.user_id).first()))
    assert mine.status_code == 200 and len(mine.json()["children"]) == 1


def test_parent_sees_exam_details_but_never_the_paper_or_questions(client, db_session, school):
    from datetime import datetime, timezone

    from app.models.exam import Exam

    student, _, _ = _setup(db_session, school)
    math = db_session.query(Subject).filter_by(school_id=school.id, name="Math").first()
    exam = Exam(school_id=school.id, subject_id=math.id, class_id=student.class_id, title="Mid-term Math", exam_type="cat", term="Term 1", duration_minutes=40, is_published=True, paper_file_url="/files/paper.pdf", created_by=student.guardian_user_id)
    db_session.add(exam)
    db_session.commit()
    guardian = db_session.query(User).filter_by(id=student.guardian_user_id).first()
    kid = db_session.query(User).filter_by(id=student.user_id).first()

    as_parent = client.get(f"/portal/students/{student.id}/exams", headers=_login(client, guardian)).json()
    assert as_parent[0]["title"] == "Mid-term Math" and as_parent[0]["paper_file_url"] is None
    assert client.post(f"/portal/students/{student.id}/exams/{exam.id}/start", headers=_login(client, guardian)).status_code == 403

    as_student = client.get(f"/portal/students/{student.id}/exams", headers=_login(client, kid)).json()
    assert as_student[0]["paper_file_url"] == "/files/paper.pdf"
