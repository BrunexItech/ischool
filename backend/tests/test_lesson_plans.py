"""Lesson plans are deliberately unstructured — a teacher can fill in one
entry at a time as the term goes, or replace the whole set in one call to
set up the entire term up front. Scoped by the same TeacherAssignment
rights as grading."""

from app.models.academics import SchoolClass
from app.models.results import Subject
from app.models.teacher_assignment import TeacherAssignment
from tests.conftest import auth_headers


def _setup_scope(db_session, school, teacher):
    subject = Subject(school_id=school.id, name="Mathematics")
    school_class = SchoolClass(school_id=school.id, name="Form 1A")
    db_session.add_all([subject, school_class])
    db_session.flush()
    db_session.add(TeacherAssignment(school_id=school.id, teacher_user_id=teacher.id, class_id=school_class.id, subject_id=subject.id))
    db_session.commit()
    return school_class, subject


def _teacher_user(db_session, school):
    from app.core.security import hash_password
    from app.models.user import User, UserRole

    user = User(
        school_id=school.id, email="scoped-teacher@test-academy.test", full_name="Scoped Teacher",
        hashed_password=hash_password("TestPass123!"), role=UserRole.TEACHER,
    )
    db_session.add(user)
    db_session.commit()
    return user


def test_create_plan_then_add_entries_one_at_a_time(client, db_session, school, school_admin_token):
    school_class, subject = _setup_scope(db_session, school, _teacher_user(db_session, school))

    plan = client.post(
        f"/schools/{school.id}/lesson-plans",
        headers=auth_headers(school_admin_token),
        json={"class_id": school_class.id, "subject_id": subject.id, "term": "Term 1 2026"},
    ).json()
    assert plan["entry_count"] == 0

    added = client.post(
        f"/schools/{school.id}/lesson-plans/{plan['id']}/entries",
        headers=auth_headers(school_admin_token),
        json={"order": 1, "label": "Week 1", "topic": "Intro"},
    )
    assert added.status_code == 201
    assert added.json()["status"] == "planned"


def test_duplicate_plan_scope_is_rejected(client, db_session, school, school_admin_token):
    school_class, subject = _setup_scope(db_session, school, _teacher_user(db_session, school))
    payload = {"class_id": school_class.id, "subject_id": subject.id, "term": "Term 1 2026"}
    headers = auth_headers(school_admin_token)

    assert client.post(f"/schools/{school.id}/lesson-plans", headers=headers, json=payload).status_code == 201
    dup = client.post(f"/schools/{school.id}/lesson-plans", headers=headers, json=payload)
    assert dup.status_code == 400


def test_replace_entries_sets_the_whole_term_in_one_call(client, db_session, school, school_admin_token):
    school_class, subject = _setup_scope(db_session, school, _teacher_user(db_session, school))
    plan_id = client.post(
        f"/schools/{school.id}/lesson-plans",
        headers=auth_headers(school_admin_token),
        json={"class_id": school_class.id, "subject_id": subject.id, "term": "Term 1 2026"},
    ).json()["id"]

    response = client.put(
        f"/schools/{school.id}/lesson-plans/{plan_id}/entries",
        headers=auth_headers(school_admin_token),
        json=[
            {"order": 1, "label": "Week 1", "topic": "A"},
            {"order": 2, "label": "Week 2", "topic": "B"},
        ],
    )
    assert response.status_code == 200
    assert response.json()["entry_count"] == 2


def test_unassigned_teacher_cannot_touch_a_class_they_do_not_teach(client, db_session, school, other_school):
    teacher = _teacher_user(db_session, school)
    school_class, subject = _setup_scope(db_session, other_school, teacher)  # assigned at the OTHER school's class

    # log the teacher in and try against their own school with an unassigned class
    unassigned_class = SchoolClass(school_id=school.id, name="Form 2A")
    db_session.add(unassigned_class)
    db_session.commit()

    login = client.post("/auth/login", data={"username": teacher.email, "password": "TestPass123!"})
    headers = auth_headers(login.json()["access_token"])

    response = client.post(
        f"/schools/{school.id}/lesson-plans",
        headers=headers,
        json={"class_id": unassigned_class.id, "subject_id": subject.id, "term": "Term 1 2026"},
    )
    assert response.status_code == 403


def test_marking_an_entry_completed_updates_the_count(client, db_session, school, school_admin_token):
    school_class, subject = _setup_scope(db_session, school, _teacher_user(db_session, school))
    headers = auth_headers(school_admin_token)
    plan = client.post(
        f"/schools/{school.id}/lesson-plans",
        headers=headers,
        json={"class_id": school_class.id, "subject_id": subject.id, "term": "Term 1 2026"},
    ).json()
    entry = client.post(
        f"/schools/{school.id}/lesson-plans/{plan['id']}/entries", headers=headers, json={"order": 1, "label": "Week 1", "topic": "A"}
    ).json()

    client.patch(
        f"/schools/{school.id}/lesson-plans/{plan['id']}/entries/{entry['id']}", headers=headers, json={"status": "completed"}
    )
    refreshed = client.get(f"/schools/{school.id}/lesson-plans/{plan['id']}", headers=headers).json()
    assert refreshed["completed_count"] == 1
