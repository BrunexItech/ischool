"""Terms that cannot be set in a finished year, exam numbers, fees set per grade and term, and handing a school to a new head."""

from datetime import date, timedelta
from unittest.mock import patch

from app.core.dates import school_today
from app.models.academic_term import AcademicTerm
from app.models.academics import SchoolClass, Student
from app.models.fees import FeeInvoice, FeePayment
from app.models.grade_level import GradeLevel
from app.models.user import User, UserRole
from tests.conftest import _login, _make_user, auth_headers


# --- Terms ---


def test_a_term_cannot_be_set_for_a_year_that_is_over(client, db_session, school, school_admin_token):
    h = auth_headers(school_admin_token)
    year = school_today(db_session, school.id).year
    r = client.post(f"/schools/{school.id}/academic-terms", json={"name": "Term 1", "start_date": f"{year - 1}-01-05", "end_date": f"{year - 1}-04-05"}, headers=h)
    assert r.status_code == 400 and "already finished" in r.json()["detail"]
    assert client.post(f"/schools/{school.id}/academic-terms", json={"name": f"Term 2 {year - 1}"}, headers=h).status_code == 400
    ok = client.post(f"/schools/{school.id}/academic-terms", json={"name": f"Term 3 {year}", "start_date": f"{year}-09-01", "end_date": f"{year}-11-20"}, headers=h)
    assert ok.status_code == 201
    assert client.post(f"/schools/{school.id}/academic-terms", json={"name": "Backwards", "start_date": f"{year}-05-01", "end_date": f"{year}-04-01"}, headers=h).status_code == 422


# --- Exam numbers ---


def _grade(db, code):
    return db.query(GradeLevel).filter_by(code=code).first()


def test_exam_numbers_are_optional_and_can_be_added_later(client, db_session, school, school_admin_token):
    h = auth_headers(school_admin_token)
    cls = SchoolClass(school_id=school.id, name="Grade 6 Exam", grade_level_id=_grade(db_session, "G6").id)
    db_session.add(cls)
    db_session.commit()
    r = client.post(f"/schools/{school.id}/students", json={"admission_number": "X-1", "first_name": "Ann", "last_name": "Exam", "class_id": cls.id}, headers=h)
    assert r.status_code == 201, r.text
    sid = r.json()["id"]
    assert r.json()["upi_number"] is None
    ready = client.get(f"/schools/{school.id}/oversight/exam-readiness", headers=h).json()
    g6 = next(g for g in ready["groups"] if g["grade_code"] == "G6")
    assert g6["exam"] == "KPSEA" and g6["complete"] == 0 and set(g6["rows"][0]["missing"]) == {"UPI", "Assessment number", "Birth certificate number"}
    p = client.patch(f"/schools/{school.id}/students/{sid}", json={"upi_number": "ABC123", "assessment_number": "A-998", "birth_certificate_number": "BC-77", "nationality": "Kenyan"}, headers=h)
    assert p.status_code == 200 and p.json()["assessment_number"] == "A-998"
    g6 = next(g for g in client.get(f"/schools/{school.id}/oversight/exam-readiness", headers=h).json()["groups"] if g["grade_code"] == "G6")
    assert g6["complete"] == 1
    # and they stay editable
    assert client.patch(f"/schools/{school.id}/students/{sid}", json={"upi_number": "ZZZ999"}, headers=h).json()["upi_number"] == "ZZZ999"


# --- Fees ---


def _term(db, school, name="Term 3"):
    today = school_today(db, school.id)
    t = AcademicTerm(school_id=school.id, name=name, start_date=today - timedelta(days=30), end_date=today + timedelta(days=60), is_current=True)
    db.add(t)
    db.commit()
    return t


def _fee_world(db, school):
    g4, g5 = _grade(db, "G4"), _grade(db, "G5")
    c4, c5 = SchoolClass(school_id=school.id, name="F Grade 4", grade_level_id=g4.id), SchoolClass(school_id=school.id, name="F Grade 5", grade_level_id=g5.id)
    db.add_all([c4, c5])
    db.flush()
    kids = [
        Student(school_id=school.id, class_id=c4.id, admission_number="F-1", first_name="Amina", last_name="One", guardian_name="Mama One", guardian_phone="0712345678", guardian_email="mama1@x.test"),
        Student(school_id=school.id, class_id=c4.id, admission_number="F-2", first_name="Brian", last_name="Two", guardian_phone="0722222222"),
        Student(school_id=school.id, class_id=c5.id, admission_number="F-3", first_name="Cate", last_name="Three"),
    ]
    db.add_all(kids)
    db.commit()
    return g4, g5, kids


def test_the_bursar_sets_fees_per_grade_and_bills_everyone_once(client, db_session, school, bursar_token):
    _term(db_session, school)
    g4, g5, kids = _fee_world(db_session, school)
    h = auth_headers(bursar_token)
    lines = [{"grade_level_id": g4.id, "category": "tuition", "amount": 20000}, {"grade_level_id": g4.id, "category": "transport", "amount": 5000}, {"grade_level_id": g5.id, "category": "tuition", "amount": 22000}]
    r = client.put(f"/schools/{school.id}/fees/structure", json={"term": "Term 3", "lines": lines}, headers=h)
    assert r.status_code == 200 and r.json()["applied"] is True
    got = client.get(f"/schools/{school.id}/fees/structure?term=Term 3", headers=h).json()
    assert len(got["lines"]) == 3 and got["learners_by_grade"][str(g4.id)] == 2
    gen = client.post(f"/schools/{school.id}/fees/structure/generate", json={"term": "Term 3"}, headers=h).json()
    assert gen["created"] == 5 and gen["total_billed"] == 2 * 25000 + 22000
    again = client.post(f"/schools/{school.id}/fees/structure/generate", json={"term": "Term 3"}, headers=h).json()
    assert again["created"] == 0 and again["skipped_existing"] == 5
    assert client.put(f"/schools/{school.id}/fees/structure", json={"term": "Nonexistent", "lines": lines}, headers=h).status_code == 400


def test_the_secretary_proposes_fees_and_they_wait_for_the_head(client, db_session, school, school_admin_token):
    _term(db_session, school)
    g4, g5, kids = _fee_world(db_session, school)
    head = auth_headers(school_admin_token)
    sec, pw = _make_user(db_session, school, UserRole.SECRETARY, "fees.desk@test-academy.test")
    desk = auth_headers(_login(client, sec.email, pw))
    lines = [{"grade_level_id": g4.id, "category": "tuition", "amount": 21000}]
    r = client.put(f"/schools/{school.id}/fees/structure", json={"term": "Term 3", "lines": lines}, headers=desk)
    assert r.status_code == 200 and r.json()["applied"] is False
    assert client.get(f"/schools/{school.id}/fees/structure?term=Term 3", headers=head).json()["lines"] == []
    rid = client.get(f"/schools/{school.id}/approvals?kind=fee_structure&pending_only=true", headers=head).json()[0]["id"]
    assert client.post(f"/schools/{school.id}/approvals/{rid}/approve", headers=head).status_code == 200
    assert client.get(f"/schools/{school.id}/fees/structure?term=Term 3", headers=head).json()["lines"][0]["amount"] == 21000
    # the secretary cannot bill anyone or see balances
    assert client.post(f"/schools/{school.id}/fees/structure/generate", json={"term": "Term 3"}, headers=desk).status_code == 403
    assert client.get(f"/schools/{school.id}/fees/balances", headers=desk).status_code == 403


def test_balances_show_arrears_and_can_be_filtered(client, db_session, school, bursar_token):
    _term(db_session, school, "Term 2")
    _term(db_session, school, "Term 3")
    g4, g5, kids = _fee_world(db_session, school)
    # Amina owes 3,000 from Term 2 and has paid 8,000 of 20,000 this term; Brian owes 20,000; Cate nothing billed.
    db_session.add_all([
        FeeInvoice(school_id=school.id, student_id=kids[0].id, term="Term 2", amount_due=10000, amount_paid=7000),
        FeeInvoice(school_id=school.id, student_id=kids[0].id, term="Term 3", amount_due=20000, amount_paid=8000),
        FeeInvoice(school_id=school.id, student_id=kids[1].id, term="Term 3", amount_due=20000, amount_paid=0),
    ])
    db_session.commit()
    h = auth_headers(bursar_token)
    base = f"/schools/{school.id}/fees/balances?term=Term 3"
    rows = {r["name"]: r for r in client.get(base, headers=h).json()["rows"]}
    assert set(rows) == {"Amina One", "Brian Two"}
    assert rows["Amina One"]["balance"] == 12000 and rows["Amina One"]["arrears"] == 3000 and rows["Amina One"]["total_owed"] == 15000
    assert [r["name"] for r in client.get(base + "&min_owed=16000", headers=h).json()["rows"]] == ["Brian Two"]
    assert [r["name"] for r in client.get(base + "&arrears_only=true", headers=h).json()["rows"]] == ["Amina One"]
    assert [r["name"] for r in client.get(base + "&exact_owed=15000", headers=h).json()["rows"]] == ["Amina One"]
    assert client.get(base, headers=h).json()["totals"]["total_owed"] == 35000


def test_reminders_go_to_each_parent_with_their_own_amount(client, db_session, school, bursar_token):
    _term(db_session, school)
    g4, g5, kids = _fee_world(db_session, school)
    db_session.add_all([FeeInvoice(school_id=school.id, student_id=kids[0].id, term="Term 3", amount_due=20000), FeeInvoice(school_id=school.id, student_id=kids[1].id, term="Term 3", amount_due=5000)])
    db_session.commit()
    h = auth_headers(bursar_token)
    sent = []
    with patch("app.routers.fee_structure.send_email", side_effect=lambda to, subject, body, **kw: sent.append((to, body)) or True):
        r = client.post(f"/schools/{school.id}/fees/balances/remind", json={"term": "Term 3", "student_ids": [kids[0].id, kids[1].id], "sms": True, "email": True}, headers=h)
    body = r.json()
    assert r.status_code == 200
    assert body["sms_error"] and "not set up" in body["sms_error"]          # no SMS account on this school
    assert body["email_sent"] == 1 and sent[0][0] == "mama1@x.test" and "KES 20,000" in sent[0][1] and "Mama One" in sent[0][1]
    assert body["no_contact"] == ["Brian Two"]


# --- Handing over the school ---


def test_only_the_super_admin_can_hand_a_school_to_a_new_head(client, db_session, school, super_admin_token, school_admin_token):
    head = db_session.query(User).filter_by(school_id=school.id, role=UserRole.HEAD_OF_INSTITUTION).first()
    root, other = auth_headers(super_admin_token), auth_headers(school_admin_token)
    body = {"outgoing_user_id": head.id, "new_head": {"full_name": "New Head", "email": "new.head@test-academy.test", "password": "StrongPass#2026"}, "reason": "Previous head has left the school"}
    # the sitting head (or a principal) cannot do it
    assert client.post(f"/schools/{school.id}/leadership/handover", json=body, headers=other).status_code == 403
    assert client.get(f"/schools/{school.id}/leadership/accounts", headers=other).status_code == 403
    r = client.post(f"/schools/{school.id}/leadership/handover", json=body, headers=root)
    assert r.status_code == 200, r.text
    assert r.json()["outgoing"]["is_active"] is False and r.json()["incoming"]["role"] == "head_of_institution"
    # the old head is locked out straight away, the new head can sign in, and must set their own password
    assert client.get(f"/schools/{school.id}/oversight/overview", headers=other).status_code == 401
    login = client.post("/auth/login", data={"username": "new.head@test-academy.test", "password": "StrongPass#2026"})
    assert login.status_code == 200
    new_headers = auth_headers(login.json()["access_token"])
    assert client.get(f"/schools/{school.id}/oversight/overview", headers=new_headers).status_code == 200


def test_a_handover_can_promote_existing_staff_and_the_only_head_cannot_be_switched_off_alone(client, db_session, school, super_admin_token, school_admin_token):
    head = db_session.query(User).filter_by(school_id=school.id, role=UserRole.HEAD_OF_INSTITUTION).first()
    deputy, _ = _make_user(db_session, school, UserRole.TEACHER, "deputy@test-academy.test")
    root = auth_headers(super_admin_token)
    r = client.post(f"/schools/{school.id}/leadership/accounts/{head.id}/active", json={"active": False}, headers=root)
    assert r.status_code == 409 and "only active head" in r.json()["detail"]
    r = client.post(f"/schools/{school.id}/leadership/handover", json={"outgoing_user_id": head.id, "existing_user_id": deputy.id, "reason": "Deputy takes over"}, headers=root)
    assert r.status_code == 200 and r.json()["incoming"]["user_id"] == deputy.id and r.json()["incoming"]["role"] == "head_of_institution"
    accounts = {a["user_id"]: a for a in client.get(f"/schools/{school.id}/leadership/accounts", headers=root).json()}
    assert accounts[head.id]["is_active"] is False and accounts[deputy.id]["is_active"] is True
    # switching the old head back on is possible and nothing was deleted
    assert client.post(f"/schools/{school.id}/leadership/accounts/{head.id}/active", json={"active": True}, headers=root).json()["is_active"] is True
    # a stranger from another school cannot be promoted
    assert client.post(f"/schools/{school.id}/leadership/handover", json={"outgoing_user_id": deputy.id, "existing_user_id": 999999, "reason": "Trying a bad id"}, headers=root).status_code == 404
