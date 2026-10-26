"""Results are recorded per exam type; the class teacher gets a read-only
board of every learner against every subject, best first, and can compile
any mix of exam types into one figure."""

from app.models.academics import SchoolClass, Student
from app.models.results import Result, Subject
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import UserRole
from tests.conftest import _login, _make_user, auth_headers


def _setup(db_session, school):
    class_teacher, ct_pw = _make_user(db_session, school, UserRole.TEACHER, "classteacher@test-academy.test")
    math_teacher, mt_pw = _make_user(db_session, school, UserRole.TEACHER, "mathteacher@test-academy.test")
    cls = SchoolClass(school_id=school.id, name="Grade 6 North", homeroom_teacher_id=class_teacher.id)
    db_session.add(cls)
    db_session.flush()
    math = Subject(school_id=school.id, name="Mathematics")
    english = Subject(school_id=school.id, name="English")
    db_session.add_all([math, english])
    db_session.flush()
    db_session.add(TeacherAssignment(school_id=school.id, teacher_user_id=math_teacher.id, class_id=cls.id, subject_id=math.id))
    db_session.add(TeacherAssignment(school_id=school.id, teacher_user_id=math_teacher.id, class_id=cls.id, subject_id=english.id))
    students = []
    for i, name in enumerate(["Amina", "Brian", "Cynthia"]):
        s = Student(school_id=school.id, class_id=cls.id, admission_number=f"S-{i}", first_name=name, last_name="Test")
        db_session.add(s)
        students.append(s)
    db_session.commit()
    return {"ct": (class_teacher, ct_pw), "mt": (math_teacher, mt_pw), "cls": cls, "math": math, "english": english, "students": students}


def _post(client, school, token, student, subject, exam_type, score, term="Term 3"):
    return client.post(
        f"/schools/{school.id}/results",
        json={"student_id": student.id, "subject_id": subject.id, "term": term, "exam_type": exam_type, "score": score},
        headers=auth_headers(token),
    )


def test_one_subject_can_hold_a_mark_per_exam_type(client, db_session, school):
    d = _setup(db_session, school)
    token = _login(client, d["mt"][0].email, d["mt"][1])
    amina = d["students"][0]
    assert _post(client, school, token, amina, d["math"], "CAT 1", 40).status_code == 200
    assert _post(client, school, token, amina, d["math"], "Mid Term", 80).status_code == 200
    # Re-submitting the same type corrects it instead of duplicating.
    assert _post(client, school, token, amina, d["math"], "CAT 1", 50).status_code == 200
    rows = db_session.query(Result).filter_by(student_id=amina.id, subject_id=d["math"].id).all()
    assert sorted((r.exam_type, float(r.score)) for r in rows) == [("CAT 1", 50.0), ("Mid Term", 80.0)]

    listed = client.get(f"/schools/{school.id}/results", params={"term": "Term 3", "exam_type": "Mid Term"}, headers=auth_headers(token))
    assert [float(r["score"]) for r in listed.json()] == [80.0]


def test_board_ranks_best_first_and_compiles_chosen_exam_types(client, db_session, school):
    d = _setup(db_session, school)
    mt = _login(client, d["mt"][0].email, d["mt"][1])
    amina, brian, cynthia = d["students"]
    for student, cat, mid in ((amina, 40, 80), (brian, 90, 50), (cynthia, 60, 60)):
        _post(client, school, mt, student, d["math"], "CAT 1", cat)
        _post(client, school, mt, student, d["math"], "Mid Term", mid)
    _post(client, school, mt, amina, d["english"], "Mid Term", 70)

    ct = _login(client, d["ct"][0].email, d["ct"][1])
    url = f"/schools/{school.id}/classes/{d['cls'].id}/results-board"

    only_mid = client.get(url, params={"term": "Term 3", "exam_types": "Mid Term"}, headers=auth_headers(ct)).json()
    assert [s["name"].split()[0] for s in only_mid["students"]] == ["Amina", "Cynthia", "Brian"]
    assert [s["rank"] for s in only_mid["students"]] == [1, 2, 3]
    assert only_mid["available_exam_types"] == ["CAT 1", "Mid Term"]
    assert [s["name"] for s in only_mid["subjects"]] == ["English", "Mathematics"]

    both = client.get(url, params={"term": "Term 3", "exam_types": "CAT 1,Mid Term"}, headers=auth_headers(ct)).json()
    by_name = {s["name"].split()[0]: s for s in both["students"]}
    assert by_name["Brian"]["scores"][str(d["math"].id)] == 70.0  # (90 + 50) / 2
    assert by_name["Cynthia"]["average"] == 60.0
    # Amina: math 60 and english 70 -> a subject with two papers is not counted twice.
    assert by_name["Amina"]["average"] == 65.0
    assert by_name["Amina"]["total"] == 130.0


def test_board_is_for_the_class_teacher_and_leadership_only(client, db_session, school, school_admin_token):
    d = _setup(db_session, school)
    url = f"/schools/{school.id}/classes/{d['cls'].id}/results-board"
    other = _login(client, d["mt"][0].email, d["mt"][1])  # teaches subjects, but is not the class teacher
    assert client.get(url, params={"term": "Term 3"}, headers=auth_headers(other)).status_code == 403
    assert client.get(url, params={"term": "Term 3"}, headers=auth_headers(school_admin_token)).status_code == 200


def test_class_teacher_cannot_change_marks_entered_by_the_subject_teacher(client, db_session, school):
    d = _setup(db_session, school)
    amina = d["students"][0]
    mt = _login(client, d["mt"][0].email, d["mt"][1])
    assert _post(client, school, mt, amina, d["math"], "Mid Term", 70).status_code == 200

    # The class teacher also teaches Mathematics here, which would normally allow grading it...
    db_session.add(TeacherAssignment(school_id=school.id, teacher_user_id=d["ct"][0].id, class_id=d["cls"].id, subject_id=d["math"].id))
    db_session.commit()
    ct = _login(client, d["ct"][0].email, d["ct"][1])
    blocked = _post(client, school, ct, amina, d["math"], "Mid Term", 99)
    assert blocked.status_code == 403
    assert float(db_session.query(Result).filter_by(student_id=amina.id).one().score) == 70.0
    # ...but they can still enter marks that nobody else has entered.
    assert _post(client, school, ct, amina, d["math"], "CAT 1", 55).status_code == 200
    # And the subject teacher can still correct their own marks.
    assert _post(client, school, mt, amina, d["math"], "Mid Term", 75).status_code == 200


def test_class_subjects_come_from_the_class_allocation(client, db_session, school, school_admin_token):
    d = _setup(db_session, school)
    r = client.get(f"/schools/{school.id}/classes/{d['cls'].id}/subjects", headers=auth_headers(school_admin_token))
    assert [s["name"] for s in r.json()] == ["English", "Mathematics"]


def test_report_card_averages_chosen_exam_types(client, db_session, school, school_admin_token):
    d = _setup(db_session, school)
    mt = _login(client, d["mt"][0].email, d["mt"][1])
    amina = d["students"][0]
    _post(client, school, mt, amina, d["math"], "CAT 1", 40)
    _post(client, school, mt, amina, d["math"], "Mid Term", 80)
    url = f"/schools/{school.id}/students/{amina.id}/report-card"
    everything = client.get(url, params={"term": "Term 3"}, headers=auth_headers(school_admin_token)).json()
    assert everything["rows"][0]["score"] == 60.0
    just_mid = client.get(url, params={"term": "Term 3", "exam_types": "Mid Term"}, headers=auth_headers(school_admin_token)).json()
    assert just_mid["rows"][0]["score"] == 80.0
