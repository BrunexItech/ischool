"""The national grade catalogue is fixed; the head of institution (or the
group principal) decides which of those grades the school actually offers, and
a class can only be created in a grade the school has turned on."""

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


def test_a_school_can_offer_any_selection_of_grades(client, db_session, school, school_admin_token):
    """A junior school may offer only Grades 7 to 9 - nothing forces PP1 first."""
    headers = {"Authorization": f"Bearer {school_admin_token}"}
    ids = [_grade_id(db_session, c) for c in ("G7", "G8", "G9")]
    response = client.put(f"/schools/{school.id}/enabled-grades", headers=headers, json={"grade_level_ids": ids})
    assert response.status_code == 200, response.text
    assert [g["code"] for g in response.json()] == ["G7", "G8", "G9"]


def test_head_of_institution_enables_their_own_grades_but_not_another_schools(client, db_session, school, other_school, school_admin_token):
    headers = {"Authorization": f"Bearer {school_admin_token}"}
    ids = [_grade_id(db_session, "PP1")]
    assert client.put(f"/schools/{school.id}/enabled-grades", headers=headers, json={"grade_level_ids": ids}).status_code == 200
    assert client.put(f"/schools/{other_school.id}/enabled-grades", headers=headers, json={"grade_level_ids": ids}).status_code == 403


def test_a_grade_with_classes_cannot_be_switched_off(client, db_session, school, school_admin_token):
    headers = {"Authorization": f"Bearer {school_admin_token}"}
    g3, g4 = _grade_id(db_session, "G3"), _grade_id(db_session, "G4")
    client.put(f"/schools/{school.id}/enabled-grades", headers=headers, json={"grade_level_ids": [g3, g4]})
    assert client.post(f"/schools/{school.id}/classes", headers=headers, json={"name": "Grade 3 Chui", "grade_level_id": g3}).status_code == 201
    refused = client.put(f"/schools/{school.id}/enabled-grades", headers=headers, json={"grade_level_ids": [g4]})
    assert refused.status_code == 400 and "Grade 3" in refused.json()["detail"]


def test_streams_become_classes_named_after_the_grade(client, db_session, school, school_admin_token):
    headers = {"Authorization": f"Bearer {school_admin_token}"}
    g3 = _grade_id(db_session, "G3")
    assert client.post(f"/schools/{school.id}/classes/streams", headers=headers, json={"grade_level_id": g3, "streams": ["Chui"]}).status_code == 400  # grade not enabled
    client.put(f"/schools/{school.id}/enabled-grades", headers=headers, json={"grade_level_ids": [g3]})
    r = client.post(f"/schools/{school.id}/classes/streams", headers=headers, json={"grade_level_id": g3, "streams": ["Chui", "Simba", "chui"]})
    assert r.status_code == 201, r.text
    assert r.json()["created"] == ["Grade 3 Chui", "Grade 3 Simba"]
    again = client.post(f"/schools/{school.id}/classes/streams", headers=headers, json={"grade_level_id": g3, "streams": ["Chui", "Twiga"]}).json()
    assert again["created"] == ["Grade 3 Twiga"] and again["skipped"] == ["Grade 3 Chui"]
    single = client.post(f"/schools/{school.id}/classes/streams", headers=headers, json={"grade_level_id": g3, "streams": []}).json()
    assert single["created"] == ["Grade 3"]


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
