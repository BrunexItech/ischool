"""Boarding: houses, bed assignments, roll calls, leave-outs (exeats) through
the gate pass lifecycle, sick bay visits, and incidents."""

from datetime import date, timedelta

from tests.conftest import auth_headers


def _house(client, token, school_id, **overrides):
    payload = {"name": "Elgon House", "gender": "F", "total_beds": 40}
    payload.update(overrides)
    return client.post(f"/schools/{school_id}/boarding/houses", headers=auth_headers(token), json=payload)


def _student(db_session, school_id, **overrides):
    from app.models.academics import Student

    defaults = dict(school_id=school_id, admission_number="ELS-9001", first_name="Amani", last_name="Otieno", gender="F")
    defaults.update(overrides)
    s = Student(**defaults)
    db_session.add(s)
    db_session.commit()
    return s


def test_create_house_and_assign_bed(client, school_admin_token, school, db_session):
    house = _house(client, school_admin_token, school.id).json()
    student = _student(db_session, school.id)

    assign = client.post(
        f"/schools/{school.id}/boarding/assignments",
        headers=auth_headers(school_admin_token),
        json={"student_id": student.id, "house_id": house["id"], "bed_number": "E-01"},
    )
    assert assign.status_code == 200

    houses = client.get(f"/schools/{school.id}/boarding/houses", headers=auth_headers(school_admin_token)).json()
    assert houses[0]["occupied_beds"] == 1


def test_bed_cannot_be_double_booked(client, school_admin_token, school, db_session):
    house = _house(client, school_admin_token, school.id).json()
    s1 = _student(db_session, school.id, admission_number="ELS-9001")
    s2 = _student(db_session, school.id, admission_number="ELS-9002", first_name="Brian")

    client.post(
        f"/schools/{school.id}/boarding/assignments",
        headers=auth_headers(school_admin_token),
        json={"student_id": s1.id, "house_id": house["id"], "bed_number": "E-01"},
    )
    clash = client.post(
        f"/schools/{school.id}/boarding/assignments",
        headers=auth_headers(school_admin_token),
        json={"student_id": s2.id, "house_id": house["id"], "bed_number": "E-01"},
    )
    assert clash.status_code == 400


def test_roll_call_submit_and_upsert(client, school_admin_token, school, db_session):
    house = _house(client, school_admin_token, school.id).json()
    student = _student(db_session, school.id)

    today = date.today().isoformat()
    first = client.put(
        f"/schools/{school.id}/boarding/roll-calls",
        headers=auth_headers(school_admin_token),
        json={"house_id": house["id"], "date": today, "session": "night", "marks": {str(student.id): "P"}},
    )
    assert first.status_code == 200

    second = client.put(
        f"/schools/{school.id}/boarding/roll-calls",
        headers=auth_headers(school_admin_token),
        json={"house_id": house["id"], "date": today, "session": "night", "marks": {str(student.id): "A"}},
    )
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]
    assert second.json()["marks"][str(student.id)] == "A"


def test_exeat_lifecycle_through_gate_pass(client, school_admin_token, school, db_session):
    student = _student(db_session, school.id)
    today = date.today()

    create = client.post(
        f"/schools/{school.id}/boarding/exeats",
        headers=auth_headers(school_admin_token),
        json={
            "student_id": student.id,
            "from_date": today.isoformat(),
            "to_date": (today + timedelta(days=1)).isoformat(),
            "reason": "Family event",
            "pickup_name": "Mrs Otieno",
            "pickup_relation": "Mother",
            "pickup_phone": "+254700000000",
        },
    )
    assert create.status_code == 201
    exeat_id = create.json()["id"]
    assert create.json()["status"] == "pending"

    approve = client.post(f"/schools/{school.id}/boarding/exeats/{exeat_id}/approve", headers=auth_headers(school_admin_token))
    assert approve.status_code == 200
    assert approve.json()["gate_pass"].startswith("GP-")

    check_out = client.post(f"/schools/{school.id}/boarding/exeats/{exeat_id}/check-out", headers=auth_headers(school_admin_token))
    assert check_out.status_code == 200
    assert check_out.json()["status"] == "out"

    check_in = client.post(f"/schools/{school.id}/boarding/exeats/{exeat_id}/check-in", headers=auth_headers(school_admin_token))
    assert check_in.status_code == 200
    assert check_in.json()["status"] in ("returned", "returned_late")


def test_overlapping_exeat_rejected(client, school_admin_token, school, db_session):
    student = _student(db_session, school.id)
    today = date.today()
    payload = {
        "student_id": student.id,
        "from_date": today.isoformat(),
        "to_date": (today + timedelta(days=2)).isoformat(),
        "reason": "Family event",
        "pickup_name": "Mrs Otieno",
    }
    first = client.post(f"/schools/{school.id}/boarding/exeats", headers=auth_headers(school_admin_token), json=payload)
    assert first.status_code == 201

    second = client.post(f"/schools/{school.id}/boarding/exeats", headers=auth_headers(school_admin_token), json=payload)
    assert second.status_code == 400


def test_sick_bay_visit(client, school_admin_token, school, db_session):
    student = _student(db_session, school.id)
    response = client.post(
        f"/schools/{school.id}/boarding/sick-bay",
        headers=auth_headers(school_admin_token),
        json={"student_id": student.id, "complaint": "Headache", "temperature": 37.2, "action": "rest_in_sick_bay"},
    )
    assert response.status_code == 201
    assert response.json()["status"] == "In sick bay"


def test_incident_create_and_close(client, school_admin_token, school):
    house = _house(client, school_admin_token, school.id).json()
    create = client.post(
        f"/schools/{school.id}/boarding/incidents",
        headers=auth_headers(school_admin_token),
        json={"house_id": house["id"], "type": "Bullying", "description": "Reported by a dorm mate during evening prep.", "action_taken": "Referred to the counsellor"},
    )
    assert create.status_code == 201
    incident_id = create.json()["id"]

    close = client.post(f"/schools/{school.id}/boarding/incidents/{incident_id}/close", headers=auth_headers(school_admin_token))
    assert close.status_code == 200
    assert close.json()["status"] == "closed"


def test_teacher_cannot_manage_houses(client, teacher_token, school):
    response = _house(client, teacher_token, school.id)
    assert response.status_code == 403


def test_cannot_see_another_schools_boarding_data(client, school_admin_token, other_school_admin_token, school):
    house = _house(client, school_admin_token, school.id).json()
    cross_tenant = client.get(f"/schools/{school.id}/boarding/houses", headers=auth_headers(other_school_admin_token))
    assert cross_tenant.status_code == 403


def test_boarding_blocked_when_module_disabled(client, school_admin_token, school, db_session):
    from app.models.module import SchoolModule

    module = db_session.query(SchoolModule).filter_by(school_id=school.id, module_key="boarding").first()
    module.enabled = False
    db_session.commit()

    response = _house(client, school_admin_token, school.id)
    assert response.status_code == 403
