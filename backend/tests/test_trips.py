"""School trips: bus-booking requests, staff-ratio validation, approval with
vehicle capacity/availability checks, and the status lifecycle."""

from datetime import date, timedelta

from tests.conftest import auth_headers


def _vehicle(client, token, school_id, **overrides):
    payload = {"registration_number": "KDG 340L", "capacity": 33, "driver_name": "Peter Rono", "driver_phone": "+254700000000"}
    payload.update(overrides)
    return client.post(f"/schools/{school_id}/transport/vehicles", headers=auth_headers(token), json=payload)


_student_seq = [0]


def _students(db_session, school_id, n):
    from app.models.academics import Student

    created = []
    for _ in range(n):
        _student_seq[0] += 1
        s = Student(school_id=school_id, admission_number=f"ELS-{8000 + _student_seq[0]}", first_name=f"Learner{_student_seq[0]}", last_name="Test")
        db_session.add(s)
        created.append(s)
    db_session.commit()
    return created


def _trip_payload(student_ids, **overrides):
    today = date.today()
    payload = {
        "title": "Lake Bogoria field study",
        "trip_type": "Field trip",
        "purpose": "Geography field study on geothermal features and flamingos.",
        "destination": "Lake Bogoria National Reserve",
        "start_date": (today + timedelta(days=5)).isoformat(),
        "end_date": (today + timedelta(days=5)).isoformat(),
        "departure_time": "07:00",
        "return_time": "17:00",
        "class_ids": [],
        "student_ids": student_ids,
        "staff_count": 2,
        "distance_km": 120,
    }
    payload.update(overrides)
    return payload


def test_request_trip_and_estimate(client, school_admin_token, school, db_session):
    students = _students(db_session, school.id, 5)
    response = client.post(
        f"/schools/{school.id}/trips", headers=auth_headers(school_admin_token), json=_trip_payload([s.id for s in students])
    )
    assert response.status_code == 201
    body = response.json()
    assert body["reference"].startswith("TRP-")
    assert body["estimated_cost"] == 120 * 2 * 150 + 5000
    assert body["status"] == "requested"


def test_staff_ratio_enforced(client, school_admin_token, school, db_session):
    students = _students(db_session, school.id, 20)
    response = client.post(
        f"/schools/{school.id}/trips",
        headers=auth_headers(school_admin_token),
        json=_trip_payload([s.id for s in students], staff_count=1),
    )
    assert response.status_code == 400


def test_approve_with_vehicle_checks_capacity_and_clashes(client, school_admin_token, school, db_session):
    vehicle = _vehicle(client, school_admin_token, school.id).json()
    students = _students(db_session, school.id, 5)

    small_bus = _vehicle(client, school_admin_token, school.id, registration_number="KBZ 001A", capacity=4).json()
    trip = client.post(
        f"/schools/{school.id}/trips", headers=auth_headers(school_admin_token), json=_trip_payload([s.id for s in students])
    ).json()

    too_small = client.post(
        f"/schools/{school.id}/trips/{trip['id']}/approve", headers=auth_headers(school_admin_token), json={"vehicle_id": small_bus["id"]}
    )
    assert too_small.status_code == 400

    approve = client.post(
        f"/schools/{school.id}/trips/{trip['id']}/approve", headers=auth_headers(school_admin_token), json={"vehicle_id": vehicle["id"]}
    )
    assert approve.status_code == 200
    assert approve.json()["status"] == "approved"

    other_students = _students(db_session, school.id, 3)
    other_trip = client.post(
        f"/schools/{school.id}/trips", headers=auth_headers(school_admin_token), json=_trip_payload([s.id for s in other_students])
    ).json()
    clash = client.post(
        f"/schools/{school.id}/trips/{other_trip['id']}/approve", headers=auth_headers(school_admin_token), json={"vehicle_id": vehicle["id"]}
    )
    assert clash.status_code == 400


def test_trip_status_lifecycle(client, school_admin_token, school, db_session):
    vehicle = _vehicle(client, school_admin_token, school.id).json()
    students = _students(db_session, school.id, 3)
    trip = client.post(
        f"/schools/{school.id}/trips", headers=auth_headers(school_admin_token), json=_trip_payload([s.id for s in students])
    ).json()

    client.post(f"/schools/{school.id}/trips/{trip['id']}/approve", headers=auth_headers(school_admin_token), json={"vehicle_id": vehicle["id"]})
    start = client.post(f"/schools/{school.id}/trips/{trip['id']}/start", headers=auth_headers(school_admin_token))
    assert start.status_code == 200
    assert start.json()["status"] == "in_progress"

    complete = client.post(f"/schools/{school.id}/trips/{trip['id']}/complete", headers=auth_headers(school_admin_token))
    assert complete.status_code == 200
    assert complete.json()["status"] == "completed"


def _teacher_class_students(db_session, school, n=3):
    """The fixture teacher's own class, with `n` learners in it."""
    from app.models.academics import SchoolClass
    from app.models.user import User

    teacher = db_session.query(User).filter_by(email="teacher@test-academy.test").one()
    cls = SchoolClass(school_id=school.id, name="Grade 6 North", homeroom_teacher_id=teacher.id)
    db_session.add(cls)
    db_session.flush()
    students = _students(db_session, school.id, n)
    for st in students:
        st.class_id = cls.id
    db_session.commit()
    return students


def test_teacher_can_only_take_learners_from_their_own_classes_and_sees_only_their_trips(client, teacher_token, school_admin_token, school, db_session):
    mine = _teacher_class_students(db_session, school)
    strangers = _students(db_session, school.id, 3)
    refused = client.post(f"/schools/{school.id}/trips", headers=auth_headers(teacher_token), json=_trip_payload([s.id for s in strangers]))
    assert refused.status_code == 403
    ok = client.post(f"/schools/{school.id}/trips", headers=auth_headers(teacher_token), json=_trip_payload([s.id for s in mine]))
    assert ok.status_code == 201
    client.post(f"/schools/{school.id}/trips", headers=auth_headers(school_admin_token), json=_trip_payload([s.id for s in strangers]))
    mine_list = client.get(f"/schools/{school.id}/trips", headers=auth_headers(teacher_token)).json()
    assert [t["id"] for t in mine_list] == [ok.json()["id"]]
    assert len(client.get(f"/schools/{school.id}/trips", headers=auth_headers(school_admin_token)).json()) == 2


def test_teacher_can_request_but_not_approve(client, teacher_token, school, db_session):
    students = _teacher_class_students(db_session, school)
    create = client.post(
        f"/schools/{school.id}/trips", headers=auth_headers(teacher_token), json=_trip_payload([s.id for s in students])
    )
    assert create.status_code == 201

    approve = client.post(f"/schools/{school.id}/trips/{create.json()['id']}/approve", headers=auth_headers(teacher_token), json={})
    assert approve.status_code == 403


def test_cannot_see_another_schools_trips(client, school_admin_token, other_school_admin_token, school, db_session):
    students = _students(db_session, school.id, 3)
    client.post(f"/schools/{school.id}/trips", headers=auth_headers(school_admin_token), json=_trip_payload([s.id for s in students]))

    cross_tenant = client.get(f"/schools/{school.id}/trips", headers=auth_headers(other_school_admin_token))
    assert cross_tenant.status_code == 403


def test_trips_blocked_when_module_disabled(client, school_admin_token, school, db_session):
    from app.models.module import SchoolModule

    module = db_session.query(SchoolModule).filter_by(school_id=school.id, module_key="trips").first()
    module.enabled = False
    db_session.commit()

    students = _students(db_session, school.id, 2)
    response = client.post(
        f"/schools/{school.id}/trips", headers=auth_headers(school_admin_token), json=_trip_payload([s.id for s in students])
    )
    assert response.status_code == 403
