"""Awards by scope (learner / class / school / staff) and activities with an owner."""

from datetime import date

from app.models.academics import SchoolClass, Student
from app.models.academic_term import AcademicTerm
from app.models.results import Subject
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import UserRole
from tests.conftest import _login, _make_user, auth_headers


def _setup(db_session, school):
    class_teacher, ct_pw = _make_user(db_session, school, UserRole.TEACHER, "classteacher2@test-academy.test")
    subject_teacher, st_pw = _make_user(db_session, school, UserRole.TEACHER, "subjectteacher2@test-academy.test")
    north = SchoolClass(school_id=school.id, name="Grade 6 North", homeroom_teacher_id=class_teacher.id)
    south = SchoolClass(school_id=school.id, name="Grade 6 South")
    db_session.add_all([north, south])
    db_session.flush()
    math = Subject(school_id=school.id, name="Mathematics")
    db_session.add(math)
    db_session.flush()
    db_session.add(TeacherAssignment(school_id=school.id, teacher_user_id=subject_teacher.id, class_id=north.id, subject_id=math.id))
    amina = Student(school_id=school.id, class_id=north.id, admission_number="A-1", first_name="Amina", last_name="K")
    brian = Student(school_id=school.id, class_id=south.id, admission_number="B-1", first_name="Brian", last_name="K")
    db_session.add_all([amina, brian])
    db_session.add(AcademicTerm(school_id=school.id, name="Term 3", start_date=date(2020, 1, 1), end_date=date(2099, 12, 31), is_current=True))
    db_session.commit()
    return dict(ct=(class_teacher, ct_pw), st=(subject_teacher, st_pw), north=north, south=south, math=math, amina=amina, brian=brian)


def _h(client, pair):
    return auth_headers(_login(client, pair[0].email, pair[1]))


def _post(client, school, headers, **body):
    return client.post(f"/schools/{school.id}/awards", headers=headers, json={"title": "Well done", "date_awarded": str(date.today()), **body})


def test_class_teacher_awards_their_class_but_not_another(client, db_session, school):
    d = _setup(db_session, school)
    h = _h(client, d["ct"])
    ok = _post(client, school, h, class_id=d["north"].id)
    assert ok.status_code == 201, ok.text
    assert ok.json()["scope"] == "class" and ok.json()["term"] == "Term 3"
    assert ok.json()["recipient_name"].startswith("Grade 6 North")
    assert _post(client, school, h, class_id=d["south"].id).status_code == 403
    assert _post(client, school, h, student_id=d["brian"].id).status_code == 403


def test_subject_teacher_can_award_a_learner_with_their_subject_but_not_the_class(client, db_session, school):
    d = _setup(db_session, school)
    h = _h(client, d["st"])
    ok = _post(client, school, h, student_id=d["amina"].id, subject_id=d["math"].id, category="Academic excellence")
    assert ok.status_code == 201, ok.text
    assert ok.json()["subject_name"] == "Mathematics"
    assert _post(client, school, h, class_id=d["north"].id).status_code == 403  # not the class teacher


def test_whole_school_and_staff_awards_are_for_leadership_only(client, db_session, school, school_admin_token):
    d = _setup(db_session, school)
    teacher = _h(client, d["ct"])
    assert _post(client, school, teacher, scope="school").status_code == 403
    head = auth_headers(school_admin_token)
    r = _post(client, school, head, scope="school", title="Founder's Day Honours")
    assert r.status_code == 201, r.text
    assert r.json()["recipient_name"] == "Whole school"


def test_visibility_class_and_school_awards_reach_the_right_people(client, db_session, school, school_admin_token):
    d = _setup(db_session, school)
    head = auth_headers(school_admin_token)
    _post(client, school, head, scope="school", title="Everyone")
    _post(client, school, head, class_id=d["north"].id, title="North only")
    mine = client.get(f"/schools/{school.id}/awards", headers=_h(client, d["ct"])).json()
    assert {a["title"] for a in mine} == {"Everyone", "North only"}
    # A learner's profile: own + their class + school awards.
    profile = client.get(f"/schools/{school.id}/awards", params={"student_id": d["amina"].id, "include_shared": True}, headers=head).json()
    assert {a["title"] for a in profile} == {"Everyone", "North only"}
    other = client.get(f"/schools/{school.id}/awards", params={"student_id": d["brian"].id, "include_shared": True}, headers=head).json()
    assert {a["title"] for a in other} == {"Everyone"}


def test_a_giver_can_undo_their_own_award_but_not_someone_elses(client, db_session, school, school_admin_token):
    d = _setup(db_session, school)
    mine = _post(client, school, _h(client, d["ct"]), student_id=d["amina"].id).json()
    heads = _post(client, school, auth_headers(school_admin_token), scope="school").json()
    h = _h(client, d["ct"])
    assert client.delete(f"/schools/{school.id}/awards/{heads['id']}", headers=h).status_code == 403
    assert client.delete(f"/schools/{school.id}/awards/{mine['id']}", headers=h).status_code == 204


def test_activity_results_become_awards_for_participants_only(client, db_session, school):
    d = _setup(db_session, school)
    staff, pw = _make_user(db_session, school, UserRole.STAFF, "sports@test-academy.test")
    h = auth_headers(_login(client, staff.email, pw))
    act = client.post(f"/schools/{school.id}/activities", headers=h, json={"name": "Sports Day", "category": "Sports", "date": str(date.today()), "scope": "school"})
    assert act.status_code == 201, act.text
    aid = act.json()["id"]
    assert client.post(f"/schools/{school.id}/activities/{aid}/participants", headers=h, json={"student_id": d["amina"].id, "role": "100m"}).status_code == 201
    ok = client.post(f"/schools/{school.id}/activities/{aid}/awards", headers=h, json={"awards": [{"student_id": d["amina"].id, "title": "1st place, 100m"}]})
    assert ok.status_code == 201, ok.text
    assert ok.json()[0]["category"] == "Sports" and ok.json()[0]["activity_id"] == aid
    bad = client.post(f"/schools/{school.id}/activities/{aid}/awards", headers=h, json={"awards": [{"student_id": d["brian"].id, "title": "Winner"}]})
    assert bad.status_code == 400
    # Another teacher cannot change an activity they don't run.
    other = _h(client, d["st"])
    assert client.post(f"/schools/{school.id}/activities/{aid}/participants", headers=other, json={"student_id": d["brian"].id}).status_code == 403


def test_teachers_cannot_create_whole_school_activities_and_class_activities_stay_in_class(client, db_session, school):
    d = _setup(db_session, school)
    h = _h(client, d["ct"])
    assert client.post(f"/schools/{school.id}/activities", headers=h, json={"name": "X", "date": str(date.today()), "scope": "school"}).status_code == 403
    ok = client.post(f"/schools/{school.id}/activities", headers=h, json={"name": "Class quiz", "date": str(date.today()), "scope": "class", "class_id": d["north"].id})
    assert ok.status_code == 201, ok.text
    assert client.post(f"/schools/{school.id}/activities/{ok.json()['id']}/participants", headers=h, json={"student_id": d["brian"].id}).status_code == 400
