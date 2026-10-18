"""An announcement's class_id actually narrows who hears about it — both
the in-app notification and the opt-in SMS/email blast — instead of always
reaching every parent/student in the school regardless of which class was
picked."""

from unittest.mock import patch

from app.models.academics import SchoolClass, Student
from app.models.notification import Notification
from app.models.user import UserRole
from tests.conftest import _make_user, auth_headers


def _make_class(db_session, school, name):
    cls = SchoolClass(school_id=school.id, name=name)
    db_session.add(cls)
    db_session.flush()
    return cls


def _make_student_with_guardian(db_session, school, cls, admission_number, guardian_user, guardian_phone, guardian_email):
    student = Student(
        school_id=school.id,
        class_id=cls.id,
        admission_number=admission_number,
        first_name="Learner",
        last_name=admission_number,
        guardian_user_id=guardian_user.id,
        guardian_phone=guardian_phone,
        guardian_email=guardian_email,
    )
    db_session.add(student)
    db_session.flush()
    return student


def test_class_scoped_announcement_only_notifies_that_classs_parents(client, db_session, school, school_admin_token):
    class_a = _make_class(db_session, school, "Grade 4A")
    class_b = _make_class(db_session, school, "Grade 5B")
    parent_a, _ = _make_user(db_session, school, UserRole.PARENT, "parent.a@test-academy.test")
    parent_b, _ = _make_user(db_session, school, UserRole.PARENT, "parent.b@test-academy.test")
    _make_student_with_guardian(db_session, school, class_a, "CLS-001", parent_a, "0712345678", "parent.a@test-academy.test")
    _make_student_with_guardian(db_session, school, class_b, "CLS-002", parent_b, "0712345679", "parent.b@test-academy.test")
    db_session.commit()

    response = client.post(
        f"/schools/{school.id}/announcements",
        headers=auth_headers(school_admin_token),
        json={"title": "Grade 4A trip", "body": "Bring boots.", "audience": "parents", "class_id": class_a.id},
    )
    assert response.status_code == 201, response.text

    notified_user_ids = {n.user_id for n in db_session.query(Notification).filter_by(school_id=school.id).all()}
    assert parent_a.id in notified_user_ids
    assert parent_b.id not in notified_user_ids


def test_class_scoped_sms_only_reaches_that_classs_guardians(client, db_session, school, school_admin_token):
    class_a = _make_class(db_session, school, "Grade 4A")
    class_b = _make_class(db_session, school, "Grade 5B")
    parent_a, _ = _make_user(db_session, school, UserRole.PARENT, "sms.a@test-academy.test")
    parent_b, _ = _make_user(db_session, school, UserRole.PARENT, "sms.b@test-academy.test")
    _make_student_with_guardian(db_session, school, class_a, "SMS-001", parent_a, "0712300001", "sms.a@test-academy.test")
    _make_student_with_guardian(db_session, school, class_b, "SMS-002", parent_b, "0712300002", "sms.b@test-academy.test")

    from app.models.communication_config import SchoolCommunicationConfig
    from app.core.crypto import encrypt_secret

    db_session.add(SchoolCommunicationConfig(school_id=school.id, mobilesasa_api_token_encrypted=encrypt_secret("tok"), mobilesasa_sender_id="SCHOOL"))
    db_session.commit()

    with patch("app.routers.communication.send_bulk_sms", return_value={"sent": 1}) as mock_sms:
        response = client.post(
            f"/schools/{school.id}/announcements",
            headers=auth_headers(school_admin_token),
            json={"title": "Grade 4A trip", "body": "Bring boots.", "audience": "parents", "class_id": class_a.id, "send_sms": True},
        )
    assert response.status_code == 201, response.text
    assert response.json()["sms_sent"] == 1
    phones_sent = mock_sms.call_args.kwargs["phones"]
    assert phones_sent == ["254712300001"]


def test_class_scoped_email_reaches_only_that_classs_guardians_with_admin_cc(client, db_session, school, school_admin_token):
    class_a = _make_class(db_session, school, "Grade 4A")
    class_b = _make_class(db_session, school, "Grade 5B")
    parent_a, _ = _make_user(db_session, school, UserRole.PARENT, "email.a@test-academy.test")
    parent_b, _ = _make_user(db_session, school, UserRole.PARENT, "email.b@test-academy.test")
    _make_student_with_guardian(db_session, school, class_a, "EML-001", parent_a, "0712300003", "email.a@test-academy.test")
    _make_student_with_guardian(db_session, school, class_b, "EML-002", parent_b, "0712300004", "email.b@test-academy.test")
    db_session.commit()

    with patch("app.routers.communication.send_email", return_value=True) as mock_send:
        response = client.post(
            f"/schools/{school.id}/announcements",
            headers=auth_headers(school_admin_token),
            json={"title": "Grade 4A trip", "body": "Bring boots.", "audience": "parents", "class_id": class_a.id, "send_email": True},
        )
    assert response.status_code == 201, response.text
    assert response.json()["email_sent"] == 1

    assert mock_send.call_count == 1
    call = mock_send.call_args
    assert call.args[0] == "email.a@test-academy.test"
    assert call.kwargs["reply_to"] == "admin@test-academy.test"


def test_non_class_announcement_reaches_every_parent(client, db_session, school, school_admin_token):
    class_a = _make_class(db_session, school, "Grade 4A")
    class_b = _make_class(db_session, school, "Grade 5B")
    parent_a, _ = _make_user(db_session, school, UserRole.PARENT, "all.a@test-academy.test")
    parent_b, _ = _make_user(db_session, school, UserRole.PARENT, "all.b@test-academy.test")
    _make_student_with_guardian(db_session, school, class_a, "ALL-001", parent_a, "0712300005", "all.a@test-academy.test")
    _make_student_with_guardian(db_session, school, class_b, "ALL-002", parent_b, "0712300006", "all.b@test-academy.test")
    db_session.commit()

    response = client.post(
        f"/schools/{school.id}/announcements",
        headers=auth_headers(school_admin_token),
        json={"title": "School closed Friday", "body": "Public holiday.", "audience": "parents"},
    )
    assert response.status_code == 201

    notified_user_ids = {n.user_id for n in db_session.query(Notification).filter_by(school_id=school.id).all()}
    assert parent_a.id in notified_user_ids
    assert parent_b.id in notified_user_ids
