"""Fixed assets: a register with straight-line depreciation, run monthly and
posted as a real, balanced journal entry."""

from datetime import date

from tests.conftest import auth_headers


def _account_id(client, token, school_id, code):
    accounts = client.get(f"/schools/{school_id}/ledger/accounts", headers=auth_headers(token)).json()
    return next(a["id"] for a in accounts if a["code"] == code)


def _asset(client, token, school_id, account_id, **overrides):
    payload = {
        "name": "School bus KDG 340L",
        "account_id": account_id,
        "acquisition_date": "2026-01-01",
        "cost": 2_400_000,
        "residual_value": 0,
        "useful_life_years": 10,
    }
    payload.update(overrides)
    return client.post(f"/schools/{school_id}/assets", headers=auth_headers(token), json=payload)


def test_create_asset_capitalises_cost_into_the_ledger(client, school_admin_token, school):
    vehicles = _account_id(client, school_admin_token, school.id, "1500")
    response = _asset(client, school_admin_token, school.id, vehicles)
    assert response.status_code == 201
    assert response.json()["code"] == "AST-0001"
    assert response.json()["net_book_value"] == 2_400_000

    accounts = client.get(f"/schools/{school.id}/ledger/accounts", headers=auth_headers(school_admin_token)).json()
    vehicles_balance = next(a for a in accounts if a["code"] == "1500")
    payable = next(a for a in accounts if a["code"] == "2010")
    assert vehicles_balance["balance"] == 2_400_000
    assert payable["balance"] == 2_400_000


def test_residual_must_be_less_than_cost(client, school_admin_token, school):
    vehicles = _account_id(client, school_admin_token, school.id, "1500")
    response = _asset(client, school_admin_token, school.id, vehicles, residual_value=2_400_000)
    assert response.status_code == 400


def test_depreciation_run_posts_balanced_journal(client, school_admin_token, school):
    vehicles = _account_id(client, school_admin_token, school.id, "1500")
    # 2,400,000 cost, 0 residual, 10-year life -> 20,000/month straight-line
    _asset(client, school_admin_token, school.id, vehicles)

    run = client.post(f"/schools/{school.id}/assets/depreciation-runs", headers=auth_headers(school_admin_token), json={"period": "2026-02"})
    assert run.status_code == 201
    assert run.json()["total_amount"] == 20000.0

    accounts = client.get(f"/schools/{school.id}/ledger/accounts", headers=auth_headers(school_admin_token)).json()
    dep_expense = next(a for a in accounts if a["code"] == "5200")
    accum = next(a for a in accounts if a["code"] == "1590")
    assert dep_expense["balance"] == 20000
    # Accumulated depreciation is a contra-asset: it carries a credit balance,
    # which nets negative under the asset-account debit-credit convention.
    assert accum["balance"] == -20000

    assets = client.get(f"/schools/{school.id}/assets", headers=auth_headers(school_admin_token)).json()
    asset = assets[0]
    assert asset["accumulated_depreciation"] == 20000
    assert asset["net_book_value"] == 2_380_000

    bs = client.get(f"/schools/{school.id}/ledger/balance-sheet", headers=auth_headers(school_admin_token)).json()
    assert round(bs["assets_total"], 2) == round(bs["liabilities_total"] + bs["equity_total"], 2)


def test_cannot_run_same_period_twice(client, school_admin_token, school):
    vehicles = _account_id(client, school_admin_token, school.id, "1500")
    _asset(client, school_admin_token, school.id, vehicles)
    first = client.post(f"/schools/{school.id}/assets/depreciation-runs", headers=auth_headers(school_admin_token), json={"period": "2026-03"})
    assert first.status_code == 201
    second = client.post(f"/schools/{school.id}/assets/depreciation-runs", headers=auth_headers(school_admin_token), json={"period": "2026-03"})
    assert second.status_code == 400


def test_dispose_asset(client, school_admin_token, school):
    vehicles = _account_id(client, school_admin_token, school.id, "1500")
    asset = _asset(client, school_admin_token, school.id, vehicles).json()
    response = client.post(f"/schools/{school.id}/assets/{asset['id']}/dispose", headers=auth_headers(school_admin_token))
    assert response.status_code == 200
    assert response.json()["status"] == "disposed"


def test_teacher_cannot_access_assets(client, teacher_token, school):
    response = client.get(f"/schools/{school.id}/assets", headers=auth_headers(teacher_token))
    assert response.status_code == 403


def test_cannot_see_another_schools_assets(client, school_admin_token, other_school_admin_token, school):
    cross_tenant = client.get(f"/schools/{school.id}/assets", headers=auth_headers(other_school_admin_token))
    assert cross_tenant.status_code == 403


def test_assets_blocked_when_module_disabled(client, school_admin_token, school, db_session):
    from app.models.module import SchoolModule

    module = db_session.query(SchoolModule).filter_by(school_id=school.id, module_key="erp_finance").first()
    module.enabled = False
    db_session.commit()

    response = client.get(f"/schools/{school.id}/assets", headers=auth_headers(school_admin_token))
    assert response.status_code == 403
