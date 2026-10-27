"""Bus runs checked by the attendant, and the head's read-only view of the day."""

from datetime import timedelta

from app.core.dates import school_today
from app.models.academics import SchoolClass, Student
from app.models.pickup_dropoff import PickupDropoffLog
from app.models.transport import RouteStop, TransportRoute, Vehicle
from app.models.user import UserRole
from tests.conftest import _login, _make_user, auth_headers


def _fleet(db, school, *, attendant_email="rider@test-academy.test"):
    attendant, pw = _make_user(db, school, UserRole.TRANSPORT_ATTENDANT, attendant_email)
    parent, _ = _make_user(db, school, UserRole.PARENT, f"fam.{attendant_email}")
    bus = Vehicle(school_id=school.id, registration_number=f"KDA {attendant.id}", capacity=30, driver_name="Driver Dan", driver_phone="0700000000", attendant_user_id=attendant.id)
    db.add(bus)
    db.flush()
    route = TransportRoute(school_id=school.id, vehicle_id=bus.id, name=f"Route {attendant.id}")
    db.add(route)
    db.flush()
    stop = RouteStop(route_id=route.id, name="Market", stop_order=1)
    db.add(stop)
    cls = SchoolClass(school_id=school.id, name=f"Bus Class {attendant.id}")
    db.add(cls)
    db.flush()
    kid = Student(school_id=school.id, class_id=cls.id, admission_number=f"B-{attendant.id}", first_name="Amina", last_name="Rider", transport_route_id=route.id, transport_stop_id=stop.id, guardian_user_id=parent.id)
    db.add(kid)
    db.commit()
    return dict(attendant=attendant, pw=pw, route=route, kid=kid, cls=cls, bus=bus, parent=parent)


def test_a_morning_run_is_boarded_then_dropped_at_school_and_parents_are_told(client, db_session, school):
    w = _fleet(db_session, school)
    h = auth_headers(_login(client, w["attendant"].email, w["pw"]))
    base = f"/schools/{school.id}/transport/runs"
    r = client.post(base, json={"route_id": w["route"].id, "direction": "morning"}, headers=h)
    assert r.status_code == 201, r.text
    run = r.json()["summary"]["run_id"]
    assert r.json()["rows"][0]["status"] == "pending"
    assert client.post(f"{base}/{run}/students/{w['kid'].id}", json={"status": "boarded"}, headers=h).status_code == 200
    done = client.post(f"{base}/{run}/complete", headers=h).json()
    assert done["summary"]["status"] == "completed" and done["rows"][0]["status"] == "dropped"
    logs = db_session.query(PickupDropoffLog).filter_by(student_id=w["kid"].id).order_by(PickupDropoffLog.id).all()
    assert [(l.event_type.value, l.at_school, l.source) for l in logs] == [("pickup", False, "bus"), ("dropoff", True, "bus")]
    from app.models.notification import Notification

    assert db_session.query(Notification).filter_by(user_id=w["parent"].id).count() == 2


def test_an_afternoon_run_cannot_finish_while_a_child_is_still_on_board(client, db_session, school):
    w = _fleet(db_session, school, attendant_email="pm.rider@test-academy.test")
    h = auth_headers(_login(client, w["attendant"].email, w["pw"]))
    base = f"/schools/{school.id}/transport/runs"
    run = client.post(base, json={"route_id": w["route"].id, "direction": "afternoon"}, headers=h).json()["summary"]["run_id"]
    client.post(f"{base}/{run}/students/{w['kid'].id}", json={"status": "boarded"}, headers=h)
    r = client.post(f"{base}/{run}/complete", headers=h)
    assert r.status_code == 409 and "Amina Rider" in r.json()["detail"]
    # a hand-over must say who received the child
    assert client.post(f"{base}/{run}/students/{w['kid'].id}", json={"status": "dropped"}, headers=h).status_code == 422
    r = client.post(f"{base}/{run}/students/{w['kid'].id}", json={"status": "dropped", "handed_to": "Mrs Rider (mother)"}, headers=h)
    assert r.status_code == 200 and r.json()["rows"][0]["handed_to"] == "Mrs Rider (mother)"
    assert client.post(f"{base}/{run}/complete", headers=h).json()["summary"]["status"] == "completed"


def test_an_attendant_only_sees_and_runs_their_own_vehicle(client, db_session, school):
    mine = _fleet(db_session, school, attendant_email="mine@test-academy.test")
    other = _fleet(db_session, school, attendant_email="other@test-academy.test")
    h = auth_headers(_login(client, mine["attendant"].email, mine["pw"]))
    base = f"/schools/{school.id}/transport/runs"
    listing = client.get(base, headers=h).json()
    assert {r["route_id"] for r in listing} == {mine["route"].id}
    assert client.post(base, json={"route_id": other["route"].id, "direction": "morning"}, headers=h).status_code == 404


def test_the_head_can_watch_but_not_run_or_log(client, db_session, school, school_admin_token):
    w = _fleet(db_session, school, attendant_email="watched@test-academy.test")
    head = auth_headers(school_admin_token)
    base = f"/schools/{school.id}/transport/runs"
    assert client.get(base, headers=head).status_code == 200
    assert client.post(base, json={"route_id": w["route"].id, "direction": "morning"}, headers=head).status_code == 403
    gate = f"/schools/{school.id}/students/{w['kid'].id}/pickup-dropoff"
    assert client.post(gate, json={"event_type": "pickup", "person_name": "Head"}, headers=head).status_code == 403
    assert client.get(gate, headers=head).status_code == 200


def test_the_head_sees_each_class_for_any_date_and_vehicle_paper_alerts(client, db_session, school, school_admin_token):
    w = _fleet(db_session, school, attendant_email="oversee@test-academy.test")
    today = school_today(db_session, school.id)
    w["bus"].insurance_expiry = today - timedelta(days=3)
    db_session.commit()
    rider = auth_headers(_login(client, w["attendant"].email, w["pw"]))
    base = f"/schools/{school.id}/transport/runs"
    run = client.post(base, json={"route_id": w["route"].id, "direction": "morning"}, headers=rider).json()["summary"]["run_id"]
    client.post(f"{base}/{run}/students/{w['kid'].id}", json={"status": "boarded"}, headers=rider)
    client.post(f"{base}/{run}/complete", headers=rider)
    head = auth_headers(school_admin_token)
    r = client.get(f"/schools/{school.id}/oversight/transport?class_id={w['cls'].id}", headers=head)
    assert r.status_code == 200, r.text
    body = r.json()
    row = body["classes"][0]["rows"][0]
    assert row["arrival"]["via"] == "bus" and row["bus_rider"] is True and len(row["on_route"]) == 1
    assert body["summary"]["runs_completed"] == 1
    assert any("Insurance expired" in a["text"] and a["urgent"] for a in body["fleet_alerts"])
    yesterday = client.get(f"/schools/{school.id}/oversight/transport?on={today - timedelta(days=1)}&class_id={w['cls'].id}", headers=head).json()
    assert yesterday["classes"][0]["rows"][0]["arrival"] is None
    assert client.get(f"/schools/{school.id}/oversight/transport", headers=rider).status_code == 403


def test_a_vehicle_needs_a_real_attendant(client, db_session, school, school_admin_token):
    t, _ = _make_user(db_session, school, UserRole.TEACHER, "not.attendant@test-academy.test")
    r = client.post(f"/schools/{school.id}/transport/vehicles", json={"registration_number": "KZZ 1", "capacity": 20, "driver_name": "D", "driver_phone": "1", "attendant_user_id": t.id}, headers=auth_headers(school_admin_token))
    assert r.status_code == 400
