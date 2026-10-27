"""The school day (lessons, breaks, prep) set per level, and the secretary's approval path."""

from app.models.academics import SchoolClass
from app.models.grade_level import GradeLevel
from app.models.results import Subject
from app.models.timetable import TimetableSlot
from app.models.user import UserRole
from tests.conftest import _login, _make_user, auth_headers


def _day(client, school, headers, level="primary", with_prep=False):
    r = client.get(f"/schools/{school.id}/timetable/periods/template?level_group={level}&with_prep={str(with_prep).lower()}", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def _world(db, school):
    grade = db.query(GradeLevel).filter_by(code="G4").first()
    cls = SchoolClass(school_id=school.id, name="Grade 4 Day", grade_level_id=grade.id)
    maths = Subject(school_id=school.id, name="Maths Day")
    db.add_all([cls, maths])
    db.commit()
    return cls, maths


def test_the_template_includes_breaks_and_optional_prep(client, school, school_admin_token):
    h = auth_headers(school_admin_token)
    plain = _day(client, school, h)
    assert {"lesson", "break", "lunch"} <= {p["kind"] for p in plain}
    assert "prep" not in {p["kind"] for p in plain}
    assert "prep" in {p["kind"] for p in _day(client, school, h, with_prep=True)}


def test_the_head_sets_the_day_and_lessons_take_their_times_from_it(client, db_session, school, school_admin_token):
    h = auth_headers(school_admin_token)
    cls, maths = _world(db_session, school)
    teacher, _ = _make_user(db_session, school, UserRole.TEACHER, "bell.teacher@test-academy.test")
    r = client.put(f"/schools/{school.id}/timetable/periods/primary", json={"periods": _day(client, school, h)}, headers=h)
    assert r.status_code == 200 and r.json()["applied"] is True
    periods = client.get(f"/schools/{school.id}/timetable/periods", headers=h).json()
    lesson = next(p for p in periods if p["name"] == "Lesson 1")
    brk = next(p for p in periods if p["kind"] == "break")
    body = {"class_id": cls.id, "subject_id": maths.id, "teacher_user_id": teacher.id, "day_of_week": 0, "period_id": lesson["id"]}
    r = client.post(f"/schools/{school.id}/timetable", json=body, headers=h)
    assert r.status_code == 201, r.text
    assert r.json()["start_time"].startswith("08:00") and r.json()["end_time"].startswith("08:40")
    # a break cannot be teached, and raw times are refused once the day is set
    assert client.post(f"/schools/{school.id}/timetable", json={**body, "period_id": brk["id"]}, headers=h).status_code == 400
    assert client.post(f"/schools/{school.id}/timetable", json={**{k: v for k, v in body.items() if k != "period_id"}, "start_time": "08:00", "end_time": "08:40"}, headers=h).status_code == 400
    # same class, same block, same day collides
    r = client.post(f"/schools/{school.id}/timetable", json=body, headers=h)
    assert r.status_code == 400 and "already has" in r.json()["detail"]


def test_two_classes_cannot_share_one_teacher_in_the_same_block(client, db_session, school, school_admin_token):
    h = auth_headers(school_admin_token)
    cls, maths = _world(db_session, school)
    other = SchoolClass(school_id=school.id, name="Grade 4 Night", grade_level_id=cls.grade_level_id)
    teacher, _ = _make_user(db_session, school, UserRole.TEACHER, "double.booked@test-academy.test")
    db_session.add(other)
    db_session.commit()
    client.put(f"/schools/{school.id}/timetable/periods/primary", json={"periods": _day(client, school, h)}, headers=h)
    lesson = next(p for p in client.get(f"/schools/{school.id}/timetable/periods", headers=h).json() if p["name"] == "Lesson 2")
    a = {"class_id": cls.id, "subject_id": maths.id, "teacher_user_id": teacher.id, "day_of_week": 1, "period_id": lesson["id"]}
    assert client.post(f"/schools/{school.id}/timetable", json=a, headers=h).status_code == 201
    r = client.post(f"/schools/{school.id}/timetable", json={**a, "class_id": other.id}, headers=h)
    assert r.status_code == 400 and "already teaching" in r.json()["detail"]


def test_overlapping_blocks_are_rejected(client, school, school_admin_token):
    h = auth_headers(school_admin_token)
    bad = [
        {"name": "A", "kind": "lesson", "start_time": "08:00", "end_time": "09:00", "days": [0]},
        {"name": "B", "kind": "lesson", "start_time": "08:30", "end_time": "09:30", "days": [0]},
    ]
    r = client.put(f"/schools/{school.id}/timetable/periods/primary", json={"periods": bad}, headers=h)
    assert r.status_code == 422 and "overlap" in r.json()["detail"]


def test_changing_the_day_moves_existing_lessons_with_their_block(client, db_session, school, school_admin_token):
    h = auth_headers(school_admin_token)
    cls, maths = _world(db_session, school)
    day = _day(client, school, h)
    client.put(f"/schools/{school.id}/timetable/periods/primary", json={"periods": day}, headers=h)
    lesson = next(p for p in client.get(f"/schools/{school.id}/timetable/periods", headers=h).json() if p["name"] == "Lesson 1")
    client.post(f"/schools/{school.id}/timetable", json={"class_id": cls.id, "subject_id": maths.id, "day_of_week": 2, "period_id": lesson["id"]}, headers=h)
    later = [dict(p) for p in day]
    for p in later:
        if p["name"] == "Lesson 1":
            p["start_time"], p["end_time"] = "07:50", "08:30"
        if p["name"] == "Assembly":
            p["start_time"], p["end_time"] = "07:30", "07:50"
    r = client.put(f"/schools/{school.id}/timetable/periods/primary", json={"periods": later}, headers=h)
    assert r.status_code == 200, r.text
    db_session.expire_all()
    slot = db_session.query(TimetableSlot).filter_by(class_id=cls.id).one()
    assert slot.start_time.isoformat().startswith("07:50")


def test_the_secretary_proposes_a_day_and_it_only_takes_effect_when_the_head_approves(client, db_session, school, school_admin_token):
    head = auth_headers(school_admin_token)
    sec, pw = _make_user(db_session, school, UserRole.SECRETARY, "desk.bell@test-academy.test")
    desk = auth_headers(_login(client, sec.email, pw))
    r = client.put(f"/schools/{school.id}/timetable/periods/junior_school", json={"periods": _day(client, school, desk, "junior_school")}, headers=desk)
    assert r.status_code == 200 and r.json()["applied"] is False
    rid = r.json()["request_id"]
    assert client.get(f"/schools/{school.id}/timetable/periods", headers=head).json() == []
    pending = client.get(f"/schools/{school.id}/approvals?pending_only=true", headers=head).json()
    assert [p["id"] for p in pending] == [rid]
    inbox = client.get(f"/schools/{school.id}/oversight/overview", headers=head).json()["inbox"]
    assert any(i["kind"] == "approval" for i in inbox)
    # the secretary cannot approve their own proposal
    assert client.post(f"/schools/{school.id}/approvals/{rid}/approve", headers=desk).status_code == 403
    r = client.post(f"/schools/{school.id}/approvals/{rid}/approve", json={"note": "Looks right"}, headers=head)
    assert r.status_code == 200 and r.json()["status"] == "approved"
    assert any(p["level_group"] == "junior_school" for p in client.get(f"/schools/{school.id}/timetable/periods", headers=head).json())
    assert client.post(f"/schools/{school.id}/approvals/{rid}/approve", headers=head).status_code == 409


def test_a_declined_proposal_changes_nothing(client, db_session, school, school_admin_token):
    head = auth_headers(school_admin_token)
    sec, pw = _make_user(db_session, school, UserRole.SECRETARY, "desk.decline@test-academy.test")
    desk = auth_headers(_login(client, sec.email, pw))
    rid = client.put(f"/schools/{school.id}/timetable/periods/primary", json={"periods": _day(client, school, desk)}, headers=desk).json()["request_id"]
    r = client.post(f"/schools/{school.id}/approvals/{rid}/reject", json={"note": "Lunch is too short"}, headers=head)
    assert r.status_code == 200 and r.json()["status"] == "rejected"
    assert client.get(f"/schools/{school.id}/timetable/periods", headers=head).json() == []
    mine = client.get(f"/schools/{school.id}/approvals", headers=desk).json()
    assert mine[0]["decision_note"] == "Lunch is too short"
