"""Suppliers: KRA PIN-validated vendor registry for the procurement cluster."""

from tests.conftest import auth_headers


def _supplier(client, token, school_id, **overrides):
    payload = {
        "name": "Chandarana Supermarket Ltd",
        "kra_pin": "P051234567X",
        "category": "Food",
        "phone": "+254700000000",
        "email": "accounts@chandarana.co.ke",
    }
    payload.update(overrides)
    return client.post(f"/schools/{school_id}/suppliers", headers=auth_headers(token), json=payload)


def test_create_supplier(client, school_admin_token, school):
    response = _supplier(client, school_admin_token, school.id)
    assert response.status_code == 201
    assert response.json()["kra_pin"] == "P051234567X"


def test_invalid_kra_pin_rejected(client, school_admin_token, school):
    response = _supplier(client, school_admin_token, school.id, kra_pin="not-a-pin")
    assert response.status_code == 422


def test_duplicate_pin_rejected(client, school_admin_token, school):
    first = _supplier(client, school_admin_token, school.id)
    assert first.status_code == 201
    second = _supplier(client, school_admin_token, school.id, name="Another Vendor")
    assert second.status_code == 400


def test_update_supplier(client, school_admin_token, school):
    supplier = _supplier(client, school_admin_token, school.id).json()
    response = client.patch(
        f"/schools/{school.id}/suppliers/{supplier['id']}", headers=auth_headers(school_admin_token), json={"is_active": False}
    )
    assert response.status_code == 200
    assert response.json()["is_active"] is False


def test_teacher_cannot_access_suppliers(client, teacher_token, school):
    response = _supplier(client, teacher_token, school.id)
    assert response.status_code == 403


def test_cannot_see_another_schools_suppliers(client, school_admin_token, other_school_admin_token, school):
    _supplier(client, school_admin_token, school.id)
    cross_tenant = client.get(f"/schools/{school.id}/suppliers", headers=auth_headers(other_school_admin_token))
    assert cross_tenant.status_code == 403


def test_suppliers_blocked_when_module_disabled(client, school_admin_token, school, db_session):
    from app.models.module import SchoolModule

    module = db_session.query(SchoolModule).filter_by(school_id=school.id, module_key="erp_finance").first()
    module.enabled = False
    db_session.commit()

    response = _supplier(client, school_admin_token, school.id)
    assert response.status_code == 403
