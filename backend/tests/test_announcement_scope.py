"""Announcements reach only the people they are addressed to, and a teacher
can only write to the learners or parents of a class they teach."""

from datetime import date

from app.models.academics import SchoolClass, Student
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import UserRole
from tests.conftest import _login, _make_user, auth_headers


def _post(client, school, headers, **body):
    return client.post(f"/schools/{school.id}/announcements", headers=headers, json={"title": "Note", "body": "Hello", "audience": "all", **body})


def _setup(db_session, school):
    teacher, tpw = _make_user(db_session, school, UserRole.TEACHER, "ann.teacher@test-academy.test")
    other, opw = _make_user(db_session, school, UserRole.TEACHER, "ann.other@test-academy.test")
    parent, ppw = _make_user(db_session, school, UserRole.PARENT, "ann.parent@test-academy.test")
    mine = SchoolClass(school_id=school.id, name="Grade 6 North", homeroom_teacher_id=teacher.id)
    theirs = SchoolClass(school_id=school.id, name="Grade 6 South")
    db_session.add_all([mine, theirs])
    db_session.flush()
    db_session.add(TeacherAssignment(school_id=school.id, teacher_user_id=other.id, class_id=theirs.id, subject_id=None))
    db_session.add(Student(school_id=school.id, class_id=mine.id, admission_number="P-1", first_name="Kid", last_name="One", guardian_user_id=parent.id))
    db_session.add(Student(school_id=school.id, class_id=theirs.id, admission_number="P-2", first_name="Kid", last_name="Two"))
    db_session.commit()
    return dict(teacher=(teacher, tpw), other=(other, opw), parent=(parent, ppw), mine=mine, theirs=theirs)


def _h(client, pair):
    return auth_headers(_login(client, pair[0].email, pair[1]))


def test_teacher_can_only_write_to_their_own_class(client, db_session, school):
    d = _setup(db_session, school)
    h = _h(client, d["teacher"])
    assert _post(client, school, h, audience="all").status_code == 403
    assert _post(client, school, h, audience="staff").status_code == 403
    assert _post(client, school, h, audience="parents").status_code == 403            # needs a class
    assert _post(client, school, h, audience="parents", class_id=d["theirs"].id).status_code == 403
    assert _post(client, school, h, audience="parents", class_id=d["mine"].id).status_code == 201


def test_people_only_see_what_was_addressed_to_them(client, db_session, school, school_admin_token):
    d = _setup(db_session, school)
    head = auth_headers(school_admin_token)
    _post(client, school, head, title="Whole school", audience="all")
    _post(client, school, head, title="Teachers only", audience="teachers")
    _post(client, school, head, title="Parents of North", audience="parents", class_id=d["mine"].id)
    _post(client, school, head, title="Parents of South", audience="parents", class_id=d["theirs"].id)

    def titles(pair):
        r = client.get(f"/schools/{school.id}/announcements", headers=_h(client, pair))
        return {a["title"] for a in r.json()}

    assert titles(d["parent"]) == {"Whole school", "Parents of North"}
    assert titles(d["teacher"]) == {"Whole school", "Teachers only", "Parents of North"}
    assert titles(d["other"]) == {"Whole school", "Teachers only", "Parents of South"}
    everyone = client.get(f"/schools/{school.id}/announcements", headers=head).json()
    assert len(everyone) == 4


def test_every_staff_role_reads_notices_and_the_sender_can_pick_roles(client, db_session, school, school_admin_token):
    bursar, bpw = _make_user(db_session, school, UserRole.BURSAR, "ann.bursar@test-academy.test")
    guard, gpw = _make_user(db_session, school, UserRole.SECURITY, "ann.guard@test-academy.test")
    admin = auth_headers(school_admin_token)
    assert _post(client, school, admin, title="For all staff", audience="staff").status_code == 201
    assert _post(client, school, admin, title="Gate only", audience="staff", target_roles=["security"]).status_code == 201
    assert _post(client, school, admin, title="Nonsense", audience="staff", target_roles=["parent"]).status_code == 400
    assert _post(client, school, admin, title="Wrong audience", audience="parents", target_roles=["security"]).status_code == 400

    def titles(pair):
        r = client.get(f"/schools/{school.id}/announcements", headers=_h(client, pair))
        assert r.status_code == 200, r.text
        return {a["title"] for a in r.json()}

    assert titles((bursar, bpw)) == {"For all staff"}
    assert titles((guard, gpw)) == {"For all staff", "Gate only"}
