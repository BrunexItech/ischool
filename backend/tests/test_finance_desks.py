"""The store keeper's requests and stocktakes, the new finance roles, and what the head sees of them."""

from app.models.user import UserRole
from tests.conftest import _login, _make_user, auth_headers
from tests.test_stores import _account_id, _item


def _stocked(client, school, head, qty=50):
    food = _account_id(client, head, school.id, "5100")
    item = _item(client, head, school.id, food).json()
    client.post(f"/schools/{school.id}/stores/receipts", headers=auth_headers(head), json={"item_id": item["id"], "quantity": qty})
    return item


def test_a_teacher_requests_items_and_the_store_keeper_issues_them(client, db_session, school, school_admin_token):
    item = _stocked(client, school, school_admin_token)
    keeper, kpw = _make_user(db_session, school, UserRole.STORE_KEEPER, "keeper@test-academy.test")
    teacher, tpw = _make_user(db_session, school, UserRole.TEACHER, "store.teacher@test-academy.test")
    k, t = auth_headers(_login(client, keeper.email, kpw)), auth_headers(_login(client, teacher.email, tpw))
    base = f"/schools/{school.id}/stores"
    r = client.post(f"{base}/requests", json={"department": "Grade 4", "note": "For the cooking lesson", "lines": [{"item_id": item["id"], "quantity": 12}]}, headers=t)
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    assert r.json()["reference"].startswith("REQ-") and r.json()["status"] == "requested"
    # the teacher sees their own; the keeper sees all; a teacher cannot issue
    assert len(client.get(f"{base}/requests", headers=t).json()) == 1
    assert client.post(f"{base}/requests/{rid}/issue", headers=t).status_code == 403
    done = client.post(f"{base}/requests/{rid}/issue", json={"quantities": {str(r.json()['lines'][0]['id']): 10}}, headers=k)
    assert done.status_code == 200, done.text
    assert done.json()["status"] == "issued" and done.json()["lines"][0]["quantity_issued"] == 10 and done.json()["decided_by_name"] == keeper.full_name
    stock = next(i for i in client.get(f"{base}/items", headers=k).json() if i["id"] == item["id"])["quantity"]
    assert stock == 40
    assert client.post(f"{base}/requests/{rid}/issue", headers=k).status_code == 409


def test_a_request_beyond_stock_is_refused_and_can_be_declined_with_a_reason(client, db_session, school, school_admin_token):
    item = _stocked(client, school, school_admin_token, qty=5)
    keeper, kpw = _make_user(db_session, school, UserRole.STORE_KEEPER, "keeper2@test-academy.test")
    k = auth_headers(_login(client, keeper.email, kpw))
    base = f"/schools/{school.id}/stores"
    rid = client.post(f"{base}/requests", json={"department": "Kitchen", "lines": [{"item_id": item["id"], "quantity": 20}]}, headers=k).json()["id"]
    r = client.post(f"{base}/requests/{rid}/issue", headers=k)
    assert r.status_code == 400 and "Only 5" in r.json()["detail"]
    assert client.post(f"{base}/requests/{rid}/decline", json={"note": "x"}, headers=k).status_code == 422
    d = client.post(f"{base}/requests/{rid}/decline", json={"note": "Not enough stock until Friday's delivery"}, headers=k)
    assert d.status_code == 200 and d.json()["status"] == "declined"


def test_a_stocktake_corrects_the_book_figure_and_explains_the_difference(client, db_session, school, school_admin_token):
    item = _stocked(client, school, school_admin_token, qty=100)
    keeper, kpw = _make_user(db_session, school, UserRole.STORE_KEEPER, "counter@test-academy.test")
    k = auth_headers(_login(client, keeper.email, kpw))
    base = f"/schools/{school.id}/stores"
    r = client.post(f"{base}/counts", json={"item_id": item["id"], "counted_quantity": 94, "reason": "Six bags spoiled by damp"}, headers=k)
    assert r.status_code == 201, r.text
    assert r.json()["type"] == "adjustment" and r.json()["quantity"] == 6 and "Six bags spoiled" in r.json()["note"]
    assert next(i for i in client.get(f"{base}/items", headers=k).json() if i["id"] == item["id"])["quantity"] == 94
    inventory = next(a for a in client.get(f"/schools/{school.id}/ledger/accounts", headers=auth_headers(school_admin_token)).json() if a["code"] == "1200")
    assert inventory["balance"] == 94 * 150
    assert client.post(f"{base}/counts", json={"item_id": item["id"], "counted_quantity": 94, "reason": "Recount, same"}, headers=k).status_code == 409


def test_accountant_and_procurement_officer_get_their_own_desks(client, db_session, school, school_admin_token):
    acct, apw = _make_user(db_session, school, UserRole.ACCOUNTANT, "accts@test-academy.test")
    buyer, bpw = _make_user(db_session, school, UserRole.PROCUREMENT_OFFICER, "buyer@test-academy.test")
    a, b = auth_headers(_login(client, acct.email, apw)), auth_headers(_login(client, buyer.email, bpw))
    assert client.get(f"/schools/{school.id}/ledger/accounts", headers=a).status_code == 200
    assert client.get(f"/schools/{school.id}/ledger/accounts", headers=b).status_code == 403
    assert client.get(f"/schools/{school.id}/requisitions", headers=b).status_code == 200
    assert client.get(f"/schools/{school.id}/suppliers", headers=b).status_code == 200
    # signing off a purchase stays with the head
    assert client.post(f"/schools/{school.id}/requisitions/1/approve", headers=b).status_code == 403


def test_the_head_sees_what_each_finance_person_did(client, db_session, school, school_admin_token):
    head = school_admin_token
    item = _stocked(client, school, head, qty=30)
    keeper, kpw = _make_user(db_session, school, UserRole.STORE_KEEPER, "watched.keeper@test-academy.test")
    k = auth_headers(_login(client, keeper.email, kpw))
    client.post(f"/schools/{school.id}/stores/issues", json={"item_id": item["id"], "quantity": 4, "department": "Kitchen"}, headers=k)
    r = client.get(f"/schools/{school.id}/oversight/finance-activity", headers=auth_headers(head))
    assert r.status_code == 200, r.text
    body = r.json()
    mine = next(p for p in body["people"] if p["name"] == keeper.full_name)
    assert mine["role"] == "store_keeper" and mine["actions"] == 1 and mine["amount"] == 600
    assert any(e["kind"] == "stock" and "Stock issued: 4" in e["title"] for e in body["events"])
    only = client.get(f"/schools/{school.id}/oversight/finance-activity?actor_id={keeper.id}", headers=auth_headers(head)).json()
    assert {e["actor"] for e in only["events"]} == {keeper.full_name}
    assert client.get(f"/schools/{school.id}/oversight/finance-activity", headers=k).status_code == 403
