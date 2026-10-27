"""The weekly menu that repeats, and the secretary's changes waiting for the head."""

from app.models.user import UserRole
from tests.conftest import _login, _make_user, auth_headers


def _menu(lunch="Rice and beans"):
    return {
        "slots": [
            {"name": "Lunch", "start_time": "12:30", "end_time": "13:30", "audience": "all", "items": {"0": lunch, "1": "Ugali and sukuma", "2": ""}},
            {"name": "Morning tea", "start_time": "10:00", "end_time": "10:30", "audience": "all", "items": {"0": "Porridge"}},
        ]
    }


def test_the_head_saves_the_week_and_everyone_can_read_it(client, db_session, school, school_admin_token):
    head = auth_headers(school_admin_token)
    r = client.put(f"/schools/{school.id}/meals/weekly", json=_menu(), headers=head)
    assert r.status_code == 200 and r.json()["applied"] is True
    parent, pw = _make_user(db_session, school, UserRole.PARENT, "menu.parent@test-academy.test")
    seen = client.get(f"/schools/{school.id}/meals/weekly", headers=auth_headers(_login(client, parent.email, pw))).json()["slots"]
    assert [s["name"] for s in seen] == ["Morning tea", "Lunch"]          # in time order
    lunch = seen[1]
    assert lunch["items"] == {"0": "Rice and beans", "1": "Ugali and sukuma"}  # blank days are not stored
    assert lunch["start_time"].startswith("12:30")
    # saving again replaces the whole menu rather than adding to it
    client.put(f"/schools/{school.id}/meals/weekly", json={"slots": [_menu()["slots"][0]]}, headers=head)
    assert [s["name"] for s in client.get(f"/schools/{school.id}/meals/weekly", headers=head).json()["slots"]] == ["Lunch"]


def test_the_secretary_prepares_a_menu_that_only_applies_when_approved(client, db_session, school, school_admin_token):
    head = auth_headers(school_admin_token)
    client.put(f"/schools/{school.id}/meals/weekly", json=_menu("Old stew"), headers=head)
    sec, pw = _make_user(db_session, school, UserRole.SECRETARY, "menu.desk@test-academy.test")
    desk = auth_headers(_login(client, sec.email, pw))
    r = client.put(f"/schools/{school.id}/meals/weekly", json=_menu("New pilau"), headers=desk)
    assert r.status_code == 200 and r.json()["applied"] is False
    assert client.get(f"/schools/{school.id}/meals/weekly", headers=head).json()["slots"][1]["items"]["0"] == "Old stew"
    rid = client.get(f"/schools/{school.id}/approvals?kind=meal_menu&pending_only=true", headers=head).json()[0]["id"]
    assert client.post(f"/schools/{school.id}/approvals/{rid}/approve", headers=head).status_code == 200
    assert client.get(f"/schools/{school.id}/meals/weekly", headers=head).json()["slots"][1]["items"]["0"] == "New pilau"


def test_a_second_proposal_replaces_the_one_still_waiting(client, db_session, school, school_admin_token):
    head = auth_headers(school_admin_token)
    sec, pw = _make_user(db_session, school, UserRole.SECRETARY, "menu.twice@test-academy.test")
    desk = auth_headers(_login(client, sec.email, pw))
    client.put(f"/schools/{school.id}/meals/weekly", json=_menu("First"), headers=desk)
    client.put(f"/schools/{school.id}/meals/weekly", json=_menu("Second"), headers=desk)
    pending = client.get(f"/schools/{school.id}/approvals?kind=meal_menu&pending_only=true", headers=head).json()
    assert len(pending) == 1


def test_bad_menus_are_refused_and_students_cannot_set_them(client, db_session, school, school_admin_token):
    head = auth_headers(school_admin_token)
    backwards = {"slots": [{"name": "Lunch", "start_time": "13:30", "end_time": "12:30", "items": {}}]}
    assert client.put(f"/schools/{school.id}/meals/weekly", json=backwards, headers=head).status_code == 422
    twice = {"slots": [{"name": "Lunch", "start_time": "12:00", "end_time": "13:00", "items": {}}, {"name": "lunch", "start_time": "14:00", "end_time": "15:00", "items": {}}]}
    assert client.put(f"/schools/{school.id}/meals/weekly", json=twice, headers=head).status_code == 422
    pupil, pw = _make_user(db_session, school, UserRole.STUDENT, "menu.pupil@test-academy.test")
    assert client.put(f"/schools/{school.id}/meals/weekly", json=_menu(), headers=auth_headers(_login(client, pupil.email, pw))).status_code == 403
    assert client.get(f"/schools/{school.id}/meals/template", headers=head).json()[0]["name"] == "Breakfast"
