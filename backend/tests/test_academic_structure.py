"""Subjects tied to grades, one class teacher per class, and class performance for the head."""

from app.models.academics import SchoolClass, Student
from app.models.grade_level import GradeLevel
from app.models.results import Result, Subject
from app.models.user import UserRole
from tests.conftest import _login, _make_user, auth_headers
from tests.test_oversight import _setup


def _grade(db, code):
    return db.query(GradeLevel).filter_by(code=code).first()


def test_a_subject_is_created_for_specific_grades_and_can_be_changed(client, db_session, school, school_admin_token):
    h = auth_headers(school_admin_token)
    g3, g4 = _grade(db_session, "G3"), _grade(db_session, "G4")
    r = client.post(f"/schools/{school.id}/subjects", json={"name": "Kiswahili", "grade_level_ids": [g3.id, g4.id]}, headers=h)
    assert r.status_code == 201, r.text
    assert r.json()["grade_level_ids"] == sorted([g3.id, g4.id])
    sid = r.json()["id"]
    r = client.patch(f"/schools/{school.id}/subjects/{sid}", json={"grade_level_ids": [g4.id]}, headers=h)
    assert r.json()["grade_level_ids"] == [g4.id]
    assert client.post(f"/schools/{school.id}/subjects", json={"name": "kiswahili"}, headers=h).status_code == 400
    assert client.post(f"/schools/{school.id}/subjects", json={"name": "Art", "grade_level_ids": [999999]}, headers=h).status_code == 400
    assert client.delete(f"/schools/{school.id}/subjects/{sid}", headers=h).status_code == 204


def test_a_subject_cannot_be_assigned_or_timetabled_in_a_grade_it_is_not_taught_in(client, db_session, school, school_admin_token):
    d = _setup(db_session, school)
    teacher = d["teacher"]
    g5 = _grade(db_session, "G5")
    science = Subject(school_id=school.id, name="Upper Primary Science")
    db_session.add(science)
    db_session.flush()
    from app.models.results import SubjectLevel

    db_session.add(SubjectLevel(subject_id=science.id, grade_level_id=g5.id))
    db_session.commit()
    h = auth_headers(school_admin_token)
    r = client.post(f"/schools/{school.id}/teacher-assignments", json={"teacher_user_id": teacher.id, "class_id": d["north"].id, "subject_id": science.id}, headers=h)
    assert r.status_code == 400 and "not taught in Grade 4 Chui" in r.json()["detail"]
    # taking a grade away while a class still uses the subject is refused
    maths = db_session.query(Subject).filter_by(school_id=school.id, name="Mathematics").first()
    g4 = _grade(db_session, "G4")
    client.patch(f"/schools/{school.id}/subjects/{maths.id}", json={"grade_level_ids": [g4.id]}, headers=h)
    r = client.patch(f"/schools/{school.id}/subjects/{maths.id}", json={"grade_level_ids": [g5.id]}, headers=h)
    assert r.status_code == 400 and "still assigned" in r.json()["detail"]


def test_a_subject_with_marks_cannot_be_deleted(client, db_session, school, school_admin_token):
    _setup(db_session, school)
    maths = db_session.query(Subject).filter_by(school_id=school.id, name="Mathematics").first()
    r = client.delete(f"/schools/{school.id}/subjects/{maths.id}", headers=auth_headers(school_admin_token))
    assert r.status_code == 400


def test_a_teacher_cannot_manage_subjects(client, db_session, school):
    t, pw = _make_user(db_session, school, UserRole.TEACHER, "subject.nosy@test-academy.test")
    h = auth_headers(_login(client, t.email, pw))
    assert client.post(f"/schools/{school.id}/subjects", json={"name": "Chess"}, headers=h).status_code == 403


def test_a_class_has_one_class_teacher_and_replacing_needs_confirmation(client, db_session, school, school_admin_token):
    h = auth_headers(school_admin_token)
    a, _ = _make_user(db_session, school, UserRole.TEACHER, "ct.a@test-academy.test")
    b, _ = _make_user(db_session, school, UserRole.TEACHER, "ct.b@test-academy.test")
    c1 = SchoolClass(school_id=school.id, name="Grade 6 East")
    c2 = SchoolClass(school_id=school.id, name="Grade 6 West")
    db_session.add_all([c1, c2])
    db_session.commit()
    base = f"/schools/{school.id}/teacher-assignments/class-teachers"
    assert client.put(f"{base}/{c1.id}", json={"teacher_user_id": a.id}, headers=h).status_code == 200
    # a second teacher for the same class is refused until the head confirms the swap
    r = client.put(f"{base}/{c1.id}", json={"teacher_user_id": b.id}, headers=h)
    assert r.status_code == 409 and "already has a class teacher" in r.json()["detail"]
    r = client.put(f"{base}/{c1.id}", json={"teacher_user_id": b.id, "replace": True}, headers=h)
    assert r.status_code == 200 and r.json()["teacher_name"] == b.full_name
    # one teacher cannot run two classes
    r = client.put(f"{base}/{c2.id}", json={"teacher_user_id": b.id}, headers=h)
    assert r.status_code == 409 and "Grade 6 East" in r.json()["detail"]
    assert client.put(f"{base}/{c1.id}", json={"teacher_user_id": None}, headers=h).status_code == 200
    rows = {x["class_name"]: x for x in client.get(base, headers=h).json()}
    assert rows["Grade 6 East"]["teacher_user_id"] is None


def test_the_head_sees_class_averages_and_top_learners_with_positions(client, db_session, school, school_admin_token):
    d = _setup(db_session, school)
    maths = db_session.query(Subject).filter_by(school_id=school.id, name="Mathematics").first()
    kids = db_session.query(Student).filter_by(class_id=d["north"].id).order_by(Student.id).all()
    for score, k in zip((95, 80, 80), kids):
        db_session.query(Result).filter_by(student_id=k.id).update({"score": score})
    db_session.commit()
    r = client.get(f"/schools/{school.id}/oversight/performance?term=Term 3", headers=auth_headers(school_admin_token))
    assert r.status_code == 200, r.text
    body = r.json()
    chui = next(c for c in body["classes"] if c["class_name"] == "Grade 4 Chui")
    assert chui["average"] == 85.0 and chui["pass_rate"] == 100.0
    assert [t["rank"] for t in chui["top"]] == [1, 2, 2]
    assert chui["top"][0]["average"] == 95.0
    assert body["school_average"] == 85.0
    assert body["top_learners"][0]["average"] == 95.0
    simba = next(c for c in body["classes"] if c["class_name"] == "Grade 4 Simba")
    assert simba["average"] is None and simba["top"] == []


def test_the_head_can_open_a_learners_full_report_card(client, db_session, school, school_admin_token):
    d = _setup(db_session, school)
    kid = db_session.query(Student).filter_by(class_id=d["north"].id).first()
    r = client.get(f"/schools/{school.id}/students/{kid.id}/report-card?term=Term 3", headers=auth_headers(school_admin_token))
    assert r.status_code == 200, r.text
    assert r.json()["rows"]
