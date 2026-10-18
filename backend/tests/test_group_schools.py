"""Group ownership: a school_admin whose own school is the parent of other
schools (branches) can see a rolled-up dashboard across the group and manage
module toggles on any of their own branches."""

from app.models.module import MODULE_KEYS, SchoolModule
from app.models.school import School
from tests.conftest import _login, _make_user, auth_headers
from app.models.user import UserRole


def _make_branch(db_session, parent, name="Milai Secondary", slug="milai-secondary"):
    branch = School(name=name, slug=slug, parent_school_id=parent.id)
    db_session.add(branch)
    db_session.flush()
    for key in MODULE_KEYS:
        db_session.add(SchoolModule(school_id=branch.id, module_key=key, enabled=True))
    db_session.commit()
    return branch


def test_group_summary_rolls_up_branches(client, school_admin_token, school, db_session):
    branch = _make_branch(db_session, school)

    from app.models.academics import Student

    db_session.add(Student(school_id=school.id, admission_number="G-0001", first_name="Group", last_name="Student"))
    db_session.add(Student(school_id=branch.id, admission_number="B-0001", first_name="Branch", last_name="Student"))
    db_session.commit()

    response = client.get(f"/schools/{school.id}/dashboard/group-summary", headers=auth_headers(school_admin_token))
    assert response.status_code == 200
    body = response.json()
    assert body["group_id"] == school.id
    assert len(body["rows"]) == 2
    group_row = next(r for r in body["rows"] if r["is_group"])
    branch_row = next(r for r in body["rows"] if not r["is_group"])
    assert group_row["school_id"] == school.id
    assert branch_row["school_id"] == branch.id
    assert body["total_students"] == 2


def test_group_owner_can_view_a_branchs_full_summary(client, school_admin_token, school, db_session):
    branch = _make_branch(db_session, school)
    response = client.get(f"/schools/{branch.id}/dashboard/summary", headers=auth_headers(school_admin_token))
    assert response.status_code == 200


def test_group_owner_can_toggle_a_branch_module(client, school_admin_token, school, db_session):
    branch = _make_branch(db_session, school)

    response = client.patch(
        f"/schools/{branch.id}/modules/attendance", headers=auth_headers(school_admin_token), json={"enabled": False}
    )
    assert response.status_code == 200
    assert response.json()["enabled"] is False


def test_unrelated_school_admin_cannot_manage_someone_elses_branch(
    client, other_school_admin_token, school, db_session
):
    branch = _make_branch(db_session, school)

    response = client.patch(
        f"/schools/{branch.id}/modules/attendance", headers=auth_headers(other_school_admin_token), json={"enabled": False}
    )
    assert response.status_code == 403


def test_branch_admin_cannot_see_parent_group_summary(client, school, db_session):
    branch = _make_branch(db_session, school)
    branch_admin, password = _make_user(db_session, branch, UserRole.SCHOOL_ADMIN, "admin@milai-secondary.test")
    token = _login(client, branch_admin.email, password)

    response = client.get(f"/schools/{school.id}/dashboard/group-summary", headers=auth_headers(token))
    assert response.status_code == 403
