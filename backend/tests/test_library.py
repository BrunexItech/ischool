"""The library end to end: the shelf, a teacher's class set, a learner's book, and the head's view."""

from datetime import timedelta

from app.core.dates import school_today
from app.models.academics import SchoolClass, Student
from app.models.library import Loan
from app.models.user import UserRole
from tests.conftest import _login, _make_user, auth_headers


def _world(db, school):
    lib, lpw = _make_user(db, school, UserRole.LIBRARIAN, "lib@test-academy.test")
    teacher, tpw = _make_user(db, school, UserRole.TEACHER, "lib.teacher@test-academy.test")
    pupil_user, spw = _make_user(db, school, UserRole.STUDENT, "lib.pupil@test-academy.test")
    cls = SchoolClass(school_id=school.id, name="Grade 5 Library")
    db.add(cls)
    db.flush()
    kid = Student(school_id=school.id, class_id=cls.id, admission_number="L-1", first_name="Wanjiru", last_name="Reader", user_id=pupil_user.id)
    other = Student(school_id=school.id, class_id=cls.id, admission_number="L-2", first_name="Brian", last_name="Other")
    db.add_all([kid, other])
    db.commit()
    return dict(lib=lib, lpw=lpw, teacher=teacher, tpw=tpw, pupil=pupil_user, spw=spw, cls=cls, kid=kid, other=other)


def _h(client, user, pw):
    return auth_headers(_login(client, user.email, pw))


def _add(client, school, h, title="Oliver Twist", copies=3):
    r = client.post(f"/schools/{school.id}/library/books", json={"title": title, "author": "C. Dickens", "category": "Storybook", "copies": copies}, headers=h)
    assert r.status_code == 201, r.text
    return r.json()


def test_a_title_gets_numbered_copies(client, db_session, school):
    w = _world(db_session, school)
    lib = _h(client, w["lib"], w["lpw"])
    book = _add(client, school, lib)
    numbers = [c["copy_number"] for c in book["copies"]]
    assert len(set(numbers)) == 3 and all(n.startswith("BK-") for n in numbers)
    assert book["book"]["available"] == 3
    more = client.post(f"/schools/{school.id}/library/books/{book['book']['id']}/copies", json={"count": 2}, headers=lib).json()
    assert more["book"]["total_copies"] == 5 and len({c["copy_number"] for c in more["copies"]}) == 5


def test_the_library_lends_a_class_set_and_the_teacher_issues_books_on_to_learners(client, db_session, school):
    w = _world(db_session, school)
    lib, teacher = _h(client, w["lib"], w["lpw"]), _h(client, w["teacher"], w["tpw"])
    base = f"/schools/{school.id}/library"
    nums = [c["copy_number"] for c in _add(client, school, lib)["copies"]]
    for n in nums[:2]:
        r = client.post(f"{base}/loans", json={"copy_number": n, "teacher_user_id": w["teacher"].id, "for_class_id": w["cls"].id}, headers=lib)
        assert r.status_code == 201, r.text
    mine = client.get(f"{base}/mine", headers=teacher).json()
    assert mine["sets"][0]["copies"] == 2 and mine["sets"][0]["titles"] == ["Oliver Twist"] and mine["sets"][0]["with_learners"] == 0
    # the teacher gives one to Wanjiru, recording the book number
    r = client.post(f"{base}/loans", json={"copy_number": nums[0], "student_id": w["kid"].id}, headers=teacher)
    assert r.status_code == 201, r.text
    assert r.json()["via_teacher"] == w["teacher"].full_name and r.json()["copy_number"] == nums[0]
    # not the third copy: it is still on the shelf, not in this teacher's hands
    assert client.post(f"{base}/loans", json={"copy_number": nums[2], "student_id": w["kid"].id}, headers=teacher).status_code == 403
    # and not a book already with a learner
    assert client.post(f"{base}/loans", json={"copy_number": nums[0], "student_id": w["other"].id}, headers=teacher).status_code == 409
    holder = client.get(f"{base}/copies/{nums[0]}", headers=lib).json()["holder"]
    assert holder["name"] == "Wanjiru Reader" and holder["via_teacher"] == w["teacher"].full_name
    assert client.get(f"{base}/mine", headers=teacher).json()["sets"][0]["with_learners"] == 1
    # the learner sees her own book, with the number
    mybooks = client.get(f"{base}/my-books", headers=_h(client, w["pupil"], w["spw"])).json()
    assert [(b["copy_number"], b["active"]) for b in mybooks] == [(nums[0], True)]
    # the library cannot take the class copy back while Wanjiru has it
    class_loan = next(l for l in client.get(f"{base}/loans", headers=lib).json() if l["copy_number"] == nums[0] and l["borrower_kind"] == "teacher")
    assert client.post(f"{base}/loans/{class_loan['id']}/return", headers=lib).status_code == 409
    child = next(l for l in client.get(f"{base}/loans", headers=lib).json() if l["borrower_kind"] == "student")
    assert client.post(f"{base}/loans/{child['id']}/return", json={"condition": "fair"}, headers=teacher).status_code == 200
    # back with the teacher, not on the shelf
    assert client.get(f"{base}/copies/{nums[0]}", headers=lib).json()["status"] == "on_loan"
    assert client.post(f"{base}/loans/{class_loan['id']}/return", headers=lib).status_code == 200
    assert client.get(f"{base}/copies/{nums[0]}", headers=lib).json()["status"] == "available"


def test_a_teacher_cannot_return_a_book_they_did_not_issue(client, db_session, school):
    w = _world(db_session, school)
    lib = _h(client, w["lib"], w["lpw"])
    teacher = _h(client, w["teacher"], w["tpw"])
    base = f"/schools/{school.id}/library"
    n = _add(client, school, lib, copies=1)["copies"][0]["copy_number"]
    loan = client.post(f"{base}/loans", json={"copy_number": n, "student_id": w["kid"].id}, headers=lib).json()
    assert client.post(f"{base}/loans/{loan['id']}/return", headers=teacher).status_code == 403
    assert client.post(f"{base}/loans/{loan['id']}/return", json={"condition": "lost"}, headers=lib).status_code == 200
    assert client.get(f"{base}/copies/{n}", headers=lib).json()["status"] == "lost"


def test_a_learner_cannot_hold_more_than_three_books(client, db_session, school):
    w = _world(db_session, school)
    lib = _h(client, w["lib"], w["lpw"])
    base = f"/schools/{school.id}/library"
    nums = [c["copy_number"] for c in _add(client, school, lib, copies=4)["copies"]]
    for n in nums[:3]:
        assert client.post(f"{base}/loans", json={"copy_number": n, "student_id": w["kid"].id}, headers=lib).status_code == 201
    r = client.post(f"{base}/loans", json={"copy_number": nums[3], "student_id": w["kid"].id}, headers=lib)
    assert r.status_code == 409 and "3 books" in r.json()["detail"]


def test_the_head_sees_overdue_books_and_class_sets_but_cannot_lend(client, db_session, school, school_admin_token):
    w = _world(db_session, school)
    lib = _h(client, w["lib"], w["lpw"])
    head = auth_headers(school_admin_token)
    base = f"/schools/{school.id}/library"
    n = _add(client, school, lib, copies=2)["copies"]
    client.post(f"{base}/loans", json={"copy_number": n[0]["copy_number"], "student_id": w["kid"].id}, headers=lib)
    client.post(f"{base}/loans", json={"copy_number": n[1]["copy_number"], "teacher_user_id": w["teacher"].id, "for_class_id": w["cls"].id}, headers=lib)
    db_session.query(Loan).filter(Loan.student_id == w["kid"].id).update({"due_date": school_today(db_session, school.id) - timedelta(days=5)})
    db_session.commit()
    ov = client.get(f"{base}/overview", headers=head).json()
    assert ov["overdue"] == 1 and ov["overdue_loans"][0]["days_overdue"] == 5 and ov["overdue_loans"][0]["borrower_name"] == "Wanjiru Reader"
    assert ov["class_sets"][0]["copies"] == 1 and ov["class_sets"][0]["class_name"] == "Grade 5 Library"
    assert ov["copies"] == 2 and ov["on_loan"] == 2 and ov["popular"][0]["title"] == "Oliver Twist"
    assert client.post(f"{base}/loans", json={"copy_number": n[0]["copy_number"], "student_id": w["other"].id}, headers=head).status_code == 403
    assert client.get(f"{base}/loans?state=overdue", headers=head).json()[0]["overdue"] is True


def test_learners_see_the_catalogue_but_not_who_has_each_copy(client, db_session, school):
    w = _world(db_session, school)
    lib = _h(client, w["lib"], w["lpw"])
    pupil = _h(client, w["pupil"], w["spw"])
    base = f"/schools/{school.id}/library"
    book = _add(client, school, lib, copies=1)
    client.post(f"{base}/loans", json={"copy_number": book["copies"][0]["copy_number"], "student_id": w["other"].id}, headers=lib)
    listing = client.get(f"{base}/books?q=oliver", headers=pupil).json()
    assert listing[0]["available"] == 0 and listing[0]["on_loan"] == 1
    assert client.get(f"{base}/books/{book['book']['id']}", headers=pupil).json()["copies"][0]["holder"] is None
    assert client.get(f"{base}/students/{w['other'].id}/loans", headers=pupil).status_code == 403
    assert client.get(f"{base}/overview", headers=pupil).status_code == 403
