"""Every module (fees, meals, awards, exams...) can be switched off per
school, and a disabled module must actually block access — not just hide
a nav link on the frontend."""

from tests.conftest import auth_headers


def test_disabled_module_blocks_school_admin(client, super_admin_token, school_admin_token, school):
    client.patch(f"/schools/{school.id}/modules/meals", headers=auth_headers(super_admin_token), json={"enabled": False})

    response = client.get(f"/schools/{school.id}/meal-menu", headers=auth_headers(school_admin_token))
    assert response.status_code == 403


def test_reenabled_module_restores_access(client, super_admin_token, school_admin_token, school):
    client.patch(f"/schools/{school.id}/modules/meals", headers=auth_headers(super_admin_token), json={"enabled": False})
    client.patch(f"/schools/{school.id}/modules/meals", headers=auth_headers(super_admin_token), json={"enabled": True})

    response = client.get(f"/schools/{school.id}/meal-menu", headers=auth_headers(school_admin_token))
    assert response.status_code == 200


def test_super_admin_bypasses_module_gating(client, super_admin_token, school):
    client.patch(f"/schools/{school.id}/modules/meals", headers=auth_headers(super_admin_token), json={"enabled": False})

    response = client.get(f"/schools/{school.id}/meal-menu", headers=auth_headers(super_admin_token))
    assert response.status_code == 200


def test_school_admin_cannot_toggle_modules(client, school_admin_token, school):
    """Only super-admin may enable/disable a module — school admins can view but not flip the switch."""
    response = client.patch(f"/schools/{school.id}/modules/meals", headers=auth_headers(school_admin_token), json={"enabled": False})
    assert response.status_code == 403
