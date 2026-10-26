"""Marking real lessons taught or not taught: the Record of Work Covered."""

from datetime import date, time, timedelta

from app.core.dates import school_today
from app.models.academic_term import AcademicTerm
from app.models.academics import SchoolClass
from app.models.calendar_event import CalendarEvent, CalendarEventType
from app.models.lesson_plan import LessonPlan, LessonPlanEntry
from app.models.results import Subject
from app.models.teacher_assignment import TeacherAssignment
from app.models.timetable import TimetableSlot
from app.models.user import UserRole
from tests.conftest import _login, _make_user, auth_headers


def _setup(db_session, school):
    teacher, pw = _make_user(db_session, school, UserRole.TEACHER, "lessons@test-academy.test")
    cls = SchoolClass(school_id=school.id, name="Grade 6 North")
    db_session.add(cls)
    db_session.flush()
    math = Subject(school_id=school.id, name="Mathematics")
    db_session.add(math)
    db_session.flush()
    db_session.add(TeacherAssignment(school_id=school.id, teacher_user_id=teacher.id, class_id=cls.id, subject_id=math.id))
    today = school_today(db_session, school.id)
    slot = TimetableSlot(
        school_id=school.id, class_id=cls.id, subject_id=math.id, teacher_user_id=teacher.id,
        day_of_week=today.weekday(), start_time=time(9, 0), end_time=time(10, 0), room="6N",
    )
    db_session.add(slot)
    plan = LessonPlan(school_id=school.id, class_id=cls.id, subject_id=math.id, term="Term 3", created_by=teacher.id)
    db_session.add(plan)
    db_session.flush()
    entries = [
        LessonPlanEntry(lesson_plan_id=plan.id, order=i, label=f"Week {i}", topic=t)
        for i, t in enumerate(["Fractions", "Decimals", "Percentages"], start=1)
    ]
    db_session.add_all(entries)
    db_session.add(AcademicTerm(school_id=school.id, name="Term 3", start_date=today - timedelta(days=30), end_date=today + timedelta(days=60), is_current=True))
    db_session.commit()
    return {"teacher": teacher, "pw": pw, "slot": slot, "plan": plan, "entries": entries, "today": today, "cls": cls, "math": math}


def _headers(client, d):
    return auth_headers(_login(client, d["teacher"].email, d["pw"]))


def test_today_shows_the_next_planned_topic(client, db_session, school):
    d = _setup(db_session, school)
    r = client.get(f"/schools/{school.id}/lessons/day", headers=_headers(client, d))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["is_today"] is True and len(body["lessons"]) == 1
    lesson = body["lessons"][0]
    assert lesson["entry"]["topic"] == "Fractions"
    assert lesson["delivery"] is None
    assert lesson["plan"]["entry_count"] == 3


def test_marking_taught_covers_the_topic_and_moves_on(client, db_session, school):
    d = _setup(db_session, school)
    h = _headers(client, d)
    day = f"/schools/{school.id}/lessons/day"
    entry = client.get(day, headers=h).json()["lessons"][0]["entry"]
    r = client.post(
        f"/schools/{school.id}/lessons/deliveries",
        json={"timetable_slot_id": d["slot"].id, "lesson_date": d["today"].isoformat(), "status": "taught", "entry_id": entry["id"], "remark": "Good grasp"},
        headers=h,
    )
    assert r.status_code == 201, r.text
    db_session.expire_all()
    assert db_session.get(LessonPlanEntry, entry["id"]).status.value == "completed"
    again = client.get(day, headers=h).json()["lessons"][0]
    assert again["delivery"]["status"] == "taught" and again["delivery"]["topic"] == "Fractions"
    assert again["plan"]["completed_count"] == 1

    # Undo puts the topic back so it is taught next.
    assert client.delete(f"/schools/{school.id}/lessons/deliveries/{again['delivery']['id']}", headers=h).status_code == 204
    db_session.expire_all()
    assert db_session.get(LessonPlanEntry, entry["id"]).status.value == "planned"


def test_not_taught_needs_a_reason_and_leaves_the_topic_for_next_time(client, db_session, school):
    d = _setup(db_session, school)
    h = _headers(client, d)
    payload = {"timetable_slot_id": d["slot"].id, "lesson_date": d["today"].isoformat(), "status": "not_taught"}
    assert client.post(f"/schools/{school.id}/lessons/deliveries", json=payload, headers=h).status_code == 400
    ok = client.post(f"/schools/{school.id}/lessons/deliveries", json={**payload, "reason": "exams"}, headers=h)
    assert ok.status_code == 201
    db_session.expire_all()
    assert all(e.status.value == "planned" for e in db_session.query(LessonPlanEntry).all())


def test_cannot_mark_other_teachers_lessons_or_the_future(client, db_session, school):
    d = _setup(db_session, school)
    other, pw = _make_user(db_session, school, UserRole.TEACHER, "someoneelse@test-academy.test")
    oh = auth_headers(_login(client, other.email, pw))
    body = {"timetable_slot_id": d["slot"].id, "lesson_date": d["today"].isoformat(), "status": "taught"}
    assert client.post(f"/schools/{school.id}/lessons/deliveries", json=body, headers=oh).status_code == 403

    h = _headers(client, d)
    future = d["today"] + timedelta(days=7)  # same weekday, but not yet
    assert client.post(f"/schools/{school.id}/lessons/deliveries", json={**body, "lesson_date": future.isoformat()}, headers=h).status_code == 400
    wrong_day = d["today"] - timedelta(days=1)
    assert client.post(f"/schools/{school.id}/lessons/deliveries", json={**body, "lesson_date": wrong_day.isoformat()}, headers=h).status_code == 400


def test_holiday_is_reported_for_the_day(client, db_session, school):
    d = _setup(db_session, school)
    db_session.add(CalendarEvent(school_id=school.id, title="Mashujaa Day", event_type=CalendarEventType.HOLIDAY, start_date=d["today"]))
    db_session.commit()
    body = client.get(f"/schools/{school.id}/lessons/day", headers=_headers(client, d)).json()
    assert body["holiday"] == "Mashujaa Day"


def test_record_of_work_and_head_coverage(client, db_session, school, school_admin_token):
    d = _setup(db_session, school)
    h = _headers(client, d)
    entry = client.get(f"/schools/{school.id}/lessons/day", headers=h).json()["lessons"][0]["entry"]
    client.post(
        f"/schools/{school.id}/lessons/deliveries",
        json={"timetable_slot_id": d["slot"].id, "lesson_date": d["today"].isoformat(), "status": "taught", "entry_id": entry["id"]},
        headers=h,
    )
    mine = client.get(f"/schools/{school.id}/lessons/deliveries", headers=h).json()
    assert [r["topic"] for r in mine] == ["Fractions"]

    cov = client.get(f"/schools/{school.id}/lessons/coverage", params={"term": "Term 3"}, headers=auth_headers(school_admin_token)).json()
    row = cov["rows"][0]
    assert (row["teacher_name"], row["entry_count"], row["completed_count"], row["taught"]) == ("Lessons", 3, 1, 1)
    assert row["expected_covered"] == 1  # a third of the way through the term, of 3 entries
    # Teachers do not get the school-wide view.
    assert client.get(f"/schools/{school.id}/lessons/coverage", params={"term": "Term 3"}, headers=h).status_code == 403


def test_reorder_and_duplicate_a_plan(client, db_session, school):
    d = _setup(db_session, school)
    h = _headers(client, d)
    ids = [e.id for e in d["entries"]]
    r = client.patch(f"/schools/{school.id}/lesson-plans/{d['plan'].id}/entries/reorder", json={"entry_ids": ids[::-1]}, headers=h)
    assert r.status_code == 200, r.text
    assert [e["topic"] for e in r.json()["entries"]] == ["Percentages", "Decimals", "Fractions"]
    assert client.patch(f"/schools/{school.id}/lesson-plans/{d['plan'].id}/entries/reorder", json={"entry_ids": ids[:2]}, headers=h).status_code == 400

    dup = client.post(
        f"/schools/{school.id}/lesson-plans/{d['plan'].id}/duplicate",
        json={"class_id": d["cls"].id, "subject_id": d["math"].id, "term": "Term 1 next year"},
        headers=h,
    )
    assert dup.status_code == 201, dup.text
    assert [e["status"] for e in dup.json()["entries"]] == ["planned"] * 3
    again = client.post(
        f"/schools/{school.id}/lesson-plans/{d['plan'].id}/duplicate",
        json={"class_id": d["cls"].id, "subject_id": d["math"].id, "term": "Term 1 next year"},
        headers=h,
    )
    assert again.status_code == 400
