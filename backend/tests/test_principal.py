"""The group principal: sees only the schools they are attached to, compares them module by module, and changes nothing."""

import pytest

from app.core.group_metrics import MODULES
from app.models.academics import SchoolClass, Student
from app.models.module import MODULE_KEYS, SchoolModule
from app.models.supervisor_link import SupervisorSchoolLink
from app.models.user import UserRole
from tests.conftest import _login, _make_user, auth_headers
from tests.test_oversight import _setup


def _principal(db, client, schools, email="principal@group.test"):
    user, pw = _make_user(db, None, UserRole.GROUP_PRINCIPAL, email)
    for s in schools:
        db.add(SupervisorSchoolLink(supervisor_user_id=user.id, school_id=s.id))
    db.commit()
    return auth_headers(_login(client, email, pw))


def _enable_all(db, school):
    have = {m.module_key for m in db.query(SchoolModule).filter_by(school_id=school.id)}
    for k in MODULE_KEYS:
        if k not in have:
            db.add(SchoolModule(school_id=school.id, module_key=k, enabled=True))
    db.commit()


def test_the_principal_sees_only_the_schools_they_are_attached_to(client, db_session, school, other_school):
    h = _principal(db_session, client, [school])
    assert [s["id"] for s in client.get("/group/schools", headers=h).json()] == [school.id]
    assert [r["school_id"] for r in client.get("/group/modules/classes", headers=h).json()["rows"]] == [school.id]
    assert client.get(f"/schools/{other_school.id}/classes", headers=h).status_code == 403


def test_classes_are_compared_school_by_school_with_a_group_total(client, db_session, school, other_school):
    _setup(db_session, school)                       # two classes and three learners
    head_teacher, _ = _make_user(db_session, other_school, UserRole.TEACHER, "other.ct@test-academy.test")
    db_session.add(SchoolClass(school_id=other_school.id, name="Other 1", homeroom_teacher_id=head_teacher.id))
    db_session.commit()
    _enable_all(db_session, school)
    _enable_all(db_session, other_school)
    h = _principal(db_session, client, [school, other_school])
    r = client.get("/group/modules/classes", headers=h).json()
    by = {row["school_id"]: row["values"] for row in r["rows"]}
    assert by[school.id]["classes"] == 2 and by[other_school.id]["classes"] == 1
    assert r["group"]["classes"] == 3 and r["group"]["learners"] == 3
    assert r["group"]["avg_size"] == 1.0              # 3 learners across 3 classes: built from totals
    assert by[school.id]["no_class_teacher"] == 1 and by[other_school.id]["no_class_teacher"] == 0
    # the school with every class covered is flagged best, the other weakest
    assert r["marks"]["no_class_teacher"] == {"best": str(other_school.id), "weakest": str(school.id)}
    assert {c["key"] for c in r["columns"]} >= {"classes", "learners", "avg_size", "no_class_teacher"}


@pytest.mark.parametrize("key", sorted(MODULES))
def test_every_module_comparison_loads(client, db_session, school, other_school, key):
    _setup(db_session, school)
    _enable_all(db_session, school)
    _enable_all(db_session, other_school)
    h = _principal(db_session, client, [school, other_school])
    r = client.get(f"/group/modules/{key}", headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["key"] == key and len(body["rows"]) == 2 and body["columns"]


def test_a_school_with_a_module_switched_off_is_marked_not_counted(client, db_session, school, other_school):
    _enable_all(db_session, school)
    _enable_all(db_session, other_school)
    db_session.query(SchoolModule).filter_by(school_id=other_school.id, module_key="library").update({"enabled": False})
    db_session.commit()
    h = _principal(db_session, client, [school, other_school])
    rows = {r["school_id"]: r for r in client.get("/group/modules/library", headers=h).json()["rows"]}
    assert rows[school.id]["enabled"] is True and rows[other_school.id]["enabled"] is False


def test_the_principal_can_look_at_a_school_but_not_change_it(client, db_session, school, other_school):
    h = _principal(db_session, client, [school])
    assert client.get(f"/schools/{school.id}/classes", headers=h).status_code == 200
    for method, path, body in (
        ("post", f"/schools/{school.id}/classes", {"name": "Sneaky 1"}),
        ("patch", f"/schools/{school.id}/students/1", {"first_name": "X"}),
        ("delete", f"/schools/{school.id}/timetable/1", None),
        ("put", f"/schools/{school.id}/meals/weekly", {"slots": []}),
    ):
        r = getattr(client, method)(path, headers=h, **({"json": body} if body is not None else {}))
        assert r.status_code == 403 and "view a school but not change" in r.json()["detail"], (method, path, r.text)
    assert db_session.query(SchoolClass).filter_by(school_id=school.id, name="Sneaky 1").count() == 0


def test_the_principal_may_still_decide_expenses_give_feedback_and_sign_in(client, db_session, school):
    h = _principal(db_session, client, [school])
    # the read-only rule lets these through to their own checks (not found, not the read-only 403)
    r = client.post(f"/schools/{school.id}/finance/expenses/999999/approve", headers=h)
    assert r.status_code != 403 or "view a school but not change" not in r.text
    assert "view a school but not change" not in client.post(f"/schools/{school.id}/feedback", headers=h, json={}).text
    assert client.patch("/notifications/read-all", headers=h).status_code == 200


def test_the_overview_gives_a_card_per_school_and_the_few_decisions(client, db_session, school, other_school):
    from app.models.expense import Expense, ExpenseStatus
    from datetime import date

    _setup(db_session, school)
    _enable_all(db_session, school)
    _enable_all(db_session, other_school)
    db_session.add(Expense(school_id=school.id, category="supplies", description="Generator", amount=250000, date=date.today(), status=ExpenseStatus.PENDING))
    db_session.commit()
    h = _principal(db_session, client, [school, other_school])
    r = client.get("/group/overview", headers=h).json()
    assert {c["school_id"] for c in r["schools"]} == {school.id, other_school.id}
    assert r["learners"] == 3
    assert any("Generator" in d["title"] and d["school_name"] == school.name for d in r["decisions"])
    assert isinstance(r["spotlight"], list)


def test_group_activity_merges_schools_and_names_them(client, db_session, school, other_school):
    _setup(db_session, school)
    h = _principal(db_session, client, [school, other_school])
    r = client.get("/group/activity", headers=h).json()
    assert r["total"] == len(r["events"]) and all(e["school_name"] for e in r["events"])
    assert str(school.id) in r["by_school"]
    assert client.get("/group/activity?start=2026-01-10&end=2026-01-01", headers=h).status_code == 422


def test_the_weekly_group_report_compares_schools(client, db_session, school, other_school):
    _setup(db_session, school)
    _enable_all(db_session, school)
    _enable_all(db_session, other_school)
    h = _principal(db_session, client, [school, other_school])
    r = client.get("/group/weekly-report", headers=h).json()
    assert r["headline"] and {s["school_id"] for s in r["schools"]} == {school.id, other_school.id}
    assert {"attendance", "fees", "results"} <= {s["key"] for s in r["sections"]}


def test_only_a_group_principal_can_open_the_group_view(client, db_session, school, school_admin_token, teacher_token):
    for tok in (school_admin_token, teacher_token):
        assert client.get("/group/overview", headers=auth_headers(tok)).status_code == 403


# --- The principal's weekly report and live meetings ---


def test_the_principal_report_is_emailed_once_a_week_and_only_to_principals(db_session, client, school, other_school):
    from unittest.mock import patch

    from app.services.principal_report import send_all_principal_reports

    _setup(db_session, school)
    _enable_all(db_session, school)
    _enable_all(db_session, other_school)
    _principal(db_session, client, [school, other_school], "weekly.principal@group.test")
    with patch("app.services.principal_report.send_email", return_value=True) as sent:
        send_all_principal_reports(db_session, once_per_week=True)
        send_all_principal_reports(db_session, once_per_week=True)
    to = [c for c in sent.call_args_list if c.args[0] == "weekly.principal@group.test"]
    assert len(to) == 1
    assert "Your schools" in to[0].kwargs["html"] and school.name in to[0].kwargs["html"] and other_school.name in to[0].kwargs["html"]


def test_a_principal_can_email_themselves_the_report(client, db_session, school):
    from unittest.mock import patch

    h = _principal(db_session, client, [school])
    with patch("app.services.principal_report.send_email", return_value=True):
        r = client.post("/group/weekly-report/email-me", headers=h)
    assert r.status_code == 200 and r.json() == {"sent": True}


def _teacher(db, school, email):
    u, pw = _make_user(db, school, UserRole.TEACHER, email)
    return u, pw


def test_a_principal_calls_every_teacher_in_chosen_schools_and_they_can_join(client, db_session, school, other_school):
    from datetime import datetime, timedelta, timezone

    t1, p1 = _teacher(db_session, school, "meet.t1@test-academy.test")
    t2, p2 = _teacher(db_session, other_school, "meet.t2@test-academy.test")
    h = _principal(db_session, client, [school, other_school])
    cands = client.get("/meetings/candidates", headers=h).json()
    assert {c["school_id"] for c in cands} == {school.id, other_school.id}
    when = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    r = client.post("/meetings", json={"title": "Term planning", "scheduled_start": when, "school_ids": [school.id, other_school.id], "audience": "all"}, headers=h)
    assert r.status_code == 201, r.text
    mid = r.json()["id"]
    assert r.json()["invited"] == 2 and r.json()["is_host"] is True
    teacher1 = auth_headers(_login(client, t1.email, p1))
    teacher2 = auth_headers(_login(client, t2.email, p2))
    assert [m["id"] for m in client.get("/meetings", headers=teacher1).json()] == [mid]
    # teachers cannot get in before the host opens it
    assert client.post(f"/meetings/{mid}/token", headers=teacher1).status_code == 409
    host_tok = client.post(f"/meetings/{mid}/token", headers=h)
    assert host_tok.status_code == 200 and host_tok.json()["class_title"] == "Term planning"
    assert client.post(f"/meetings/{mid}/token", headers=teacher1).status_code == 200
    assert client.post(f"/meetings/{mid}/token", headers=teacher2).status_code == 200
    att = client.get(f"/meetings/{mid}/attendance", headers=h).json()
    assert {a["name"] for a in att["attendees"] if a["joined_at"]} == {t1.full_name, t2.full_name}
    assert client.get(f"/meetings/{mid}/attendance", headers=teacher1).status_code == 403
    assert client.post(f"/meetings/{mid}/end", headers=h).json()["status"] == "ended"
    assert client.post(f"/meetings/{mid}/token", headers=teacher1).status_code == 409


def test_a_meeting_can_be_for_chosen_teachers_only_and_stays_inside_the_hosts_schools(client, db_session, school, other_school, school_admin_token):
    from datetime import datetime, timedelta, timezone

    t1, p1 = _teacher(db_session, school, "pick.t1@test-academy.test")
    t2, p2 = _teacher(db_session, school, "pick.t2@test-academy.test")
    head = auth_headers(school_admin_token)
    when = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    r = client.post("/meetings", json={"title": "Maths department", "scheduled_start": when, "school_ids": [school.id], "audience": "selected", "teacher_ids": [t1.id]}, headers=head)
    assert r.status_code == 201 and r.json()["invited"] == 1
    assert client.get("/meetings", headers=auth_headers(_login(client, t2.email, p2))).json() == []
    assert len(client.get("/meetings", headers=auth_headers(_login(client, t1.email, p1))).json()) == 1
    # a head cannot call another school's teachers, nor pick someone who is not a teacher there
    assert client.post("/meetings", json={"title": "Not mine", "scheduled_start": when, "school_ids": [other_school.id], "audience": "all"}, headers=head).status_code == 403
    assert client.post("/meetings", json={"title": "Nobody picked", "scheduled_start": when, "school_ids": [school.id], "audience": "selected", "teacher_ids": []}, headers=head).status_code == 422
    # teachers cannot host
    assert client.post("/meetings", json={"title": "Sneaky", "scheduled_start": when, "school_ids": [school.id], "audience": "all"}, headers=auth_headers(_login(client, t1.email, p1))).status_code == 403
