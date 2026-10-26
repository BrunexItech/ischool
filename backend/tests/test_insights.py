"""The Analytics insights view: scorecard, what needs attention, comparisons —
all derived from the school's own records, and scoped for teachers."""

from datetime import timedelta

from app.core.dates import school_today
from app.models.academic_term import AcademicTerm
from app.models.academics import SchoolClass, Student
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.results import Result, Subject
from app.models.teacher_assignment import TeacherAssignment
from app.models.user import UserRole
from tests.conftest import _login, _make_user, auth_headers


def _setup(db_session, school):
    today = school_today(db_session, school.id)
    db_session.add(AcademicTerm(school_id=school.id, name="Term 2", start_date=today - timedelta(days=150), end_date=today - timedelta(days=61)))
    db_session.add(AcademicTerm(school_id=school.id, name="Term 3", start_date=today - timedelta(days=60), end_date=today + timedelta(days=30), is_current=True))
    north = SchoolClass(school_id=school.id, name="Grade 6 North")
    south = SchoolClass(school_id=school.id, name="Grade 6 South")
    db_session.add_all([north, south])
    db_session.flush()
    math = Subject(school_id=school.id, name="Mathematics")
    english = Subject(school_id=school.id, name="English")
    db_session.add_all([math, english])
    db_session.flush()
    learners = []
    for i in range(5):
        s = Student(school_id=school.id, class_id=north.id, admission_number=f"N-{i}", first_name=f"North{i}", last_name="Kid")
        db_session.add(s)
        learners.append(s)
    other = Student(school_id=school.id, class_id=south.id, admission_number="S-0", first_name="South", last_name="Kid")
    db_session.add(other)
    db_session.flush()

    def score(student, subject, term, exam_type, value):
        db_session.add(Result(school_id=school.id, student_id=student.id, subject_id=subject.id, term=term, exam_type=exam_type, score=value))

    for i, s in enumerate(learners):
        score(s, math, "Term 2", "End Term", 70)
        score(s, math, "Term 3", "CAT 1", 40 if i == 0 else 70)   # learner 0 drops 30 points
        score(s, math, "Term 3", "Mid Term", 40 if i == 0 else 80)
        score(s, english, "Term 3", "Mid Term", 30 if i < 4 else 90)  # English is weak in North
    score(other, math, "Term 3", "Mid Term", 95)

    # learner 1 has been absent the last four school days
    for k in range(4):
        d = today - timedelta(days=k)
        for i, s in enumerate(learners):
            status = AttendanceStatus.ABSENT if i == 1 else AttendanceStatus.PRESENT
            db_session.add(AttendanceRecord(school_id=school.id, class_id=north.id, student_id=s.id, date=d, status=status, reason="Malaria" if i == 1 else None))
    db_session.commit()
    return {"north": north, "south": south, "math": math, "english": english, "learners": learners, "today": today}


def _get(client, school, token, **params):
    return client.get(f"/schools/{school.id}/analytics/insights", params={"term": "Term 3", **params}, headers=auth_headers(token))


def test_scorecard_and_attention(client, db_session, school, school_admin_token):
    d = _setup(db_session, school)
    r = _get(client, school, school_admin_token)
    assert r.status_code == 200, r.text
    body = r.json()
    card = body["scorecard"]
    assert card["previous_term"] == "Term 2"
    assert card["average"]["previous"] == 70.0
    assert card["learners"] == 6

    attention = body["attention"]
    assert [x["name"] for x in attention["dropped_learners"]][:1] == ["North0 Kid"]
    assert attention["absence_streaks"][0]["name"] == "North1 Kid"
    assert attention["absence_streaks"][0]["days"] == 4
    weak = [(w["class_name"], w["subject_name"]) for w in attention["weak_subjects"]]
    assert ("Grade 6 North", "English") in weak
    assert body["attendance"]["reasons"][0] == {"reason": "Malaria", "count": 4}


def test_exam_types_levels_and_class_comparison(client, db_session, school, school_admin_token):
    d = _setup(db_session, school)
    body = _get(client, school, school_admin_token).json()
    types = {t["exam_type"]: t["average"] for t in body["exam_types"]}
    assert set(types) == {"CAT 1", "Mid Term"}
    assert [c["class_name"] for c in body["classes"]][0] == "Grade 6 South"  # best class first
    maths = next(l for l in body["levels"] if l["subject"] == "Mathematics")
    assert sum(maths["counts"].values()) == maths["total"] == 6

    only_math = _get(client, school, school_admin_token, subject_id=d["math"].id).json()
    assert [l["subject"] for l in only_math["levels"]] == ["Mathematics"]
    one_class = _get(client, school, school_admin_token, class_id=d["south"].id).json()
    assert one_class["scorecard"]["learners"] == 1


def test_teacher_sees_only_their_own_classes_and_subjects(client, db_session, school):
    d = _setup(db_session, school)
    teacher, pw = _make_user(db_session, school, UserRole.TEACHER, "analyst@test-academy.test")
    db_session.add(TeacherAssignment(school_id=school.id, teacher_user_id=teacher.id, class_id=d["north"].id, subject_id=d["math"].id))
    db_session.commit()
    token = _login(client, teacher.email, pw)

    body = _get(client, school, token).json()
    assert body["scorecard"]["learners"] == 5            # not the South learner
    assert [l["subject"] for l in body["levels"]] == ["Mathematics"]   # not English
    assert _get(client, school, token, class_id=d["south"].id).status_code == 403


def test_coverage_still_works_after_the_refactor(client, db_session, school, school_admin_token):
    _setup(db_session, school)
    r = client.get(f"/schools/{school.id}/lessons/coverage", params={"term": "Term 3"}, headers=auth_headers(school_admin_token))
    assert r.status_code == 200
