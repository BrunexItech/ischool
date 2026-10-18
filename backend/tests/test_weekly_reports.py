"""Weekly report emails: every school's own admin(s) get their school's
summary, and a group (a school with branches) additionally gets a rollup —
both emails, to the same inbox, per the confirmed product requirement."""

from unittest.mock import patch

from app.models.module import MODULE_KEYS, SchoolModule
from app.models.school import School
from app.models.user import UserRole
from tests.conftest import _make_user, auth_headers


def _make_branch(db_session, parent, name="Milai Secondary", slug="milai-secondary"):
    branch = School(name=name, slug=slug, parent_school_id=parent.id)
    db_session.add(branch)
    db_session.flush()
    for key in MODULE_KEYS:
        db_session.add(SchoolModule(school_id=branch.id, module_key=key, enabled=True))
    db_session.commit()
    return branch


def test_super_admin_can_trigger_weekly_reports(client, super_admin_token):
    response = client.post("/schools/weekly-reports/send", headers=auth_headers(super_admin_token))
    assert response.status_code == 200
    body = response.json()
    assert "schools_processed" in body
    assert "branch_reports_sent" in body
    assert "group_reports_sent" in body


def test_school_admin_cannot_trigger_weekly_reports(client, school_admin_token):
    response = client.post("/schools/weekly-reports/send", headers=auth_headers(school_admin_token))
    assert response.status_code == 403


def test_a_standalone_school_gets_only_its_own_branch_report(client, db_session, school, super_admin_token):
    _make_user(db_session, school, UserRole.SCHOOL_ADMIN, "owner@test-academy.test")

    with patch("app.services.weekly_reports.send_email", return_value=True) as mock_send:
        response = client.post("/schools/weekly-reports/send", headers=auth_headers(super_admin_token))
    assert response.status_code == 200

    sent_to = [call.args[0] for call in mock_send.call_args_list]
    assert sent_to.count("owner@test-academy.test") == 1  # branch report only, no group rollup


def test_a_group_owner_gets_both_its_own_report_and_the_group_rollup(client, db_session, school, super_admin_token):
    _make_branch(db_session, school)
    _make_user(db_session, school, UserRole.SCHOOL_ADMIN, "group.owner@test-academy.test")

    with patch("app.services.weekly_reports.send_email", return_value=True) as mock_send:
        response = client.post("/schools/weekly-reports/send", headers=auth_headers(super_admin_token))
    assert response.status_code == 200

    sent_to = [call.args[0] for call in mock_send.call_args_list]
    assert sent_to.count("group.owner@test-academy.test") == 2  # its own branch report + the group rollup

    subjects = [call.args[1] for call in mock_send.call_args_list if call.args[0] == "group.owner@test-academy.test"]
    assert any("weekly summary" in s for s in subjects)
    assert any("weekly group summary" in s for s in subjects)


def test_a_branch_admin_gets_only_their_own_branch_report_not_the_group_rollup(client, db_session, school, super_admin_token):
    branch = _make_branch(db_session, school)
    _make_user(db_session, branch, UserRole.SCHOOL_ADMIN, "branch.admin@test-academy.test")

    with patch("app.services.weekly_reports.send_email", return_value=True) as mock_send:
        response = client.post("/schools/weekly-reports/send", headers=auth_headers(super_admin_token))
    assert response.status_code == 200

    sent_to = [call.args[0] for call in mock_send.call_args_list]
    assert sent_to.count("branch.admin@test-academy.test") == 1


def test_a_school_with_no_admin_user_is_skipped_without_error(client, db_session, school, super_admin_token):
    # `school` has no SCHOOL_ADMIN user by default — this must not crash.
    with patch("app.services.weekly_reports.send_email", return_value=True):
        response = client.post("/schools/weekly-reports/send", headers=auth_headers(super_admin_token))
    assert response.status_code == 200


def test_security_staff_get_their_own_weekly_report_not_the_principal_one(client, db_session, school, super_admin_token):
    _make_user(db_session, school, UserRole.SECURITY, "guard@test-academy.test")

    with patch("app.services.weekly_reports.send_email", return_value=True) as mock_send:
        response = client.post("/schools/weekly-reports/send", headers=auth_headers(super_admin_token))
    assert response.status_code == 200

    calls = [c for c in mock_send.call_args_list if c.args[0] == "guard@test-academy.test"]
    assert len(calls) == 1
    assert "security report" in calls[0].args[1]


def test_bursar_gets_their_own_weekly_finance_report(client, db_session, school, super_admin_token):
    _make_user(db_session, school, UserRole.BURSAR, "bursar2@test-academy.test")

    with patch("app.services.weekly_reports.send_email", return_value=True) as mock_send:
        response = client.post("/schools/weekly-reports/send", headers=auth_headers(super_admin_token))
    assert response.status_code == 200

    calls = [c for c in mock_send.call_args_list if c.args[0] == "bursar2@test-academy.test"]
    assert len(calls) == 1
    assert "finance report" in calls[0].args[1]


def test_a_role_with_no_staff_sends_nothing_for_that_domain(client, db_session, school, super_admin_token):
    # No TRANSPORT_STAFF exists for this school — must not error or send anything for it.
    _make_user(db_session, school, UserRole.SCHOOL_ADMIN, "solo.admin@test-academy.test")

    with patch("app.services.weekly_reports.send_email", return_value=True) as mock_send:
        response = client.post("/schools/weekly-reports/send", headers=auth_headers(super_admin_token))
    assert response.status_code == 200

    subjects = [c.args[1] for c in mock_send.call_args_list]
    assert not any("transport report" in s for s in subjects)


def test_generate_narrative_falls_back_to_plain_text_without_an_api_key():
    from app.core.ai_insights import generate_narrative

    text = generate_narrative("system prompt", "some data", "fallback text")
    assert text == "fallback text"  # no ANTHROPIC_API_KEY configured in this test run


def test_generate_narrative_uses_ai_text_when_configured_and_falls_back_on_failure():
    from app.core import ai_insights

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"choices": [{"message": {"content": "A thoughtfully written weekly narrative."}}]}

    with patch.object(ai_insights.settings, "openai_api_key", "test-key"):
        with patch("app.core.ai_insights.httpx.post", return_value=FakeResponse()):
            text = ai_insights.generate_narrative("sys", "data", "fallback")
        assert text == "A thoughtfully written weekly narrative."

        with patch("app.core.ai_insights.httpx.post", side_effect=RuntimeError("network down")):
            text = ai_insights.generate_narrative("sys", "data", "fallback")
        assert text == "fallback"  # a failed AI call must never break the report
