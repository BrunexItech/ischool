"""Teachers control the room: nobody is let in without being admitted, learners
start unable to speak, and the host can mute one learner, mute everyone, allow
one to speak, or remove someone. The video service itself is faked here."""

from datetime import datetime, timezone

from app.models.live_classes import LiveClass
from app.models.user import UserRole
from tests.conftest import _login, _make_user, auth_headers


class FakeLiveKit:
    def __init__(self):
        self.calls = []
        self.participants = [
            {"identity": "user-1", "permission": {"can_publish": True}},
            {"identity": "guest-5", "permission": {"can_publish": True}},
            {"identity": "student-9", "permission": {"can_publish": True}},
            {"identity": "guest-6", "permission": {"can_publish": False}},
        ]

    def __call__(self, method, body, room):
        self.calls.append((method, body))
        if method == "ListParticipants":
            return {"participants": self.participants}
        return {}


def _setup(client, db_session, school, monkeypatch):
    fake = FakeLiveKit()
    monkeypatch.setattr("app.routers.live_classes.livekit_admin", fake)
    teacher, pw = _make_user(db_session, school, UserRole.TEACHER, "host@test-academy.test")
    lc = LiveClass(school_id=school.id, title="Maths", scheduled_start=datetime.now(timezone.utc), room_name="room-x", join_code="CODE123", created_by=teacher.id)
    db_session.add(lc)
    db_session.commit()
    return fake, lc, auth_headers(_login(client, teacher.email, pw))


def test_guests_wait_to_be_admitted_and_cannot_speak(client, db_session, school, monkeypatch):
    fake, lc, host = _setup(client, db_session, school, monkeypatch)
    ask = client.post("/live-classes/join/CODE123/request", json={"name": "Wanjiku"})
    assert ask.status_code == 201, ask.text
    code = ask.json()["request_code"]
    waiting = client.get("/live-classes/join/CODE123/status", params={"request_code": code}).json()
    assert waiting == {"status": "pending", "join": None}

    pending = client.get(f"/schools/{school.id}/live-classes/{lc.id}/requests", headers=host).json()
    assert [p["name"] for p in pending] == ["Wanjiku"]
    assert client.post(f"/schools/{school.id}/live-classes/{lc.id}/requests/{pending[0]['id']}/admit", headers=host).status_code == 204

    ready = client.get("/live-classes/join/CODE123/status", params={"request_code": code}).json()
    assert ready["status"] == "admitted" and ready["join"]["room_name"] == "room-x"
    from jose import jwt
    from app.core.config import settings
    grants = jwt.decode(ready["join"]["token"], settings.livekit_api_secret, algorithms=["HS256"])["video"]
    assert grants["canPublish"] is False

    joined = client.get(f"/schools/{school.id}/live-classes/{lc.id}/joins", headers=host).json()
    assert [(j["name"], j["kind"]) for j in joined] == [("Wanjiku", "guest")]


def test_a_denied_guest_never_gets_a_token(client, db_session, school, monkeypatch):
    _, lc, host = _setup(client, db_session, school, monkeypatch)
    code = client.post("/live-classes/join/CODE123/request", json={"name": "Stranger"}).json()["request_code"]
    rid = client.get(f"/schools/{school.id}/live-classes/{lc.id}/requests", headers=host).json()[0]["id"]
    client.post(f"/schools/{school.id}/live-classes/{lc.id}/requests/{rid}/deny", headers=host)
    out = client.get("/live-classes/join/CODE123/status", params={"request_code": code}).json()
    assert out == {"status": "denied", "join": None}
    assert client.get("/live-classes/join/CODE123/status", params={"request_code": "nope"}).status_code == 404


def test_mute_all_skips_staff_and_people_already_silent(client, db_session, school, monkeypatch):
    fake, lc, host = _setup(client, db_session, school, monkeypatch)
    r = client.post(f"/schools/{school.id}/live-classes/{lc.id}/mute-all", headers=host)
    assert r.status_code == 200 and r.json()["affected"] == 2
    muted = sorted(b["identity"] for m, b in fake.calls if m == "UpdateParticipant")
    assert muted == ["guest-5", "student-9"]
    assert all(b["permission"]["can_publish"] is False for m, b in fake.calls if m == "UpdateParticipant")


def test_allow_mute_and_remove_one_learner_but_never_a_teacher(client, db_session, school, monkeypatch):
    fake, lc, host = _setup(client, db_session, school, monkeypatch)
    base = f"/schools/{school.id}/live-classes/{lc.id}/participants"
    assert client.post(f"{base}/student-9/speaking", headers=host, json={"allowed": True}).status_code == 200
    assert fake.calls[-1][1]["permission"]["can_publish"] is True
    assert client.post(f"{base}/student-9/speaking", headers=host, json={"allowed": False}).status_code == 200
    assert client.post(f"{base}/student-9/remove", headers=host).status_code == 200
    assert fake.calls[-1][0] == "RemoveParticipant"
    assert client.post(f"{base}/user-1/speaking", headers=host, json={"allowed": False}).status_code == 400
    assert client.post(f"{base}/user-1/remove", headers=host).status_code == 400


def test_controls_are_for_staff_only(client, db_session, school, monkeypatch):
    _, lc, _ = _setup(client, db_session, school, monkeypatch)
    student, pw = _make_user(db_session, school, UserRole.STUDENT, "kid@test-academy.test")
    h = auth_headers(_login(client, student.email, pw))
    assert client.post(f"/schools/{school.id}/live-classes/{lc.id}/mute-all", headers=h).status_code == 403
    assert client.get(f"/schools/{school.id}/live-classes/{lc.id}/requests", headers=h).status_code == 403
