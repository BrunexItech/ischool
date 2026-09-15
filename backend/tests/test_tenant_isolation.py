"""A school admin, teacher, or parent must never be able to reach another
school's data, no matter how directly they ask for it. This is the single
most important guarantee in a multi-tenant system — a regression here is
a data breach, not just a bug."""

from tests.conftest import auth_headers


def test_school_admin_cannot_list_another_schools_students(client, school_admin_token, other_school):
    response = client.get(f"/schools/{other_school.id}/classes", headers=auth_headers(school_admin_token))
    assert response.status_code == 403


def test_school_admin_cannot_view_another_schools_payment_config(client, school_admin_token, other_school):
    response = client.get(f"/schools/{other_school.id}/payment-config", headers=auth_headers(school_admin_token))
    assert response.status_code == 403


def test_school_admin_cannot_modify_another_schools_modules(client, super_admin_token, school_admin_token, other_school):
    response = client.patch(
        f"/schools/{other_school.id}/modules/fees",
        headers=auth_headers(school_admin_token),
        json={"enabled": False},
    )
    assert response.status_code == 403


def test_super_admin_can_reach_any_school(client, super_admin_token, school, other_school):
    for target in (school, other_school):
        response = client.get(f"/schools/{target.id}/modules", headers=auth_headers(super_admin_token))
        assert response.status_code == 200


def test_teacher_cannot_reach_a_school_they_do_not_belong_to(client, teacher_token, other_school):
    response = client.get(f"/schools/{other_school.id}/classes", headers=auth_headers(teacher_token))
    assert response.status_code == 403


def test_school_admin_cannot_rebrand_another_school(client, school_admin_token, other_school):
    """Regression test: update_branding used to skip ensure_school_access
    entirely, so any school_admin could rename or re-logo any school."""
    response = client.patch(
        f"/schools/{other_school.id}/branding",
        headers=auth_headers(school_admin_token),
        json={"name": "Hijacked Name"},
    )
    assert response.status_code == 403


def test_school_admin_cannot_upload_a_logo_for_another_school(client, school_admin_token, other_school):
    response = client.post(
        f"/schools/{other_school.id}/branding/logo",
        headers=auth_headers(school_admin_token),
        files={"logo": ("logo.png", b"\x89PNG\r\n\x1a\n", "image/png")},
    )
    assert response.status_code == 403
