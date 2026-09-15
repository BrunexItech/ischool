"""Bulk SMS (MobileSasa) — a school's own account, paid from its own SMS
credit. Posting an announcement never fails because SMS isn't set up or
a provider call errors; it's always best-effort on top of the post."""

from unittest.mock import patch

from app.core.crypto import encrypt_secret
from app.models.academics import SchoolClass, Student
from app.models.communication_config import SchoolCommunicationConfig
from tests.conftest import auth_headers


def _configured_school(db_session, school):
    config = SchoolCommunicationConfig(
        school_id=school.id,
        mobilesasa_api_token_encrypted=encrypt_secret("mbs_test_token"),
        mobilesasa_sender_id="TESTSCHOOL",
    )
    db_session.add(config)
    db_session.commit()
    return config


def _student_with_guardian_phone(db_session, school, phone):
    school_class = SchoolClass(school_id=school.id, name="Form 1A")
    db_session.add(school_class)
    db_session.flush()
    student = Student(
        school_id=school.id, class_id=school_class.id, admission_number="TA-1",
        first_name="Test", last_name="Student", guardian_phone=phone,
    )
    db_session.add(student)
    db_session.commit()
    return student


def test_sms_not_configured_does_not_block_the_announcement(client, school_admin_token, school):
    response = client.post(
        f"/schools/{school.id}/announcements",
        headers=auth_headers(school_admin_token),
        json={"title": "Reminder", "body": "Pay fees.", "audience": "parents", "send_sms": True},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["sms_sent"] == 0
    assert "isn't set up" in body["sms_error"]


def test_bulk_sms_sends_to_guardian_phones_on_file(client, db_session, school, school_admin_token):
    _configured_school(db_session, school)
    _student_with_guardian_phone(db_session, school, "+254700000001")

    with patch("app.routers.communication.send_bulk_sms", return_value="bulk-1") as mocked:
        response = client.post(
            f"/schools/{school.id}/announcements",
            headers=auth_headers(school_admin_token),
            json={"title": "Sports Day", "body": "Bring water.", "audience": "all", "send_sms": True},
        )

    assert response.status_code == 201
    assert response.json()["sms_sent"] == 1
    assert mocked.call_args.kwargs["phones"] == ["254700000001"]  # normalized, no "+"


def test_teachers_only_audience_never_triggers_sms(client, db_session, school, school_admin_token):
    _configured_school(db_session, school)
    _student_with_guardian_phone(db_session, school, "0700000001")

    with patch("app.routers.communication.send_bulk_sms") as mocked:
        response = client.post(
            f"/schools/{school.id}/announcements",
            headers=auth_headers(school_admin_token),
            json={"title": "Staff meeting", "body": "3pm.", "audience": "teachers", "send_sms": True},
        )

    assert response.status_code == 201
    assert response.json()["sms_sent"] == 0
    assert not mocked.called


def test_school_admin_cannot_view_another_schools_sms_config(client, school_admin_token, other_school):
    response = client.get(f"/schools/{other_school.id}/communication-config", headers=auth_headers(school_admin_token))
    assert response.status_code == 403


def test_teacher_cannot_change_sms_config(client, teacher_token, school):
    response = client.put(
        f"/schools/{school.id}/communication-config",
        headers=auth_headers(teacher_token),
        json={"mobilesasa_api_token": "mbs_x", "mobilesasa_sender_id": "X"},
    )
    assert response.status_code == 403
