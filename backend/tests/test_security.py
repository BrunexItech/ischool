"""Gate and compound security: visitor sign-in/out, vehicle log, early
pick-ups, incidents, emergency alerts, patrols, and gate-pass lookup against
the boarding module's exeats."""

from datetime import date, timedelta

from tests.conftest import auth_headers


def _sign_in_visitor(client, token, school_id, **overrides):
    payload = {
        "name": "Jane Doe",
        "id_number": "12345678",
        "phone": "+254700000000",
        "purpose": "Parent visit",
        "host_name": "Mrs Otieno",
    }
    payload.update(overrides)
    return client.post(f"/schools/{school_id}/security/visitors", headers=auth_headers(token), json=payload)


def test_visitor_sign_in_and_sign_out(client, school_admin_token, school):
    sign_in = _sign_in_visitor(client, school_admin_token, school.id)
    assert sign_in.status_code == 201
    body = sign_in.json()
    assert body["badge"].startswith("V-")
    assert body["id_number_masked"].endswith("678")
    assert "1234" not in body["id_number_masked"]

    sign_out = client.post(f"/schools/{school.id}/security/visitors/{body['id']}/sign-out", headers=auth_headers(school_admin_token))
    assert sign_out.status_code == 200
    assert sign_out.json()["signed_out_at"] is not None


def test_duplicate_visitor_sign_in_rejected(client, school_admin_token, school):
    first = _sign_in_visitor(client, school_admin_token, school.id)
    assert first.status_code == 201
    second = _sign_in_visitor(client, school_admin_token, school.id)
    assert second.status_code == 400


def test_vehicle_log_rejects_same_direction_twice(client, school_admin_token, school):
    payload = {"registration": "KDG 340L", "direction": "in", "driver_name": "Peter Rono", "purpose": "Airport run"}
    first = client.post(f"/schools/{school.id}/security/vehicles", headers=auth_headers(school_admin_token), json=payload)
    assert first.status_code == 201
    second = client.post(f"/schools/{school.id}/security/vehicles", headers=auth_headers(school_admin_token), json=payload)
    assert second.status_code == 400


def test_vehicle_cannot_be_logged_out_directly(client, school_admin_token, school):
    """Leaving always goes through a release request now — this endpoint
    only ever accepts 'in'."""
    payload = {"registration": "KDG 999Z", "direction": "out", "driver_name": "Someone", "purpose": "Leaving"}
    response = client.post(f"/schools/{school.id}/security/vehicles", headers=auth_headers(school_admin_token), json=payload)
    assert response.status_code == 400


def test_release_request_needs_the_vehicle_logged_in_first(client, security_token, school):
    response = client.post(
        f"/schools/{school.id}/security/vehicles/release-requests",
        headers=auth_headers(security_token),
        json={"registration": "KCX 111A", "driver_name": "Jane", "purpose": "Delivery"},
    )
    assert response.status_code == 400


def test_full_release_request_approval_flow(client, security_token, school_admin_token, school):
    reg = "KCX 222B"
    client.post(
        f"/schools/{school.id}/security/vehicles",
        headers=auth_headers(security_token),
        json={"registration": reg, "direction": "in", "driver_name": "Driver One", "purpose": "Supplies delivery"},
    )

    request_response = client.post(
        f"/schools/{school.id}/security/vehicles/release-requests",
        headers=auth_headers(security_token),
        json={"registration": reg, "driver_name": "Driver One", "purpose": "Leaving after delivery"},
    )
    assert request_response.status_code == 201
    request_id = request_response.json()["id"]
    assert request_response.json()["status"] == "pending"

    # security cannot approve its own request
    denied = client.post(
        f"/schools/{school.id}/security/vehicles/release-requests/{request_id}/approve",
        headers=auth_headers(security_token),
        json={},
    )
    assert denied.status_code == 403

    approved = client.post(
        f"/schools/{school.id}/security/vehicles/release-requests/{request_id}/approve",
        headers=auth_headers(school_admin_token),
        json={"note": "Confirmed with supplier"},
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    logs = client.get(f"/schools/{school.id}/security/vehicles", headers=auth_headers(school_admin_token)).json()
    assert any(l["registration"] == reg and l["direction"] == "out" for l in logs)

    # already decided, can't approve twice
    again = client.post(
        f"/schools/{school.id}/security/vehicles/release-requests/{request_id}/approve",
        headers=auth_headers(school_admin_token),
        json={},
    )
    assert again.status_code == 400


def test_release_request_can_be_rejected(client, security_token, school_admin_token, school):
    reg = "KCX 333C"
    client.post(
        f"/schools/{school.id}/security/vehicles",
        headers=auth_headers(security_token),
        json={"registration": reg, "direction": "in", "driver_name": "Driver Two", "purpose": "Delivery"},
    )
    request_response = client.post(
        f"/schools/{school.id}/security/vehicles/release-requests",
        headers=auth_headers(security_token),
        json={"registration": reg, "driver_name": "Driver Two", "purpose": "Leaving"},
    )
    request_id = request_response.json()["id"]

    rejected = client.post(
        f"/schools/{school.id}/security/vehicles/release-requests/{request_id}/reject",
        headers=auth_headers(school_admin_token),
        json={"note": "Wait for manager confirmation"},
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"

    logs = client.get(f"/schools/{school.id}/security/vehicles", headers=auth_headers(school_admin_token)).json()
    assert not any(l["registration"] == reg and l["direction"] == "out" for l in logs)


def test_early_pickup_log(client, school_admin_token, school, db_session):
    from app.models.academics import Student

    student = Student(school_id=school.id, admission_number="ELS-7001", first_name="Amani", last_name="Otieno")
    db_session.add(student)
    db_session.commit()

    response = client.post(
        f"/schools/{school.id}/security/pickups",
        headers=auth_headers(school_admin_token),
        json={"student_id": student.id, "collected_by": "Mrs Otieno", "relation": "Mother", "reason": "Clinic appointment"},
    )
    assert response.status_code == 201
    assert response.json()["verified"] is True


def test_security_incident_report_and_close(client, school_admin_token, school):
    create = client.post(
        f"/schools/{school.id}/security/incidents",
        headers=auth_headers(school_admin_token),
        json={"type": "Trespass", "location": "Back gate", "severity": "medium", "description": "Unidentified person found near the back fence.", "action_taken": "Escorted off the premises."},
    )
    assert create.status_code == 201
    incident_id = create.json()["id"]

    close = client.post(f"/schools/{school.id}/security/incidents/{incident_id}/close", headers=auth_headers(school_admin_token))
    assert close.status_code == 200
    assert close.json()["status"] == "closed"


def test_emergency_alert_raise_and_stand_down(client, school_admin_token, school):
    create = client.post(
        f"/schools/{school.id}/security/alerts",
        headers=auth_headers(school_admin_token),
        json={"type": "Fire evacuation", "message": "Evacuate to the assembly point immediately.", "sms_parents": True},
    )
    assert create.status_code == 201
    assert create.json()["active"] is True

    stand_down = client.post(f"/schools/{school.id}/security/alerts/{create.json()['id']}/stand-down", headers=auth_headers(school_admin_token))
    assert stand_down.status_code == 200
    assert stand_down.json()["active"] is False


def test_patrol_log(client, school_admin_token, school):
    response = client.post(
        f"/schools/{school.id}/security/patrols",
        headers=auth_headers(school_admin_token),
        json={"post": "Dormitories patrol", "ok": True, "note": "All clear."},
    )
    assert response.status_code == 201


def test_gate_pass_lookup_against_boarding_exeat(client, school_admin_token, school, db_session):
    from app.models.academics import Student

    student = Student(school_id=school.id, admission_number="ELS-7002", first_name="Brian", last_name="Kiprotich")
    db_session.add(student)
    db_session.commit()

    today = date.today()
    create = client.post(
        f"/schools/{school.id}/boarding/exeats",
        headers=auth_headers(school_admin_token),
        json={
            "student_id": student.id,
            "from_date": today.isoformat(),
            "to_date": (today + timedelta(days=1)).isoformat(),
            "reason": "Family event",
            "pickup_name": "Mr Kiprotich",
        },
    )
    exeat_id = create.json()["id"]
    approve = client.post(f"/schools/{school.id}/boarding/exeats/{exeat_id}/approve", headers=auth_headers(school_admin_token))
    gate_pass = approve.json()["gate_pass"]

    lookup = client.get(f"/schools/{school.id}/boarding/exeats/by-pass/{gate_pass}", headers=auth_headers(school_admin_token))
    assert lookup.status_code == 200
    assert lookup.json()["id"] == exeat_id

    missing = client.get(f"/schools/{school.id}/boarding/exeats/by-pass/GP-0000", headers=auth_headers(school_admin_token))
    assert missing.status_code == 404


def test_teacher_cannot_access_security(client, teacher_token, school):
    response = _sign_in_visitor(client, teacher_token, school.id)
    assert response.status_code == 403


def test_cannot_see_another_schools_security_data(client, school_admin_token, other_school_admin_token, school):
    _sign_in_visitor(client, school_admin_token, school.id)
    cross_tenant = client.get(f"/schools/{school.id}/security/visitors", headers=auth_headers(other_school_admin_token))
    assert cross_tenant.status_code == 403


def test_security_blocked_when_module_disabled(client, school_admin_token, school, db_session):
    from app.models.module import SchoolModule

    module = db_session.query(SchoolModule).filter_by(school_id=school.id, module_key="security").first()
    module.enabled = False
    db_session.commit()

    response = _sign_in_visitor(client, school_admin_token, school.id)
    assert response.status_code == 403
