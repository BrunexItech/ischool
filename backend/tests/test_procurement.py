"""Procurement: requisition -> approval -> LPO -> receiving, with the
receipt posting a real double-entry journal entry into the ledger."""

from datetime import date, timedelta

from tests.conftest import auth_headers


def _account_id(client, token, school_id, code):
    accounts = client.get(f"/schools/{school_id}/ledger/accounts", headers=auth_headers(token)).json()
    return next(a["id"] for a in accounts if a["code"] == code)


def _supplier_id(client, token, school_id):
    response = client.post(
        f"/schools/{school_id}/suppliers",
        headers=auth_headers(token),
        json={"name": "Chandarana Supermarket Ltd", "kra_pin": "P051234567X", "category": "Food", "phone": "+254700000000", "email": "a@b.co.ke"},
    )
    return response.json()["id"]


def _requisition(client, token, school_id, account_id, **overrides):
    payload = {"department": "Kitchen and catering", "account_id": account_id, "description": "Rice and beans", "quantity": 50, "unit_cost": 200}
    payload.update(overrides)
    return client.post(f"/schools/{school_id}/requisitions", headers=auth_headers(token), json=payload)


def test_requisition_total_computed(client, school_admin_token, school):
    stationery = _account_id(client, school_admin_token, school.id, "5100")
    response = _requisition(client, school_admin_token, school.id, stationery)
    assert response.status_code == 201
    assert response.json()["total"] == 10000
    assert response.json()["status"] == "submitted"


def test_approve_then_issue_lpo_then_receive_posts_journal(client, school_admin_token, school):
    food_account = _account_id(client, school_admin_token, school.id, "5100")
    supplier_id = _supplier_id(client, school_admin_token, school.id)
    requisition = _requisition(client, school_admin_token, school.id, food_account).json()

    approve = client.post(f"/schools/{school.id}/requisitions/{requisition['id']}/approve", headers=auth_headers(school_admin_token))
    assert approve.status_code == 200
    assert approve.json()["status"] == "approved"

    po = client.post(
        f"/schools/{school.id}/purchase-orders",
        headers=auth_headers(school_admin_token),
        json={"requisition_id": requisition["id"], "supplier_id": supplier_id, "delivery_date": (date.today() + timedelta(days=3)).isoformat()},
    )
    assert po.status_code == 201
    assert po.json()["status"] == "issued"
    assert po.json()["total"] == 10000

    receive = client.post(f"/schools/{school.id}/purchase-orders/{po.json()['id']}/receive", headers=auth_headers(school_admin_token))
    assert receive.status_code == 200
    assert receive.json()["status"] == "received"

    accounts = client.get(f"/schools/{school.id}/ledger/accounts", headers=auth_headers(school_admin_token)).json()
    food = next(a for a in accounts if a["code"] == "5100")
    ap = next(a for a in accounts if a["code"] == "2010")
    assert food["balance"] == 10000
    assert ap["balance"] == 10000


def test_cannot_issue_lpo_for_unapproved_requisition(client, school_admin_token, school):
    food_account = _account_id(client, school_admin_token, school.id, "5100")
    supplier_id = _supplier_id(client, school_admin_token, school.id)
    requisition = _requisition(client, school_admin_token, school.id, food_account).json()

    po = client.post(
        f"/schools/{school.id}/purchase-orders",
        headers=auth_headers(school_admin_token),
        json={"requisition_id": requisition["id"], "supplier_id": supplier_id, "delivery_date": date.today().isoformat()},
    )
    assert po.status_code == 400


def test_decline_requisition(client, school_admin_token, school):
    food_account = _account_id(client, school_admin_token, school.id, "5100")
    requisition = _requisition(client, school_admin_token, school.id, food_account).json()
    response = client.post(f"/schools/{school.id}/requisitions/{requisition['id']}/decline", headers=auth_headers(school_admin_token))
    assert response.status_code == 200
    assert response.json()["status"] == "declined"


def test_staff_can_request_but_not_approve(client, staff_token, school_admin_token, school):
    food_account = _account_id(client, school_admin_token, school.id, "5100")
    create = _requisition(client, staff_token, school.id, food_account)
    assert create.status_code == 201

    approve = client.post(f"/schools/{school.id}/requisitions/{create.json()['id']}/approve", headers=auth_headers(staff_token))
    assert approve.status_code == 403


def test_cannot_see_another_schools_requisitions(client, school_admin_token, other_school_admin_token, school):
    food_account = _account_id(client, school_admin_token, school.id, "5100")
    _requisition(client, school_admin_token, school.id, food_account)
    cross_tenant = client.get(f"/schools/{school.id}/requisitions", headers=auth_headers(other_school_admin_token))
    assert cross_tenant.status_code == 403


def test_procurement_blocked_when_module_disabled(client, school_admin_token, school, db_session):
    from app.models.module import SchoolModule

    module = db_session.query(SchoolModule).filter_by(school_id=school.id, module_key="erp_finance").first()
    module.enabled = False
    db_session.commit()

    food_account_response = client.get(f"/schools/{school.id}/ledger/accounts", headers=auth_headers(school_admin_token))
    assert food_account_response.status_code == 403
