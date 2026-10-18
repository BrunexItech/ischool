"""Admissions CRM: leads move through a pipeline of stages, convert into a
real student record, and are strictly isolated per school."""

from tests.conftest import auth_headers


def _create_lead(client, token, school_id, **overrides):
    payload = {
        "child_name": "Amani Otieno",
        "guardian_name": "Mrs. Otieno",
        "guardian_phone": "+254712345678",
        "grade_interested": "Grade 3",
        "source": "Website",
    }
    payload.update(overrides)
    return client.post(f"/schools/{school_id}/leads", headers=auth_headers(token), json=payload)


def test_create_and_list_lead(client, school_admin_token, school):
    create = _create_lead(client, school_admin_token, school.id)
    assert create.status_code == 201
    body = create.json()
    assert body["stage"] == "enquiry"
    assert body["child_name"] == "Amani Otieno"

    listing = client.get(f"/schools/{school.id}/leads", headers=auth_headers(school_admin_token))
    assert listing.status_code == 200
    assert any(lead["id"] == body["id"] for lead in listing.json())


def test_update_lead_stage(client, school_admin_token, school):
    lead = _create_lead(client, school_admin_token, school.id).json()

    response = client.patch(
        f"/schools/{school.id}/leads/{lead['id']}",
        headers=auth_headers(school_admin_token),
        json={"stage": "visit_booked"},
    )
    assert response.status_code == 200
    assert response.json()["stage"] == "visit_booked"


def test_cannot_see_another_schools_leads(client, school_admin_token, other_school_admin_token, school, other_school):
    lead = _create_lead(client, school_admin_token, school.id).json()

    cross_tenant = client.get(f"/schools/{school.id}/leads", headers=auth_headers(other_school_admin_token))
    assert cross_tenant.status_code == 403

    direct_patch = client.patch(
        f"/schools/{other_school.id}/leads/{lead['id']}",
        headers=auth_headers(other_school_admin_token),
        json={"stage": "lost"},
    )
    assert direct_patch.status_code == 404


def test_convert_lead_creates_a_student_and_locks_the_lead(client, school_admin_token, school):
    lead = _create_lead(client, school_admin_token, school.id).json()

    convert = client.post(
        f"/schools/{school.id}/leads/{lead['id']}/convert",
        headers=auth_headers(school_admin_token),
        json={"admission_number": "ADM-9001", "first_name": "Amani", "last_name": "Otieno"},
    )
    assert convert.status_code == 201
    assert convert.json()["admission_number"] == "ADM-9001"

    leads = client.get(f"/schools/{school.id}/leads", headers=auth_headers(school_admin_token)).json()
    converted = next(l for l in leads if l["id"] == lead["id"])
    assert converted["stage"] == "enrolled"
    assert converted["student_id"] is not None

    # An enrolled lead is locked — no further stage edits.
    blocked = client.patch(
        f"/schools/{school.id}/leads/{lead['id']}",
        headers=auth_headers(school_admin_token),
        json={"stage": "lost"},
    )
    assert blocked.status_code == 400


def test_leads_blocked_when_module_disabled(client, school_admin_token, school, db_session):
    from app.models.module import SchoolModule

    module = db_session.query(SchoolModule).filter_by(school_id=school.id, module_key="admissions_crm").first()
    module.enabled = False
    db_session.commit()

    response = _create_lead(client, school_admin_token, school.id)
    assert response.status_code == 403
