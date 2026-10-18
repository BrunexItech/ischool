"""Stores: inventory items, receipts and issues, each posting a real
double-entry journal line (inventory <-> expense account)."""

from tests.conftest import auth_headers


def _account_id(client, token, school_id, code):
    accounts = client.get(f"/schools/{school_id}/ledger/accounts", headers=auth_headers(token)).json()
    return next(a["id"] for a in accounts if a["code"] == code)


def _item(client, token, school_id, account_id, **overrides):
    payload = {"name": "Maize flour 2kg", "category": "Food", "unit": "bag", "reorder_level": 10, "unit_cost": 150, "account_id": account_id}
    payload.update(overrides)
    return client.post(f"/schools/{school_id}/stores/items", headers=auth_headers(token), json=payload)


def test_create_item_generates_code(client, school_admin_token, school):
    food = _account_id(client, school_admin_token, school.id, "5100")
    response = _item(client, school_admin_token, school.id, food)
    assert response.status_code == 201
    assert response.json()["code"].startswith("F-") or "-" in response.json()["code"]
    assert response.json()["quantity"] == 0


def test_receipt_increases_quantity_and_posts_journal(client, school_admin_token, school):
    food = _account_id(client, school_admin_token, school.id, "5100")
    item = _item(client, school_admin_token, school.id, food).json()

    response = client.post(
        f"/schools/{school.id}/stores/receipts", headers=auth_headers(school_admin_token), json={"item_id": item["id"], "quantity": 100}
    )
    assert response.status_code == 201
    assert response.json()["type"] == "receipt"

    items = client.get(f"/schools/{school.id}/stores/items", headers=auth_headers(school_admin_token)).json()
    assert next(i for i in items if i["id"] == item["id"])["quantity"] == 100

    accounts = client.get(f"/schools/{school.id}/ledger/accounts", headers=auth_headers(school_admin_token)).json()
    inventory = next(a for a in accounts if a["code"] == "1200")
    assert inventory["balance"] == 15000


def test_issue_decreases_quantity_and_charges_expense(client, school_admin_token, school):
    food = _account_id(client, school_admin_token, school.id, "5100")
    item = _item(client, school_admin_token, school.id, food).json()
    client.post(f"/schools/{school.id}/stores/receipts", headers=auth_headers(school_admin_token), json={"item_id": item["id"], "quantity": 100})

    response = client.post(
        f"/schools/{school.id}/stores/issues",
        headers=auth_headers(school_admin_token),
        json={"item_id": item["id"], "quantity": 30, "department": "Kitchen and catering"},
    )
    assert response.status_code == 201

    items = client.get(f"/schools/{school.id}/stores/items", headers=auth_headers(school_admin_token)).json()
    assert next(i for i in items if i["id"] == item["id"])["quantity"] == 70

    accounts = client.get(f"/schools/{school.id}/ledger/accounts", headers=auth_headers(school_admin_token)).json()
    inventory = next(a for a in accounts if a["code"] == "1200")
    food_expense = next(a for a in accounts if a["code"] == "5100")
    assert inventory["balance"] == 15000 - 4500
    assert food_expense["balance"] == 4500


def test_cannot_issue_more_than_in_stock(client, school_admin_token, school):
    food = _account_id(client, school_admin_token, school.id, "5100")
    item = _item(client, school_admin_token, school.id, food).json()
    client.post(f"/schools/{school.id}/stores/receipts", headers=auth_headers(school_admin_token), json={"item_id": item["id"], "quantity": 10})

    response = client.post(
        f"/schools/{school.id}/stores/issues",
        headers=auth_headers(school_admin_token),
        json={"item_id": item["id"], "quantity": 50, "department": "Kitchen and catering"},
    )
    assert response.status_code == 400


def test_duplicate_item_name_rejected(client, school_admin_token, school):
    food = _account_id(client, school_admin_token, school.id, "5100")
    first = _item(client, school_admin_token, school.id, food)
    assert first.status_code == 201
    second = _item(client, school_admin_token, school.id, food)
    assert second.status_code == 400


def test_teacher_cannot_access_stores(client, teacher_token, school):
    response = client.get(f"/schools/{school.id}/stores/items", headers=auth_headers(teacher_token))
    assert response.status_code == 403


def test_cannot_see_another_schools_stores(client, school_admin_token, other_school_admin_token, school):
    cross_tenant = client.get(f"/schools/{school.id}/stores/items", headers=auth_headers(other_school_admin_token))
    assert cross_tenant.status_code == 403


def test_stores_blocked_when_module_disabled(client, school_admin_token, school, db_session):
    from app.models.module import SchoolModule

    module = db_session.query(SchoolModule).filter_by(school_id=school.id, module_key="erp_finance").first()
    module.enabled = False
    db_session.commit()

    response = client.get(f"/schools/{school.id}/stores/items", headers=auth_headers(school_admin_token))
    assert response.status_code == 403
