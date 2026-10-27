"""Department summaries, the combined weekly report, and the secretary's reach."""

from datetime import timedelta
from unittest.mock import patch

import pytest

from app.core.dates import school_today
from app.core.module_pulse import PULSES
from app.models.academic_term import AcademicTerm
from app.models.user import UserRole
from app.services.weekly_reports import send_all_weekly_reports
from tests.conftest import _login, _make_user, auth_headers
from tests.test_oversight import _setup


@pytest.mark.parametrize("key", sorted(PULSES))
def test_every_department_summary_loads_on_a_busy_school(client, db_session, school, school_admin_token, key):
    _setup(db_session, school)
    r = client.get(f"/schools/{school.id}/oversight/pulse/{key}", headers=auth_headers(school_admin_token))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["key"] == key and body["summary"] and body["tiles"]


def test_every_department_summary_loads_on_an_empty_school(client, school, school_admin_token):
    for key in PULSES:
        r = client.get(f"/schools/{school.id}/oversight/pulse/{key}", headers=auth_headers(school_admin_token))
        assert r.status_code == 200, (key, r.text)


def test_the_weekly_report_covers_every_department_and_counts_what_needs_attention(client, db_session, school, school_admin_token):
    _setup(db_session, school)
    r = client.get(f"/schools/{school.id}/oversight/weekly-report", headers=auth_headers(school_admin_token))
    assert r.status_code == 200, r.text
    body = r.json()
    keys = {s["key"] for s in body["sections"]}
    assert {"attendance", "lessons", "homework", "finance", "conduct", "staff", "calendar"} <= keys
    assert body["attention_count"] == sum(len(s["attention"]) for s in body["sections"])
    assert body["headline"]


def test_a_missing_term_date_is_flagged_for_the_head(client, db_session, school, school_admin_token):
    db_session.add(AcademicTerm(school_id=school.id, name="Term 3", start_date=None, end_date=None, is_current=True))
    db_session.commit()
    s = client.get(f"/schools/{school.id}/oversight/pulse/calendar", headers=auth_headers(school_admin_token)).json()
    assert any("no start and end dates" in a["text"] for a in s["attention"])


def test_the_report_is_emailed_to_the_head_once_per_week(db_session, school):
    _make_user(db_session, school, UserRole.HEAD_OF_INSTITUTION, "weekly.head@test-academy.test")
    with patch("app.services.weekly_reports.send_email", return_value=True) as sent:
        send_all_weekly_reports(db_session, once_per_week=True)
        send_all_weekly_reports(db_session, once_per_week=True)
    to_head = [c for c in sent.call_args_list if c.args[0] == "weekly.head@test-academy.test"]
    assert len(to_head) == 1
    assert "weekly summary" in to_head[0].args[1]
    assert "Needs your attention" in to_head[0].kwargs["html"] or "Nothing needs your attention" in to_head[0].kwargs["html"]


def test_a_head_can_email_themselves_the_report(client, school, school_admin_token):
    with patch("app.services.weekly_reports.send_email", return_value=True):
        r = client.post(f"/schools/{school.id}/oversight/weekly-report/email-me", headers=auth_headers(school_admin_token))
    assert r.status_code == 200 and r.json() == {"sent": True}


def test_a_teacher_cannot_read_the_weekly_report(client, db_session, school):
    t, pw = _make_user(db_session, school, UserRole.TEACHER, "nosy.teacher@test-academy.test")
    h = auth_headers(_login(client, t.email, pw))
    assert client.get(f"/schools/{school.id}/oversight/weekly-report", headers=h).status_code == 403
    assert client.get(f"/schools/{school.id}/oversight/pulse/finance", headers=h).status_code == 403


# --- The secretary ---


def _secretary(client, db_session, school):
    u, pw = _make_user(db_session, school, UserRole.SECRETARY, "office@test-academy.test")
    return auth_headers(_login(client, u.email, pw))


def test_the_secretary_sets_term_dates_and_the_calendar(client, db_session, school):
    h = _secretary(client, db_session, school)
    today = school_today(db_session, school.id)
    term = client.post(f"/schools/{school.id}/academic-terms", headers=h, json={"name": "Term 1", "start_date": str(today), "end_date": str(today + timedelta(days=90)), "is_current": True})
    assert term.status_code in (200, 201), term.text
    ev = client.post(f"/schools/{school.id}/calendar-events", headers=h, json={"title": "Sports day", "event_type": "sports", "start_date": str(today + timedelta(days=10))})
    assert ev.status_code in (200, 201), ev.text


def test_the_secretary_posts_school_wide_notices_and_sees_them(client, db_session, school):
    h = _secretary(client, db_session, school)
    r = client.post(f"/schools/{school.id}/announcements", headers=h, json={"title": "Closing early", "body": "School closes at 1pm on Friday.", "audience": "all"})
    assert r.status_code in (200, 201), r.text
    assert any(a["title"] == "Closing early" for a in client.get(f"/schools/{school.id}/announcements", headers=h).json())


def test_the_secretary_manages_admissions_and_sees_the_directory(client, db_session, school):
    h = _secretary(client, db_session, school)
    assert client.get(f"/schools/{school.id}/leads", headers=h).status_code == 200
    assert client.get(f"/schools/{school.id}/oversight/teachers", headers=h).status_code == 200
    assert client.get(f"/schools/{school.id}/oversight/pulse/admissions", headers=h).status_code == 200


def test_the_secretary_has_no_say_over_money_approvals_or_the_head_overview(client, db_session, school):
    h = _secretary(client, db_session, school)
    assert client.get(f"/schools/{school.id}/oversight/pulse/finance", headers=h).status_code == 403
    assert client.get(f"/schools/{school.id}/oversight/pulse/complaints", headers=h).status_code == 403
    assert client.get(f"/schools/{school.id}/oversight/overview", headers=h).status_code == 403
    assert client.get(f"/schools/{school.id}/oversight/weekly-report", headers=h).status_code == 403
    assert client.get(f"/schools/{school.id}/payroll/runs", headers=h).status_code in (403, 404)
    assert client.get(f"/schools/{school.id}/expenses", headers=h).status_code in (403, 404)
    assert client.post(f"/schools/{school.id}/feedback", headers=h, json={"recipient_user_id": 1, "topic": "x", "message": "y"}).status_code == 403


def test_a_head_can_create_a_secretary_account(client, school, school_admin_token):
    r = client.post(f"/schools/{school.id}/staff", headers=auth_headers(school_admin_token), json={"email": "new.secretary@test-academy.test", "full_name": "New Secretary", "password": "TestPass123!", "role": "secretary", "staff_number": "SEC-1"})
    assert r.status_code == 201, r.text
    assert r.json()["role"] == "secretary"


# --- Overriding a mark, with a reason ---


def test_a_head_corrects_a_mark_with_a_reason_and_the_teacher_is_told(client, db_session, school, school_admin_token):
    from app.models.audit_log import AuditLog
    from app.models.notification import Notification
    from app.models.results import Result

    _setup(db_session, school)
    row = db_session.query(Result).filter_by(school_id=school.id).first()
    row.recorded_by = db_session.query(__import__("app.models.user", fromlist=["User"]).User).filter_by(email="oversee.teacher@test-academy.test").first().id
    db_session.commit()
    body = {"student_id": row.student_id, "subject_id": row.subject_id, "term": row.term, "exam_type": row.exam_type, "score": 72}
    h = auth_headers(school_admin_token)
    url = f"/schools/{school.id}/oversight/overrides/mark"

    assert client.post(url, headers=h, json={**body, "reason": "typo"}).status_code == 400  # a reason is required
    assert client.post(url, headers=h, json={**body, "score": 140, "reason": "Entered with a wrong digit"}).status_code == 400
    ok = client.post(url, headers=h, json={**body, "reason": "Marked 6 instead of 62 by mistake"})
    assert ok.status_code == 200, ok.text
    db_session.refresh(row)
    assert float(row.score) == 72
    log = db_session.query(AuditLog).filter_by(school_id=school.id, action="result.override").one()
    assert log.after["reason"] == "Marked 6 instead of 62 by mistake" and log.before["score"] == 60
    assert db_session.query(Notification).filter(Notification.user_id == row.recorded_by, Notification.title.like("%corrected a mark%")).count() == 1


def test_a_head_cannot_invent_a_mark_and_a_teacher_cannot_override(client, db_session, school, school_admin_token):
    _setup(db_session, school)
    body = {"student_id": 999999, "subject_id": 1, "term": "Term 3", "exam_type": "CAT 9", "score": 50, "reason": "Entering one that was never recorded"}
    assert client.post(f"/schools/{school.id}/oversight/overrides/mark", headers=auth_headers(school_admin_token), json=body).status_code == 404
    t, pw = _make_user(db_session, school, UserRole.TEACHER, "override.teacher@test-academy.test")
    assert client.post(f"/schools/{school.id}/oversight/overrides/mark", headers=auth_headers(_login(client, t.email, pw)), json=body).status_code == 403


# --- Find by date, and the Saturday send ---


def test_the_head_can_find_everything_recorded_on_a_date(client, db_session, school, school_admin_token):
    _setup(db_session, school)
    today = school_today(db_session, school.id)
    h = auth_headers(school_admin_token)
    r = client.get(f"/schools/{school.id}/oversight/activity?start={today}", headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["start"] == body["end"] == str(today)
    assert body["total"] == len(body["events"]) == sum(body["counts"].values())
    only = next(iter(body["counts"]), None)
    if only:
        filtered = client.get(f"/schools/{school.id}/oversight/activity?start={today}&kinds={only}", headers=h).json()
        assert {e["kind"] for e in filtered["events"]} == {only}
    quiet = client.get(f"/schools/{school.id}/oversight/activity?start=2001-01-02", headers=h).json()
    assert quiet["events"] == []


def test_the_date_search_rejects_a_backwards_or_huge_span(client, school, school_admin_token):
    h = auth_headers(school_admin_token)
    assert client.get(f"/schools/{school.id}/oversight/activity?start=2026-03-10&end=2026-03-01", headers=h).status_code == 422
    assert client.get(f"/schools/{school.id}/oversight/activity?start=2026-01-01&end=2026-12-31", headers=h).status_code == 422


def test_a_teacher_cannot_search_the_schools_activity(client, db_session, school):
    t, pw = _make_user(db_session, school, UserRole.TEACHER, "curious.teacher@test-academy.test")
    h = auth_headers(_login(client, t.email, pw))
    assert client.get(f"/schools/{school.id}/oversight/activity", headers=h).status_code == 403


def test_the_weekly_report_goes_out_on_saturday_morning():
    from datetime import datetime, timezone

    from app.core.scheduler import _due

    fri_evening = datetime(2026, 10, 23, 18, 0, tzinfo=timezone.utc)
    sat_early = datetime(2026, 10, 24, 2, 0, tzinfo=timezone.utc)
    sat_morning = datetime(2026, 10, 24, 5, 0, tzinfo=timezone.utc)
    sun = datetime(2026, 10, 25, 9, 0, tzinfo=timezone.utc)
    assert not _due(fri_evening, None) and not _due(sat_early, None)
    assert _due(sat_morning, None) and _due(sun, None)
    assert not _due(sun, sat_morning.isocalendar()[:2])


# --- The overview for any day or span ---


def test_the_overview_can_be_read_for_a_past_day_and_for_a_week(client, db_session, school, school_admin_token):
    d = _setup(db_session, school)
    h = auth_headers(school_admin_token)
    today = d["today"]
    now = client.get(f"/schools/{school.id}/oversight/overview", headers=h).json()["pulse"]
    assert now["is_range"] is False and now["start"] == now["end"] == str(today)
    past = client.get(f"/schools/{school.id}/oversight/overview?start={today - timedelta(days=30)}&end={today - timedelta(days=30)}", headers=h)
    assert past.status_code == 200
    assert past.json()["pulse"]["attendance_rate"] is None          # nothing was recorded that day
    week = client.get(f"/schools/{school.id}/oversight/overview?start={today - timedelta(days=6)}&end={today}", headers=h).json()["pulse"]
    assert week["is_range"] is True and week["start"] == str(today - timedelta(days=6))
    assert week["attendance_rate"] == 100.0                          # today's three present learners
    assert set(week) >= {"homework_expected", "homework_missing", "fees_collected", "missing_registers", "lessons_unmarked"}
    assert client.get(f"/schools/{school.id}/oversight/overview?start={today}&end={today - timedelta(days=3)}", headers=h).status_code == 422
    assert client.get(f"/schools/{school.id}/oversight/overview?start={today - timedelta(days=200)}", headers=h).status_code == 422
