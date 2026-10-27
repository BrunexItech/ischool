"""What the head sees without opening every class: classes and teachers at a glance."""

from datetime import timedelta

from app.core.dates import school_today
from app.models.academic_term import AcademicTerm
from app.models.academics import SchoolClass, Student
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.grade_level import GradeLevel
from app.models.homework import Homework
from app.models.lesson_plan import LessonPlan, LessonPlanEntry, LessonPlanEntryStatus
from app.models.results import Result, Subject
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import UserRole
from tests.conftest import _login, _make_user, auth_headers


def _setup(db_session, school):
    today = school_today(db_session, school.id)
    db_session.add(AcademicTerm(school_id=school.id, name="Term 3", start_date=today - timedelta(days=40), end_date=today + timedelta(days=40), is_current=True))
    teacher, _ = _make_user(db_session, school, UserRole.TEACHER, "oversee.teacher@test-academy.test")
    grade = db_session.query(GradeLevel).filter_by(code="G4").first()
    north = SchoolClass(school_id=school.id, name="Grade 4 Chui", grade_level_id=grade.id, homeroom_teacher_id=teacher.id)
    south = SchoolClass(school_id=school.id, name="Grade 4 Simba", grade_level_id=grade.id)
    db_session.add_all([north, south])
    db_session.flush()
    math = Subject(school_id=school.id, name="Mathematics")
    db_session.add(math)
    db_session.flush()
    db_session.add(TeacherAssignment(school_id=school.id, teacher_user_id=teacher.id, class_id=north.id, subject_id=math.id))
    kids = []
    for i in range(3):
        s = Student(school_id=school.id, class_id=north.id, admission_number=f"O-{i}", first_name=f"Kid{i}", last_name="Test", gender="male" if i else "female")
        db_session.add(s)
        kids.append(s)
    db_session.flush()
    for k in kids:
        db_session.add(Result(school_id=school.id, student_id=k.id, subject_id=math.id, term="Term 3", exam_type="CAT 1", score=60))
        db_session.add(AttendanceRecord(school_id=school.id, class_id=north.id, student_id=k.id, date=today, status=AttendanceStatus.PRESENT, recorded_by=teacher.id))
    plan = LessonPlan(school_id=school.id, class_id=north.id, subject_id=math.id, term="Term 3", created_by=teacher.id)
    db_session.add(plan)
    db_session.flush()
    for i, st in enumerate([LessonPlanEntryStatus.COMPLETED, LessonPlanEntryStatus.PLANNED]):
        db_session.add(LessonPlanEntry(lesson_plan_id=plan.id, order=i + 1, label=f"W{i+1}", topic="T", status=st))
    db_session.add(Homework(school_id=school.id, class_id=north.id, subject_id=math.id, title="Exercise 4", due_date=today, created_by=teacher.id, given_on_board=True))
    db_session.commit()
    return dict(north=north, south=south, teacher=teacher, today=today)


def test_classes_overview_shows_every_class_with_the_facts(client, db_session, school, school_admin_token):
    d = _setup(db_session, school)
    r = client.get(f"/schools/{school.id}/oversight/classes", headers=auth_headers(school_admin_token))
    assert r.status_code == 200, r.text
    cards = {c["name"]: c for c in r.json()}
    chui, simba = cards["Grade 4 Chui"], cards["Grade 4 Simba"]
    assert chui["learners"] == 3 and chui["average"] == 60.0
    assert chui["homeroom_teacher_name"] == "Oversee Teacher"
    assert chui["topics_covered"] == 1 and chui["topics_total"] == 2
    assert chui["homework_this_week"] == 1
    assert simba["learners"] == 0 and simba["attendance_rate"] is None
    assert chui["level"] == "primary" and chui["grade_name"] == "Grade 4"
    if d["today"].weekday() < 5:
        assert chui["register_today"] == "taken" and simba["register_today"] == "missing"


def test_class_detail_gives_the_full_picture(client, db_session, school, school_admin_token):
    d = _setup(db_session, school)
    body = client.get(f"/schools/{school.id}/oversight/classes/{d['north'].id}", headers=auth_headers(school_admin_token)).json()
    assert body["boys"] == 2 and body["girls"] == 1
    assert [r["subject"] for r in body["teacher_rows"]] == ["Mathematics"]
    assert body["teacher_rows"][0]["teacher"] == "Oversee Teacher"
    assert len(body["learners_list"]) == 3 and body["learners_list"][0]["average"] == 60.0
    assert body["subject_averages"] == [{"subject": "Mathematics", "average": 60.0}]
    assert body["homework"][0]["given_on_board"] is True
    assert client.get(f"/schools/{school.id}/oversight/classes/99999", headers=auth_headers(school_admin_token)).status_code == 404


def test_teachers_overview_lists_who_teaches_what(client, db_session, school, school_admin_token):
    _setup(db_session, school)
    rows = client.get(f"/schools/{school.id}/oversight/teachers", headers=auth_headers(school_admin_token)).json()
    t = next(r for r in rows if r["name"] == "Oversee Teacher")
    assert t["classes"] == ["Grade 4 Chui"] and t["class_teacher_of"] == ["Grade 4 Chui"]
    assert t["subjects"] == ["Mathematics"] and t["categories"] == ["Primary School"]
    assert t["topics_covered"] == 1 and t["topics_total"] == 2 and t["homework_week"] == 1


def test_oversight_is_not_for_teachers_or_other_schools(client, db_session, school, other_school, school_admin_token, other_school_admin_token):
    _setup(db_session, school)
    teacher, pw = _make_user(db_session, school, UserRole.TEACHER, "snoop@test-academy.test")
    h = auth_headers(_login(client, teacher.email, pw))
    assert client.get(f"/schools/{school.id}/oversight/classes", headers=h).status_code == 403
    assert client.get(f"/schools/{school.id}/oversight/teachers", headers=h).status_code == 403
    assert client.get(f"/schools/{school.id}/oversight/classes", headers=auth_headers(other_school_admin_token)).status_code == 403


def _timetable(db_session, school, d, subject_id):
    from datetime import time

    from app.models.timetable import TimetableSlot

    for cls, dow in ((d["north"], d["today"].weekday()), (d["south"], d["today"].weekday())):
        db_session.add(TimetableSlot(school_id=school.id, class_id=cls.id, subject_id=subject_id, teacher_user_id=d["teacher"].id, day_of_week=dow, start_time=time(9, 0), end_time=time(10, 0)))
    db_session.commit()


def test_homework_grid_separates_typed_board_none_and_missing(client, db_session, school, school_admin_token):
    d = _setup(db_session, school)
    if d["today"].weekday() >= 5:
        return  # the grid is a weekday view
    math = db_session.query(Subject).filter_by(school_id=school.id, name="Mathematics").one()
    _timetable(db_session, school, d, math.id)
    # Grade 4 Chui: the setup already gave board homework today. Grade 4 Simba: teacher says none.
    teacher = _login(client, d["teacher"].email, "TestPass123!")
    db_session.add(TeacherAssignment(school_id=school.id, teacher_user_id=d["teacher"].id, class_id=d["south"].id, subject_id=math.id))
    db_session.commit()
    r = client.post(f"/schools/{school.id}/homework/none", headers=auth_headers(teacher), json={"class_id": d["south"].id, "subject_id": math.id})
    assert r.status_code == 204, r.text

    grid = client.get(f"/schools/{school.id}/oversight/homework", headers=auth_headers(school_admin_token)).json()
    today_idx = d["today"].weekday()
    cells = {row["class_name"]: row["cells"][today_idx] for row in grid["rows"]}
    assert cells["Grade 4 Chui"]["status"] == "board" and cells["Grade 4 Chui"]["titles"] == ["Exercise 4"]
    assert cells["Grade 4 Simba"]["status"] == "none"
    assert grid["summary"]["board"] == 1 and grid["summary"]["none"] == 1 and grid["summary"]["missing"] == 0

    # Undoing the declaration puts the day back to "not recorded".
    client.delete(f"/schools/{school.id}/homework/none", headers=auth_headers(teacher), params={"class_id": d["south"].id, "subject_id": math.id})
    again = client.get(f"/schools/{school.id}/oversight/homework", headers=auth_headers(school_admin_token)).json()
    assert {row["class_name"]: row["cells"][today_idx]["status"] for row in again["rows"]}["Grade 4 Simba"] == "missing"


def test_a_teacher_can_log_homework_given_on_the_board(client, db_session, school):
    d = _setup(db_session, school)
    math = db_session.query(Subject).filter_by(school_id=school.id, name="Mathematics").one()
    h = auth_headers(_login(client, d["teacher"].email, "TestPass123!"))
    r = client.post(
        f"/schools/{school.id}/homework", headers=h,
        json={"class_id": d["north"].id, "subject_id": math.id, "title": "Page 52, questions 1 to 5", "due_date": str(d["today"] + timedelta(days=1)), "given_on_board": True, "allow_digital_submission": False},
    )
    assert r.status_code == 201, r.text
    assert r.json()["given_on_board"] is True
    # A teacher cannot say "no homework" for a class and subject they do not teach.
    assert client.post(f"/schools/{school.id}/homework/none", headers=h, json={"class_id": d["south"].id, "subject_id": math.id}).status_code == 403


def test_attendance_overview_shows_who_took_the_register_and_who_is_away(client, db_session, school, school_admin_token):
    d = _setup(db_session, school)
    kid = db_session.query(Student).filter_by(school_id=school.id, admission_number="O-1").one()
    rec = db_session.query(AttendanceRecord).filter_by(student_id=kid.id, date=d["today"]).one()
    rec.status, rec.reason = AttendanceStatus.ABSENT, "Malaria"
    db_session.commit()
    body = client.get(f"/schools/{school.id}/oversight/attendance", headers=auth_headers(school_admin_token)).json()
    rows = {r["class_name"]: r for r in body["rows"]}
    chui = rows["Grade 4 Chui"]
    assert chui["taken_by"] == "Oversee Teacher" and chui["absent"] == 1 and chui["present"] == 2
    assert chui["absentees"] == [{"name": "Kid1 Test", "status": "absent", "reason": "Malaria"}]
    if d["today"].weekday() < 5:
        assert rows["Grade 4 Simba"]["register_status"] == "missing"
        assert body["classes_taken"] == 1 and body["classes_total"] == 2


def test_overview_inbox_lists_what_waits_on_the_head(client, db_session, school, school_admin_token):
    from app.models.complaint import Complaint, ComplaintAudience
    from app.models.trip import Trip, TripStatus

    d = _setup(db_session, school)
    db_session.add(Complaint(school_id=school.id, raised_by=d["teacher"].id, raised_by_name="Oversee Teacher", raised_by_role="teacher", audience=ComplaintAudience.PRINCIPAL, subject="Projector", message="Broken"))
    db_session.add(
        Trip(school_id=school.id, reference="TRP-1", title="Museum", trip_type="Field trip", purpose="Learning", destination="Nairobi", start_date=d["today"] + timedelta(days=9), end_date=d["today"] + timedelta(days=9),
             departure_time="07:00", return_time="16:00", class_ids=[], student_ids=[], staff_count=2, distance_km=50, estimated_cost=10000, requested_by=d["teacher"].id, status=TripStatus.REQUESTED)
    )
    db_session.commit()
    body = client.get(f"/schools/{school.id}/oversight/overview", headers=auth_headers(school_admin_token)).json()
    assert body["inbox_counts"]["complaint"] == 1 and body["inbox_counts"]["trip"] == 1
    assert body["pulse"]["learners"] == 3 and body["pulse"]["teachers"] == 1
    kinds = {i["kind"] for i in body["inbox"]}
    assert {"complaint", "trip"} <= kinds
