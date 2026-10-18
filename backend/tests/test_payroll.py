"""Payroll: Kenya statutory deductions (PAYE, NSSF, SHIF, housing levy)
computed per the February 2026 bands, run through a draft -> paid lifecycle
that posts a real, balanced journal entry."""

from tests.conftest import _make_user, auth_headers
from app.core.payroll_calc import compute_pay
from app.models.user import UserRole


def test_payroll_calc_matches_known_figures():
    # A mid-salary non-teaching staff member: basic 34000, house 5000, transport 3000
    calc = compute_pay(34000, 5000, 3000)
    assert calc.gross == 42000
    assert calc.nssf == 2520  # 6% of 42000
    assert calc.shif == 1155  # 2.75% of 42000, above the 300 minimum
    assert calc.ahl == 630  # 1.5% of 42000
    assert calc.net == calc.gross - calc.nssf - calc.shif - calc.ahl - calc.paye


def _teacher_id(db_session, school):
    user, _ = _make_user(db_session, school, UserRole.TEACHER, "payroll.teacher@test-academy.test")
    return user.id


def test_create_payroll_profile(client, school_admin_token, school, db_session):
    user_id = _teacher_id(db_session, school)
    response = client.post(
        f"/schools/{school.id}/payroll/profiles",
        headers=auth_headers(school_admin_token),
        json={"user_id": user_id, "employment_type": "teaching", "basic_salary": 45000, "house_allowance": 10000, "transport_allowance": 5000, "kra_pin": "A012345678Z", "nssf_number": "20900001"},
    )
    assert response.status_code == 201
    assert response.json()["staff_name"]


def test_cannot_create_duplicate_profile(client, school_admin_token, school, db_session):
    user_id = _teacher_id(db_session, school)
    payload = {"user_id": user_id, "employment_type": "teaching", "basic_salary": 45000, "kra_pin": "A012345678Z", "nssf_number": "20900001"}
    first = client.post(f"/schools/{school.id}/payroll/profiles", headers=auth_headers(school_admin_token), json=payload)
    assert first.status_code == 201
    second = client.post(f"/schools/{school.id}/payroll/profiles", headers=auth_headers(school_admin_token), json=payload)
    assert second.status_code == 400


def test_run_payroll_and_pay_posts_balanced_journal(client, school_admin_token, school, db_session):
    teacher_id = _teacher_id(db_session, school)
    user2, _ = _make_user(db_session, school, UserRole.STAFF, "payroll.staff@test-academy.test")

    client.post(
        f"/schools/{school.id}/payroll/profiles",
        headers=auth_headers(school_admin_token),
        json={"user_id": teacher_id, "employment_type": "teaching", "basic_salary": 45000, "house_allowance": 10000, "transport_allowance": 5000, "kra_pin": "A012345678Z", "nssf_number": "20900001"},
    )
    client.post(
        f"/schools/{school.id}/payroll/profiles",
        headers=auth_headers(school_admin_token),
        json={"user_id": user2.id, "employment_type": "non_teaching", "basic_salary": 30000, "house_allowance": 5000, "transport_allowance": 3000, "kra_pin": "A087654321Z", "nssf_number": "20900002"},
    )

    run = client.post(f"/schools/{school.id}/payroll/runs", headers=auth_headers(school_admin_token), json={"period": "2026-11"})
    assert run.status_code == 201
    assert run.json()["status"] == "draft"
    assert len(run.json()["lines"]) == 2

    pay = client.post(f"/schools/{school.id}/payroll/runs/{run.json()['id']}/pay", headers=auth_headers(school_admin_token))
    assert pay.status_code == 200
    assert pay.json()["status"] == "paid"

    accounts = client.get(f"/schools/{school.id}/ledger/accounts", headers=auth_headers(school_admin_token)).json()
    by_code = {a["code"]: a for a in accounts}
    lines = run.json()["lines"]
    g_teach = sum(l["gross"] for l in lines if l["employment_type"] == "teaching")
    g_non = sum(l["gross"] for l in lines if l["employment_type"] == "non_teaching")
    assert by_code["5010"]["balance"] == g_teach
    assert by_code["5020"]["balance"] == g_non

    # The ledger must stay in balance: assets == liabilities + equity (+ period surplus)
    bs = client.get(f"/schools/{school.id}/ledger/balance-sheet", headers=auth_headers(school_admin_token)).json()
    assert round(bs["assets_total"], 2) == round(bs["liabilities_total"] + bs["equity_total"], 2)


def test_duplicate_period_rejected(client, school_admin_token, school, db_session):
    teacher_id = _teacher_id(db_session, school)
    client.post(
        f"/schools/{school.id}/payroll/profiles",
        headers=auth_headers(school_admin_token),
        json={"user_id": teacher_id, "employment_type": "teaching", "basic_salary": 45000, "kra_pin": "A012345678Z", "nssf_number": "20900001"},
    )
    first = client.post(f"/schools/{school.id}/payroll/runs", headers=auth_headers(school_admin_token), json={"period": "2026-12"})
    assert first.status_code == 201
    second = client.post(f"/schools/{school.id}/payroll/runs", headers=auth_headers(school_admin_token), json={"period": "2026-12"})
    assert second.status_code == 400


def test_cannot_pay_a_run_twice(client, school_admin_token, school, db_session):
    teacher_id = _teacher_id(db_session, school)
    client.post(
        f"/schools/{school.id}/payroll/profiles",
        headers=auth_headers(school_admin_token),
        json={"user_id": teacher_id, "employment_type": "teaching", "basic_salary": 45000, "kra_pin": "A012345678Z", "nssf_number": "20900001"},
    )
    run = client.post(f"/schools/{school.id}/payroll/runs", headers=auth_headers(school_admin_token), json={"period": "2027-01"}).json()
    client.post(f"/schools/{school.id}/payroll/runs/{run['id']}/pay", headers=auth_headers(school_admin_token))
    second = client.post(f"/schools/{school.id}/payroll/runs/{run['id']}/pay", headers=auth_headers(school_admin_token))
    assert second.status_code == 400


def test_teacher_cannot_access_payroll(client, teacher_token, school):
    response = client.get(f"/schools/{school.id}/payroll/profiles", headers=auth_headers(teacher_token))
    assert response.status_code == 403


def test_cannot_see_another_schools_payroll(client, school_admin_token, other_school_admin_token, school):
    cross_tenant = client.get(f"/schools/{school.id}/payroll/profiles", headers=auth_headers(other_school_admin_token))
    assert cross_tenant.status_code == 403


def test_payroll_blocked_when_module_disabled(client, school_admin_token, school, db_session):
    from app.models.module import SchoolModule

    module = db_session.query(SchoolModule).filter_by(school_id=school.id, module_key="erp_finance").first()
    module.enabled = False
    db_session.commit()

    response = client.get(f"/schools/{school.id}/payroll/profiles", headers=auth_headers(school_admin_token))
    assert response.status_code == 403
