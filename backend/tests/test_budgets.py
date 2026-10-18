"""Budgets: a spend ceiling per account/year, with actual pulled live from
the ledger and committed spend pulled live from procurement."""

from datetime import date, timedelta

from tests.conftest import auth_headers


def _account_id(client, token, school_id, code):
    accounts = client.get(f"/schools/{school_id}/ledger/accounts", headers=auth_headers(token)).json()
    return next(a["id"] for a in accounts if a["code"] == code)


def test_set_and_read_budget(client, school_admin_token, school):
    food = _account_id(client, school_admin_token, school.id, "5100")
    year = date.today().year

    set_response = client.put(
        f"/schools/{school.id}/budgets", headers=auth_headers(school_admin_token), json={"account_id": food, "year": year, "amount": 500000}
    )
    assert set_response.status_code == 200
    assert set_response.json()["budget"] == 500000
    assert set_response.json()["available"] == 500000

    listing = client.get(f"/schools/{school.id}/budgets", headers=auth_headers(school_admin_token), params={"year": year})
    assert listing.status_code == 200
    row = next(r for r in listing.json() if r["account_code"] == "5100")
    assert row["budget"] == 500000


def test_budget_reflects_committed_spend_from_requisitions(client, school_admin_token, school):
    food = _account_id(client, school_admin_token, school.id, "5100")
    year = date.today().year
    client.put(f"/schools/{school.id}/budgets", headers=auth_headers(school_admin_token), json={"account_id": food, "year": year, "amount": 100000})

    req = client.post(
        f"/schools/{school.id}/requisitions",
        headers=auth_headers(school_admin_token),
        json={"department": "Kitchen and catering", "account_id": food, "description": "Rice and beans", "quantity": 50, "unit_cost": 200},
    ).json()
    client.post(f"/schools/{school.id}/requisitions/{req['id']}/approve", headers=auth_headers(school_admin_token))

    listing = client.get(f"/schools/{school.id}/budgets", headers=auth_headers(school_admin_token), params={"year": year}).json()
    row = next(r for r in listing if r["account_code"] == "5100")
    assert row["committed"] == 10000
    assert row["available"] == 90000


def test_budget_reflects_actual_spend_after_receiving(client, school_admin_token, school):
    food = _account_id(client, school_admin_token, school.id, "5100")
    year = date.today().year
    client.put(f"/schools/{school.id}/budgets", headers=auth_headers(school_admin_token), json={"account_id": food, "year": year, "amount": 100000})

    supplier = client.post(
        f"/schools/{school.id}/suppliers",
        headers=auth_headers(school_admin_token),
        json={"name": "Chandarana", "kra_pin": "P051234567X", "category": "Food", "phone": "+254700000000", "email": "a@b.co.ke"},
    ).json()
    req = client.post(
        f"/schools/{school.id}/requisitions",
        headers=auth_headers(school_admin_token),
        json={"department": "Kitchen and catering", "account_id": food, "description": "Rice and beans", "quantity": 50, "unit_cost": 200},
    ).json()
    client.post(f"/schools/{school.id}/requisitions/{req['id']}/approve", headers=auth_headers(school_admin_token))
    po = client.post(
        f"/schools/{school.id}/purchase-orders",
        headers=auth_headers(school_admin_token),
        json={"requisition_id": req["id"], "supplier_id": supplier["id"], "delivery_date": (date.today() + timedelta(days=2)).isoformat()},
    ).json()
    client.post(f"/schools/{school.id}/purchase-orders/{po['id']}/receive", headers=auth_headers(school_admin_token))

    listing = client.get(f"/schools/{school.id}/budgets", headers=auth_headers(school_admin_token), params={"year": year}).json()
    row = next(r for r in listing if r["account_code"] == "5100")
    assert row["actual"] == 10000
    assert row["committed"] == 0
    assert row["available"] == 90000


def test_teacher_cannot_access_budgets(client, teacher_token, school):
    response = client.get(f"/schools/{school.id}/budgets", headers=auth_headers(teacher_token), params={"year": date.today().year})
    assert response.status_code == 403


def test_cannot_see_another_schools_budgets(client, school_admin_token, other_school_admin_token, school):
    cross_tenant = client.get(f"/schools/{school.id}/budgets", headers=auth_headers(other_school_admin_token), params={"year": date.today().year})
    assert cross_tenant.status_code == 403


def test_budgets_blocked_when_module_disabled(client, school_admin_token, school, db_session):
    from app.models.module import SchoolModule

    module = db_session.query(SchoolModule).filter_by(school_id=school.id, module_key="erp_finance").first()
    module.enabled = False
    db_session.commit()

    response = client.get(f"/schools/{school.id}/budgets", headers=auth_headers(school_admin_token), params={"year": date.today().year})
    assert response.status_code == 403
