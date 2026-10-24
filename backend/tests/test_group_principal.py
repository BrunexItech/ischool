"""The Group Principal/Head of Institution hierarchy reuses the existing
branch-access mechanism: a GROUP_PRINCIPAL's own school is the umbrella
(school_type=GROUP) and every real school's parent_school_id points at it,
so the same parent-match check that already let a group-owning admin reach
their branches now gives the Group Principal reach across the whole group."""

from app.core.security import hash_password
from app.models.module import SchoolModule
from app.models.school import School, SchoolType
from app.models.user import User, UserRole
from tests.conftest import _login


def _make_group_with_two_schools(db_session):
    group = School(name="Milai Group", slug="milai-group", school_type=SchoolType.GROUP)
    db_session.add(group)
    db_session.flush()

    school_a = School(name="Milai North", slug="milai-north", parent_school_id=group.id)
    school_b = School(name="Milai East", slug="milai-east", parent_school_id=group.id)
    db_session.add_all([school_a, school_b])
    db_session.flush()
    db_session.add(SchoolModule(school_id=school_a.id, module_key="students_staff", enabled=True))
    db_session.add(SchoolModule(school_id=school_b.id, module_key="students_staff", enabled=True))
    db_session.commit()
    return group, school_a, school_b


def test_group_principal_can_reach_every_school_under_the_group(client, db_session):
    group, school_a, school_b = _make_group_with_two_schools(db_session)
    principal = User(
        school_id=group.id, email="principal@milai.test", full_name="Group Principal",
        hashed_password=hash_password("TestPass123!"), role=UserRole.GROUP_PRINCIPAL,
    )
    db_session.add(principal)
    db_session.commit()
    headers = {"Authorization": f"Bearer {_login(client, principal.email, 'TestPass123!')}"}

    for s in (school_a, school_b):
        response = client.get(f"/schools/{s.id}/classes", headers=headers)
        assert response.status_code == 200, response.text


def test_group_principal_cannot_reach_a_school_outside_the_group(client, db_session, school):
    group, school_a, _ = _make_group_with_two_schools(db_session)
    principal = User(
        school_id=group.id, email="principal2@milai.test", full_name="Group Principal",
        hashed_password=hash_password("TestPass123!"), role=UserRole.GROUP_PRINCIPAL,
    )
    db_session.add(principal)
    db_session.commit()
    headers = {"Authorization": f"Bearer {_login(client, principal.email, 'TestPass123!')}"}

    response = client.get(f"/schools/{school.id}/classes", headers=headers)
    assert response.status_code == 403


def test_head_of_institution_restricted_to_their_own_school(client, db_session):
    group, school_a, school_b = _make_group_with_two_schools(db_session)
    head = User(
        school_id=school_a.id, email="head@milai.test", full_name="Head Of Institution",
        hashed_password=hash_password("TestPass123!"), role=UserRole.HEAD_OF_INSTITUTION,
    )
    db_session.add(head)
    db_session.commit()
    headers = {"Authorization": f"Bearer {_login(client, head.email, 'TestPass123!')}"}

    own = client.get(f"/schools/{school_a.id}/classes", headers=headers)
    assert own.status_code == 200, own.text

    other = client.get(f"/schools/{school_b.id}/classes", headers=headers)
    assert other.status_code == 403
