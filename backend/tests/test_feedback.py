"""Leadership leaves feedback on a teacher's work; the teacher acknowledges it."""

from app.models.user import UserRole
from tests.conftest import _login, _make_user, auth_headers


def test_feedback_is_sent_read_and_acknowledged(client, db_session, school, school_admin_token):
    teacher, pw = _make_user(db_session, school, UserRole.TEACHER, "fb.teacher@test-academy.test")
    head = auth_headers(school_admin_token)
    r = client.post(f"/schools/{school.id}/feedback", headers=head, json={"recipient_user_id": teacher.id, "topic": "Lesson plan: Mathematics", "link": "/dashboard/lesson-plans/1", "message": "Please add objectives to weeks 4 to 6."})
    assert r.status_code == 201, r.text
    fid = r.json()["id"]
    assert r.json()["status"] == "sent" and r.json()["recipient_name"] == "Fb Teacher"

    mine = auth_headers(_login(client, teacher.email, pw))
    inbox = client.get(f"/schools/{school.id}/feedback", headers=mine).json()
    assert [f["id"] for f in inbox] == [fid]
    done = client.post(f"/schools/{school.id}/feedback/{fid}/acknowledge", headers=mine, json={"reply": "Done, thank you."})
    assert done.status_code == 200 and done.json()["status"] == "acknowledged" and done.json()["reply"] == "Done, thank you."

    seen = client.get(f"/schools/{school.id}/feedback", headers=head, params={"recipient_user_id": teacher.id}).json()
    assert seen[0]["status"] == "acknowledged" and seen[0]["reply"] == "Done, thank you."


def test_only_leadership_sends_and_a_teacher_sees_only_their_own(client, db_session, school, school_admin_token):
    a, apw = _make_user(db_session, school, UserRole.TEACHER, "fb.a@test-academy.test")
    b, bpw = _make_user(db_session, school, UserRole.TEACHER, "fb.b@test-academy.test")
    head = auth_headers(school_admin_token)
    client.post(f"/schools/{school.id}/feedback", headers=head, json={"recipient_user_id": a.id, "topic": "Homework", "message": "Thank you for the weekly homework."})
    ha, hb = auth_headers(_login(client, a.email, apw)), auth_headers(_login(client, b.email, bpw))
    assert client.post(f"/schools/{school.id}/feedback", headers=ha, json={"recipient_user_id": b.id, "topic": "x", "message": "y"}).status_code == 403
    assert len(client.get(f"/schools/{school.id}/feedback", headers=ha).json()) == 1
    assert client.get(f"/schools/{school.id}/feedback", headers=hb).json() == []
    fid = client.get(f"/schools/{school.id}/feedback", headers=ha).json()[0]["id"]
    assert client.post(f"/schools/{school.id}/feedback/{fid}/acknowledge", headers=hb, json={}).status_code == 404
    assert client.post(f"/schools/{school.id}/feedback", headers=head, json={"recipient_user_id": a.id, "topic": "x", "message": "   "}).status_code == 400
