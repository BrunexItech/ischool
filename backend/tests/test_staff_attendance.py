"""Staff clock-in/out (own arrival, separate from student registers) and
the duty roster (named duties assigned to a specific staff member/date)."""

from app.models.user import UserRole
from tests.conftest import _login, _make_user, auth_headers


def test_staff_can_clock_in_and_out(client, staff_token, school):
    response = client.post(f"/schools/{school.id}/staff-attendance/clock-in", headers=auth_headers(staff_token), json={})
    assert response.status_code == 200
    assert response.json()["clocked_in_at"] is not None
    assert response.json()["clocked_out_at"] is None

    response = client.post(f"/schools/{school.id}/staff-attendance/clock-out", headers=auth_headers(staff_token))
    assert response.status_code == 200
    assert response.json()["clocked_out_at"] is not None


def test_cannot_clock_out_without_clocking_in(client, staff_token, school):
    response = client.post(f"/schools/{school.id}/staff-attendance/clock-out", headers=auth_headers(staff_token))
    assert response.status_code == 400


def test_clocking_in_twice_updates_the_same_days_record(client, staff_token, school):
    client.post(f"/schools/{school.id}/staff-attendance/clock-in", headers=auth_headers(staff_token), json={})
    client.post(f"/schools/{school.id}/staff-attendance/clock-in", headers=auth_headers(staff_token), json={"note": "late bus"})

    mine = client.get(f"/schools/{school.id}/staff-attendance/mine", headers=auth_headers(staff_token))
    assert len(mine.json()) == 1
    assert mine.json()[0]["note"] == "late bus"


def test_admin_can_see_every_staff_members_attendance(client, staff_token, school_admin_token, school):
    client.post(f"/schools/{school.id}/staff-attendance/clock-in", headers=auth_headers(staff_token), json={})

    response = client.get(f"/schools/{school.id}/staff-attendance", headers=auth_headers(school_admin_token))
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert "staff_name" in response.json()[0]


def test_staff_cannot_see_the_whole_schools_attendance(client, staff_token, school):
    response = client.get(f"/schools/{school.id}/staff-attendance", headers=auth_headers(staff_token))
    assert response.status_code == 403


def test_admin_can_assign_and_list_duties(client, db_session, school, school_admin_token):
    staff, _ = _make_user(db_session, school, UserRole.SECURITY, "guard.duty@test-academy.test")
    db_session.commit()

    response = client.post(
        f"/schools/{school.id}/duties",
        headers=auth_headers(school_admin_token),
        json={"user_id": staff.id, "title": "Gate duty", "date": "2026-11-02", "start_time": "07:00:00", "end_time": "08:00:00"},
    )
    assert response.status_code == 201, response.text

    listing = client.get(f"/schools/{school.id}/duties", headers=auth_headers(school_admin_token))
    assert listing.status_code == 200
    assert len(listing.json()) == 1
    assert listing.json()[0]["staff_name"] == staff.full_name


def test_staff_can_see_their_own_upcoming_duties(client, db_session, school, school_admin_token):
    staff, password = _make_user(db_session, school, UserRole.SECURITY, "guard2.duty@test-academy.test")
    db_session.commit()
    client.post(
        f"/schools/{school.id}/duties",
        headers=auth_headers(school_admin_token),
        json={"user_id": staff.id, "title": "Gate duty", "date": "2026-12-01"},
    )

    token = _login(client, staff.email, password)
    response = client.get(f"/schools/{school.id}/duties/mine", headers=auth_headers(token))
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["title"] == "Gate duty"
