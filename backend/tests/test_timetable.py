"""The timetable's whole point is that it can't collide: a class can't have
two periods at once, and a teacher can't be teaching two classes at once."""

from app.models.academics import SchoolClass
from app.models.results import Subject
from app.models.user import UserRole
from tests.conftest import _make_user, auth_headers


def _setup(db_session, school):
    cls_a = SchoolClass(school_id=school.id, name="Grade 6A")
    cls_b = SchoolClass(school_id=school.id, name="Grade 6B")
    db_session.add_all([cls_a, cls_b])
    db_session.flush()
    math = Subject(school_id=school.id, name="Math")
    english = Subject(school_id=school.id, name="English")
    db_session.add_all([math, english])
    db_session.flush()
    teacher, _ = _make_user(db_session, school, UserRole.TEACHER, "tt@test-academy.test")
    db_session.commit()
    return cls_a, cls_b, math, english, teacher


def test_create_a_timetable_slot(client, db_session, school, school_admin_token):
    cls_a, cls_b, math, english, teacher = _setup(db_session, school)

    response = client.post(
        f"/schools/{school.id}/timetable",
        headers=auth_headers(school_admin_token),
        json={"class_id": cls_a.id, "subject_id": math.id, "teacher_user_id": teacher.id, "day_of_week": 0, "start_time": "08:00:00", "end_time": "09:00:00"},
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["class_name"] == "Grade 6A"
    assert body["subject_name"] == "Math"
    assert body["teacher_name"] == teacher.full_name


def test_a_class_cannot_double_book_an_overlapping_period(client, db_session, school, school_admin_token):
    cls_a, cls_b, math, english, teacher = _setup(db_session, school)
    headers = auth_headers(school_admin_token)

    client.post(
        f"/schools/{school.id}/timetable", headers=headers,
        json={"class_id": cls_a.id, "subject_id": math.id, "day_of_week": 0, "start_time": "08:00:00", "end_time": "09:00:00"},
    )
    response = client.post(
        f"/schools/{school.id}/timetable", headers=headers,
        json={"class_id": cls_a.id, "subject_id": english.id, "day_of_week": 0, "start_time": "08:30:00", "end_time": "09:30:00"},
    )
    assert response.status_code == 400
    assert "already has" in response.json()["detail"]


def test_a_teacher_cannot_be_double_booked_across_classes(client, db_session, school, school_admin_token):
    cls_a, cls_b, math, english, teacher = _setup(db_session, school)
    headers = auth_headers(school_admin_token)

    client.post(
        f"/schools/{school.id}/timetable", headers=headers,
        json={"class_id": cls_a.id, "subject_id": math.id, "teacher_user_id": teacher.id, "day_of_week": 1, "start_time": "10:00:00", "end_time": "11:00:00"},
    )
    response = client.post(
        f"/schools/{school.id}/timetable", headers=headers,
        json={"class_id": cls_b.id, "subject_id": english.id, "teacher_user_id": teacher.id, "day_of_week": 1, "start_time": "10:30:00", "end_time": "11:30:00"},
    )
    assert response.status_code == 400
    assert "already teaching" in response.json()["detail"]


def test_non_overlapping_slots_are_fine(client, db_session, school, school_admin_token):
    cls_a, cls_b, math, english, teacher = _setup(db_session, school)
    headers = auth_headers(school_admin_token)

    first = client.post(
        f"/schools/{school.id}/timetable", headers=headers,
        json={"class_id": cls_a.id, "subject_id": math.id, "teacher_user_id": teacher.id, "day_of_week": 2, "start_time": "08:00:00", "end_time": "09:00:00"},
    )
    second = client.post(
        f"/schools/{school.id}/timetable", headers=headers,
        json={"class_id": cls_a.id, "subject_id": english.id, "teacher_user_id": teacher.id, "day_of_week": 2, "start_time": "09:00:00", "end_time": "10:00:00"},
    )
    assert first.status_code == 201
    assert second.status_code == 201


def test_different_days_do_not_collide(client, db_session, school, school_admin_token):
    cls_a, cls_b, math, english, teacher = _setup(db_session, school)
    headers = auth_headers(school_admin_token)

    client.post(
        f"/schools/{school.id}/timetable", headers=headers,
        json={"class_id": cls_a.id, "subject_id": math.id, "day_of_week": 0, "start_time": "08:00:00", "end_time": "09:00:00"},
    )
    response = client.post(
        f"/schools/{school.id}/timetable", headers=headers,
        json={"class_id": cls_a.id, "subject_id": english.id, "day_of_week": 1, "start_time": "08:00:00", "end_time": "09:00:00"},
    )
    assert response.status_code == 201


def test_updating_a_slot_excludes_itself_from_collision_check(client, db_session, school, school_admin_token):
    cls_a, cls_b, math, english, teacher = _setup(db_session, school)
    headers = auth_headers(school_admin_token)

    created = client.post(
        f"/schools/{school.id}/timetable", headers=headers,
        json={"class_id": cls_a.id, "subject_id": math.id, "day_of_week": 3, "start_time": "08:00:00", "end_time": "09:00:00"},
    ).json()

    response = client.patch(
        f"/schools/{school.id}/timetable/{created['id']}", headers=headers,
        json={"class_id": cls_a.id, "subject_id": math.id, "day_of_week": 3, "start_time": "08:15:00", "end_time": "09:15:00"},
    )
    assert response.status_code == 200


def test_teacher_can_view_their_own_timetable_only(client, db_session, school, school_admin_token):
    cls_a, cls_b, math, english, teacher = _setup(db_session, school)
    headers = auth_headers(school_admin_token)
    client.post(
        f"/schools/{school.id}/timetable", headers=headers,
        json={"class_id": cls_a.id, "subject_id": math.id, "teacher_user_id": teacher.id, "day_of_week": 0, "start_time": "08:00:00", "end_time": "09:00:00"},
    )
    client.post(
        f"/schools/{school.id}/timetable", headers=headers,
        json={"class_id": cls_b.id, "subject_id": english.id, "day_of_week": 0, "start_time": "09:00:00", "end_time": "10:00:00"},
    )

    from tests.conftest import _login
    teacher_token = _login(client, teacher.email, "TestPass123!")
    response = client.get(f"/schools/{school.id}/timetable/mine", headers=auth_headers(teacher_token))
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["class_name"] == "Grade 6A"


def test_non_admin_cannot_create_timetable_slots(client, db_session, school, teacher_token):
    cls_a, cls_b, math, english, teacher = _setup(db_session, school)
    response = client.post(
        f"/schools/{school.id}/timetable", headers=auth_headers(teacher_token),
        json={"class_id": cls_a.id, "subject_id": math.id, "day_of_week": 0, "start_time": "08:00:00", "end_time": "09:00:00"},
    )
    assert response.status_code == 403
