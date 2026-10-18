"""The general ledger: chart of accounts seeded per school, balanced
double-entry journal postings, trial balance, income statement and balance
sheet — the backbone every other ERP module posts into."""

from datetime import date

from tests.conftest import auth_headers


def _account_id(client, token, school_id, code):
    accounts = client.get(f"/schools/{school_id}/ledger/accounts", headers=auth_headers(token)).json()
    return next(a["id"] for a in accounts if a["code"] == code)


def test_chart_of_accounts_seeded(client, school_admin_token, school):
    response = client.get(f"/schools/{school.id}/ledger/accounts", headers=auth_headers(school_admin_token))
    assert response.status_code == 200
    codes = {a["code"] for a in response.json()}
    assert {"1010", "2010", "4010", "5010", "3000"}.issubset(codes)


def test_post_balanced_journal_entry(client, school_admin_token, school):
    cash = _account_id(client, school_admin_token, school.id, "1010")
    tuition = _account_id(client, school_admin_token, school.id, "4010")

    response = client.post(
        f"/schools/{school.id}/ledger/entries",
        headers=auth_headers(school_admin_token),
        json={
            "entry_date": date.today().isoformat(),
            "reference": "JV-001",
            "memo": "Term 2 tuition fee receipt",
            "lines": [
                {"account_id": cash, "debit": 50000, "credit": 0},
                {"account_id": tuition, "debit": 0, "credit": 50000},
            ],
        },
    )
    assert response.status_code == 201
    assert len(response.json()["lines"]) == 2

    accounts = client.get(f"/schools/{school.id}/ledger/accounts", headers=auth_headers(school_admin_token)).json()
    cash_acc = next(a for a in accounts if a["code"] == "1010")
    tuition_acc = next(a for a in accounts if a["code"] == "4010")
    assert cash_acc["balance"] == 50000
    assert tuition_acc["balance"] == 50000


def test_unbalanced_journal_entry_rejected(client, school_admin_token, school):
    cash = _account_id(client, school_admin_token, school.id, "1010")
    tuition = _account_id(client, school_admin_token, school.id, "4010")

    response = client.post(
        f"/schools/{school.id}/ledger/entries",
        headers=auth_headers(school_admin_token),
        json={
            "entry_date": date.today().isoformat(),
            "reference": "JV-002",
            "memo": "Unbalanced entry",
            "lines": [
                {"account_id": cash, "debit": 50000, "credit": 0},
                {"account_id": tuition, "debit": 0, "credit": 40000},
            ],
        },
    )
    assert response.status_code == 422


def test_line_cannot_have_both_debit_and_credit(client, school_admin_token, school):
    cash = _account_id(client, school_admin_token, school.id, "1010")
    tuition = _account_id(client, school_admin_token, school.id, "4010")

    response = client.post(
        f"/schools/{school.id}/ledger/entries",
        headers=auth_headers(school_admin_token),
        json={
            "entry_date": date.today().isoformat(),
            "reference": "JV-003",
            "memo": "Bad line",
            "lines": [
                {"account_id": cash, "debit": 1000, "credit": 1000},
                {"account_id": tuition, "debit": 0, "credit": 1000},
            ],
        },
    )
    assert response.status_code == 422


def test_income_statement_and_balance_sheet(client, school_admin_token, school):
    cash = _account_id(client, school_admin_token, school.id, "1010")
    tuition = _account_id(client, school_admin_token, school.id, "4010")
    stationery = _account_id(client, school_admin_token, school.id, "5190")

    client.post(
        f"/schools/{school.id}/ledger/entries",
        headers=auth_headers(school_admin_token),
        json={
            "entry_date": date.today().isoformat(),
            "reference": "JV-010",
            "memo": "Fee receipt",
            "lines": [{"account_id": cash, "debit": 100000, "credit": 0}, {"account_id": tuition, "debit": 0, "credit": 100000}],
        },
    )
    client.post(
        f"/schools/{school.id}/ledger/entries",
        headers=auth_headers(school_admin_token),
        json={
            "entry_date": date.today().isoformat(),
            "reference": "JV-011",
            "memo": "Stationery purchase",
            "lines": [{"account_id": stationery, "debit": 15000, "credit": 0}, {"account_id": cash, "debit": 0, "credit": 15000}],
        },
    )

    income_statement = client.get(f"/schools/{school.id}/ledger/income-statement", headers=auth_headers(school_admin_token)).json()
    assert income_statement["income_total"] == 100000
    assert income_statement["expense_total"] == 15000
    assert income_statement["surplus"] == 85000

    balance_sheet = client.get(f"/schools/{school.id}/ledger/balance-sheet", headers=auth_headers(school_admin_token)).json()
    assert balance_sheet["assets_total"] == 85000
    assert balance_sheet["period_surplus"] == 85000
    assert round(balance_sheet["assets_total"], 2) == round(balance_sheet["liabilities_total"] + balance_sheet["equity_total"], 2)


def test_teacher_cannot_access_ledger(client, teacher_token, school):
    response = client.get(f"/schools/{school.id}/ledger/accounts", headers=auth_headers(teacher_token))
    assert response.status_code == 403


def test_cannot_see_another_schools_ledger(client, school_admin_token, other_school_admin_token, school):
    cross_tenant = client.get(f"/schools/{school.id}/ledger/accounts", headers=auth_headers(other_school_admin_token))
    assert cross_tenant.status_code == 403


def test_ledger_blocked_when_module_disabled(client, school_admin_token, school, db_session):
    from app.models.module import SchoolModule

    module = db_session.query(SchoolModule).filter_by(school_id=school.id, module_key="erp_finance").first()
    module.enabled = False
    db_session.commit()

    response = client.get(f"/schools/{school.id}/ledger/accounts", headers=auth_headers(school_admin_token))
    assert response.status_code == 403
