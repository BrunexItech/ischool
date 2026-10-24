"""The national grade catalogue is fixed; only the Group Principal decides
which of those grades a given school actually offers, and a class can only
be created in a grade the school has turned on."""

from app.core.security import hash_password
from app.models.grade_level import GradeLevel
from app.models.user import User, UserRole
from tests.conftest import _login


def _grade_id(db_session, code):
    return db_session.query(GradeLevel).filter_by(code=code).first().id


def test_group_principal_can_enable_a_contiguous_run_of_grades(client, db_session, school):
    principal = User(
        school_id=school.id, email="gp@test-academy.test", full_name="Group Principal",
        hashed_password=hash_password("TestPass123!"), role=UserRole.GROUP_PRINCIPAL,
    )
    db_session.add(principal)
    db_session.commit()
    headers = {"Authorization": f"Bearer {_login(client, principal.email, 'TestPass123!')}"}

    ids = [_grade_id(db_session, c) for c in ("PP1", "PP2", "G1", "G2", "G3")]
    response = client.put(f"/schools/{school.id}/enabled-grades", headers=headers, json={"grade_level_ids": ids})
    assert response.status_code == 200, response.text
    assert len(response.json()) == 5


def test_enabling_a_grade_without_its_prerequisites_is_rejected(client, db_session, school):
    principal = User(
        school_id=school.id, email="gp2@test-academy.test", full_name="Group Principal",
        hashed_password=hash_password("TestPass123!"), role=UserRole.GROUP_PRINCIPAL,
    )
    db_session.add(principal)
    db_session.commit()
    headers = {"Authorization": f"Bearer {_login(client, principal.email, 'TestPass123!')}"}

    ids = [_grade_id(db_session, c) for c in ("PP1", "G3")]  # skips PP2, G1, G2
    response = client.put(f"/schools/{school.id}/enabled-grades", headers=headers, json={"grade_level_ids": ids})
    assert response.status_code == 400


def test_head_of_institution_cannot_change_enabled_grades(client, db_session, school):
    head = User(
        school_id=school.id, email="hoi@test-academy.test", full_name="Head Of Institution",
        hashed_password=hash_password("TestPass123!"), role=UserRole.HEAD_OF_INSTITUTION,
    )
    db_session.add(head)
    db_session.commit()
    headers = {"Authorization": f"Bearer {_login(client, head.email, 'TestPass123!')}"}

    ids = [_grade_id(db_session, "PP1")]
    response = client.put(f"/schools/{school.id}/enabled-grades", headers=headers, json={"grade_level_ids": ids})
    assert response.status_code == 403


def test_cannot_create_a_class_in_a_grade_the_school_has_not_enabled(client, db_session, school, school_admin_token):
    headers = {"Authorization": f"Bearer {school_admin_token}"}
    g7 = _grade_id(db_session, "G7")

    response = client.post(f"/schools/{school.id}/classes", headers=headers, json={"name": "Grade 7 Chui", "grade_level_id": g7})
    assert response.status_code == 400


def test_can_create_a_class_once_its_grade_is_enabled(client, db_session, school, school_admin_token):
    principal_headers = {"Authorization": f"Bearer {school_admin_token}"}
    ids = [_grade_id(db_session, c) for c in ("PP1", "PP2", "G1")]
    # school_admin_token belongs to HEAD_OF_INSTITUTION now, so enabling grades needs a group_principal instead
    principal = User(
        school_id=school.id, email="gp3@test-academy.test", full_name="Group Principal",
        hashed_password=hash_password("TestPass123!"), role=UserRole.GROUP_PRINCIPAL,
    )
    db_session.add(principal)
    db_session.commit()
    gp_headers = {"Authorization": f"Bearer {_login(client, principal.email, 'TestPass123!')}"}
    client.put(f"/schools/{school.id}/enabled-grades", headers=gp_headers, json={"grade_level_ids": ids})

    g1 = _grade_id(db_session, "G1")
    response = client.post(f"/schools/{school.id}/classes", headers=principal_headers, json={"name": "Grade 1 Chui", "grade_level_id": g1})
    assert response.status_code == 201, response.text
