"""School calendar: any event type, viewable by everyone in the school,
editable only by admins, and strictly isolated per school."""

from tests.conftest import auth_headers


def _create_event(client, token, school_id, **overrides):
    payload = {
        "title": "Parents' academic clinic",
        "event_type": "meeting",
        "start_date": "2026-10-23",
    }
    payload.update(overrides)
    return client.post(f"/schools/{school_id}/calendar-events", headers=auth_headers(token), json=payload)


def test_create_and_list_event(client, school_admin_token, school):
    create = _create_event(client, school_admin_token, school.id)
    assert create.status_code == 201
    body = create.json()
    assert body["event_type"] == "meeting"

    listing = client.get(f"/schools/{school.id}/calendar-events", headers=auth_headers(school_admin_token))
    assert listing.status_code == 200
    assert any(e["id"] == body["id"] for e in listing.json())


def test_end_date_before_start_date_is_rejected(client, school_admin_token, school):
    response = _create_event(client, school_admin_token, school.id, start_date="2026-11-20", end_date="2026-11-16")
    assert response.status_code == 422


def test_multi_day_event_and_date_range_filter(client, school_admin_token, school):
    _create_event(client, school_admin_token, school.id, title="End-term assessments", event_type="exam", start_date="2026-11-16", end_date="2026-11-19")
    _create_event(client, school_admin_token, school.id, title="Mashujaa Day", event_type="holiday", start_date="2026-10-20")

    in_window = client.get(
        f"/schools/{school.id}/calendar-events",
        headers=auth_headers(school_admin_token),
        params={"from_date": "2026-11-01", "to_date": "2026-11-30"},
    )
    titles = [e["title"] for e in in_window.json()]
    assert "End-term assessments" in titles
    assert "Mashujaa Day" not in titles


def test_only_admins_can_create_or_edit_events(client, teacher_token, school):
    response = _create_event(client, teacher_token, school.id)
    assert response.status_code == 403


def test_cannot_see_another_schools_events(client, school_admin_token, other_school_admin_token, school):
    event = _create_event(client, school_admin_token, school.id).json()

    cross_tenant = client.get(f"/schools/{school.id}/calendar-events", headers=auth_headers(other_school_admin_token))
    assert cross_tenant.status_code == 403

    direct_delete = client.delete(
        f"/schools/{school.id}/calendar-events/{event['id']}", headers=auth_headers(other_school_admin_token)
    )
    assert direct_delete.status_code == 403


def test_events_blocked_when_module_disabled(client, school_admin_token, school, db_session):
    from app.models.module import SchoolModule

    module = db_session.query(SchoolModule).filter_by(school_id=school.id, module_key="school_calendar").first()
    module.enabled = False
    db_session.commit()

    response = _create_event(client, school_admin_token, school.id)
    assert response.status_code == 403
