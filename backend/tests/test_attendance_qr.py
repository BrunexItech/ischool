"""QR-code staff attendance — one signed code per school, printable, that
staff scan from their own logged-in phone to clock in/out. Replaces a plain
self-report button with something that at least proves they scanned a
code physically posted at their own school."""

from app.core.security import create_attendance_qr_token
from tests.conftest import auth_headers


def test_admin_can_fetch_the_schools_qr_token(client, school_admin_token, school):
    response = client.get(f"/schools/{school.id}/staff-attendance/qr-code", headers=auth_headers(school_admin_token))
    assert response.status_code == 200
    assert isinstance(response.json()["token"], str) and response.json()["token"]


def test_staff_cannot_fetch_the_qr_token(client, staff_token, school):
    response = client.get(f"/schools/{school.id}/staff-attendance/qr-code", headers=auth_headers(staff_token))
    assert response.status_code == 403


def test_scanning_the_qr_code_clocks_in_then_out(client, staff_token, school):
    token = create_attendance_qr_token(school.id)

    first = client.post(f"/schools/{school.id}/staff-attendance/scan", headers=auth_headers(staff_token), json={"token": token})
    assert first.status_code == 200, first.text
    assert first.json()["action"] == "clocked_in"
    assert first.json()["record"]["clocked_in_at"] is not None

    second = client.post(f"/schools/{school.id}/staff-attendance/scan", headers=auth_headers(staff_token), json={"token": token})
    assert second.status_code == 200
    assert second.json()["action"] == "clocked_out"

    third = client.post(f"/schools/{school.id}/staff-attendance/scan", headers=auth_headers(staff_token), json={"token": token})
    assert third.status_code == 400


def test_a_different_schools_qr_code_is_rejected(client, staff_token, school, other_school):
    other_token = create_attendance_qr_token(other_school.id)
    response = client.post(f"/schools/{school.id}/staff-attendance/scan", headers=auth_headers(staff_token), json={"token": other_token})
    assert response.status_code == 400


def test_garbage_token_is_rejected(client, staff_token, school):
    response = client.post(f"/schools/{school.id}/staff-attendance/scan", headers=auth_headers(staff_token), json={"token": "not-a-real-token"})
    assert response.status_code == 400
