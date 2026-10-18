"""Maker-checker on expenses: a bursar's request at or above the school's
threshold is held PENDING — excluded from finance totals — until a
school_admin approves or rejects it. Below the threshold, and for anything
a full admin records directly, it's trusted and auto-approved."""

from tests.conftest import auth_headers


def test_bursar_expense_above_threshold_is_pending_and_excluded_from_totals(client, bursar_token, school_admin_token, school):
    created = client.post(
        f"/schools/{school.id}/finance/expenses",
        headers=auth_headers(bursar_token),
        json={"category": "maintenance", "description": "Roof repair", "amount": 75000, "date": "2026-01-10"},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["status"] == "pending"
    assert body["approved_by"] is None

    summary = client.get(f"/schools/{school.id}/finance/summary", headers=auth_headers(school_admin_token)).json()
    assert summary["total_expenses"] == 0.0


def test_bursar_expense_below_threshold_is_auto_approved(client, bursar_token, school):
    created = client.post(
        f"/schools/{school.id}/finance/expenses",
        headers=auth_headers(bursar_token),
        json={"category": "supplies", "description": "Stationery", "amount": 2000, "date": "2026-01-10"},
    )
    assert created.status_code == 201
    body = created.json()
    assert body["status"] == "approved"
    assert body["approved_by"] is not None


def test_admin_expense_is_always_auto_approved_regardless_of_amount(client, school_admin_token, school):
    created = client.post(
        f"/schools/{school.id}/finance/expenses",
        headers=auth_headers(school_admin_token),
        json={"category": "construction", "description": "New block", "amount": 500000, "date": "2026-01-10"},
    )
    assert created.status_code == 201
    assert created.json()["status"] == "approved"


def test_admin_can_approve_a_pending_expense_and_it_then_counts_toward_totals(client, bursar_token, school_admin_token, school):
    created = client.post(
        f"/schools/{school.id}/finance/expenses",
        headers=auth_headers(bursar_token),
        json={"category": "maintenance", "description": "Generator service", "amount": 60000, "date": "2026-01-10"},
    ).json()

    approved = client.post(
        f"/schools/{school.id}/finance/expenses/{created['id']}/approve", headers=auth_headers(school_admin_token)
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "approved"

    summary = client.get(f"/schools/{school.id}/finance/summary", headers=auth_headers(school_admin_token)).json()
    assert summary["total_expenses"] == 60000.0


def test_admin_can_reject_a_pending_expense_with_a_reason(client, bursar_token, school_admin_token, school):
    created = client.post(
        f"/schools/{school.id}/finance/expenses",
        headers=auth_headers(bursar_token),
        json={"category": "maintenance", "description": "Luxury renovation", "amount": 90000, "date": "2026-01-10"},
    ).json()

    rejected = client.post(
        f"/schools/{school.id}/finance/expenses/{created['id']}/reject",
        headers=auth_headers(school_admin_token),
        json={"reason": "Not budgeted this term"},
    )
    assert rejected.status_code == 200
    body = rejected.json()
    assert body["status"] == "rejected"
    assert body["rejected_reason"] == "Not budgeted this term"

    summary = client.get(f"/schools/{school.id}/finance/summary", headers=auth_headers(school_admin_token)).json()
    assert summary["total_expenses"] == 0.0


def test_bursar_cannot_approve_their_own_pending_expense(client, bursar_token, school):
    created = client.post(
        f"/schools/{school.id}/finance/expenses",
        headers=auth_headers(bursar_token),
        json={"category": "maintenance", "description": "Pump replacement", "amount": 80000, "date": "2026-01-10"},
    ).json()

    response = client.post(f"/schools/{school.id}/finance/expenses/{created['id']}/approve", headers=auth_headers(bursar_token))
    assert response.status_code == 403


def test_cannot_approve_an_already_approved_expense(client, school_admin_token, school):
    created = client.post(
        f"/schools/{school.id}/finance/expenses",
        headers=auth_headers(school_admin_token),
        json={"category": "utilities", "description": "Power bill", "amount": 10000, "date": "2026-01-10"},
    ).json()

    response = client.post(f"/schools/{school.id}/finance/expenses/{created['id']}/approve", headers=auth_headers(school_admin_token))
    assert response.status_code == 400


def test_admin_can_configure_the_approval_threshold(client, school_admin_token, bursar_token, school):
    updated = client.patch(
        f"/schools/{school.id}/branding", headers=auth_headers(school_admin_token), json={"expense_approval_threshold": 1000}
    )
    assert updated.status_code == 200
    assert float(updated.json()["expense_approval_threshold"]) == 1000.0

    created = client.post(
        f"/schools/{school.id}/finance/expenses",
        headers=auth_headers(bursar_token),
        json={"category": "supplies", "description": "Printer paper", "amount": 1500, "date": "2026-01-10"},
    )
    assert created.json()["status"] == "pending"
