"""Job-function roles (security, boarding_staff, transport_staff, bursar)
narrow a staff login to its own working view instead of every employee
sharing the same generic 'staff' access to every operational module."""

from tests.conftest import auth_headers


def test_security_can_view_visitors_but_not_finance(client, security_token, school):
    visitors = client.get(f"/schools/{school.id}/security/visitors", headers=auth_headers(security_token))
    assert visitors.status_code == 200

    finance = client.get(f"/schools/{school.id}/finance/expenses", headers=auth_headers(security_token))
    assert finance.status_code == 403


def test_boarding_staff_can_view_houses_but_not_finance(client, boarding_staff_token, school):
    houses = client.get(f"/schools/{school.id}/boarding/houses", headers=auth_headers(boarding_staff_token))
    assert houses.status_code == 200

    finance = client.get(f"/schools/{school.id}/finance/expenses", headers=auth_headers(boarding_staff_token))
    assert finance.status_code == 403


def test_transport_staff_can_manage_vehicles_but_not_boarding(client, transport_staff_token, school):
    vehicles = client.get(f"/schools/{school.id}/transport/vehicles", headers=auth_headers(transport_staff_token))
    assert vehicles.status_code == 200

    created = client.post(
        f"/schools/{school.id}/transport/vehicles",
        headers=auth_headers(transport_staff_token),
        json={"registration_number": "KDA 001A", "capacity": 30, "driver_name": "J. Mwangi", "driver_phone": "0712345678"},
    )
    assert created.status_code == 201

    houses = client.get(f"/schools/{school.id}/boarding/houses", headers=auth_headers(transport_staff_token))
    assert houses.status_code == 403


def test_bursar_can_reach_finance_and_fees_but_not_security(client, bursar_token, school):
    finance = client.get(f"/schools/{school.id}/finance/expenses", headers=auth_headers(bursar_token))
    assert finance.status_code == 200

    fees = client.get(f"/schools/{school.id}/fees/invoices", headers=auth_headers(bursar_token))
    assert fees.status_code == 200

    security = client.get(f"/schools/{school.id}/security/visitors", headers=auth_headers(bursar_token))
    assert security.status_code == 403


def test_generic_staff_still_cannot_reach_finance(client, staff_token, school):
    """Finance/bursar access is opt-in per role — plain 'staff' was never
    meant to reach expense data, only a bursar or a full admin."""
    response = client.get(f"/schools/{school.id}/finance/expenses", headers=auth_headers(staff_token))
    assert response.status_code == 403


def test_admin_can_create_staff_with_a_specialized_role(client, school_admin_token, school):
    response = client.post(
        f"/schools/{school.id}/staff",
        headers=auth_headers(school_admin_token),
        json={
            "email": "newbursar@test-academy.test",
            "full_name": "New Bursar",
            "password": "BursarPass123!",
            "role": "bursar",
            "staff_number": "BUR-001",
        },
    )
    assert response.status_code == 201, response.text
    assert response.json()["role"] == "bursar"


def test_admin_cannot_create_staff_with_a_non_staff_role(client, school_admin_token, school):
    response = client.post(
        f"/schools/{school.id}/staff",
        headers=auth_headers(school_admin_token),
        json={
            "email": "sneaky@test-academy.test",
            "full_name": "Sneaky",
            "password": "SneakyPass123!",
            "role": "school_admin",
            "staff_number": "SNK-001",
        },
    )
    assert response.status_code == 400
