"""The sample-data generator builds a whole, consistent school from the grades it has enabled, and removes only what it made."""

import pytest

from app.models.academics import SchoolClass, Student
from app.models.attendance import AttendanceRecord
from app.models.exam import Exam
from app.models.grade_level import GradeLevel, SchoolEnabledGrade
from app.models.homework import Homework
from app.models.lesson_plan import LessonPlan
from app.models.results import Result, Subject
from app.models.school_period import SchoolPeriod
from app.models.timetable import TimetableSlot
from app.models.user import User, UserRole
from app.seed.run import has_sample_data, remove_school_sample, seed_school
from app.core.security import verify_password


@pytest.fixture(autouse=True)
def _fast_passwords(monkeypatch):
    # Real hashing is deliberately slow; the generator makes hundreds of logins.
    monkeypatch.setattr("app.seed.core.hash_password", lambda p: "x" + p)


def _enable(db, school, codes):
    ids = [g.id for g in db.query(GradeLevel).filter(GradeLevel.code.in_(codes))]
    for gid in ids:
        db.add(SchoolEnabledGrade(school_id=school.id, grade_level_id=gid))
    db.commit()


def test_a_campus_up_to_grade_3_gets_only_those_levels_and_a_working_timetable(db_session, school):
    _enable(db_session, school, ["PP1", "PP2", "G1", "G2", "G3"])
    result = seed_school(db_session, school)

    classes = {c.name for c in db_session.query(SchoolClass).filter_by(school_id=school.id)}
    assert classes == {"PP1", "PP2", "Grade 1", "Grade 2", "Grade 3"}
    assert result["students"] == 50 and result["staff"] >= 10
    subjects = {s.name for s in db_session.query(Subject).filter_by(school_id=school.id)}
    assert {"Language Activities", "English Language Activities", "Kiswahili Language Activities", "Hygiene and Nutrition Activities"} <= subjects
    assert "Biology" not in subjects and "Integrated Science" not in subjects   # nothing above the levels taught

    # The standard school day, and no teacher in two classes at once.
    assert db_session.query(SchoolPeriod).filter_by(school_id=school.id).count() > 0
    seen = set()
    for slot in db_session.query(TimetableSlot).filter_by(school_id=school.id):
        key = (slot.teacher_user_id, slot.day_of_week, slot.start_time)
        assert key not in seen
        seen.add(key)
    assert db_session.query(AttendanceRecord).filter_by(school_id=school.id).count() > 0
    assert db_session.query(Result).filter_by(school_id=school.id).count() > 0
    assert db_session.query(LessonPlan).filter_by(school_id=school.id).count() > 0
    assert db_session.query(Homework).filter_by(school_id=school.id).count() > 0
    assert db_session.query(Exam).filter_by(school_id=school.id).count() > 0


def test_logins_use_the_first_name_and_the_agreed_password_format(db_session, school):
    _enable(db_session, school, ["PP1", "G1"])
    seed_school(db_session, school)
    sample = db_session.query(User).filter_by(school_id=school.id, is_demo=True, role=UserRole.TEACHER).first()
    first = sample.full_name.split()[0]
    assert sample.email.startswith(first.lower()) and sample.email.endswith("@milai.com")
    assert sample.hashed_password == f"x@{first}@#1"
    roles = {u.role for u in db_session.query(User).filter_by(school_id=school.id, is_demo=True)}
    assert {UserRole.TEACHER, UserRole.PARENT, UserRole.STUDENT} <= roles


def test_it_refuses_without_grades_and_can_be_removed_cleanly(db_session, school):
    with pytest.raises(ValueError):
        seed_school(db_session, school)
    _enable(db_session, school, ["G1"])
    seed_school(db_session, school)
    assert has_sample_data(db_session, school.id)
    with pytest.raises(ValueError):
        seed_school(db_session, school)
    remove_school_sample(db_session, school.id)
    assert not has_sample_data(db_session, school.id)
    assert db_session.query(Student).filter_by(school_id=school.id).count() == 0
    assert db_session.query(User).filter_by(school_id=school.id, is_demo=True).count() == 0


def test_a_full_boarding_campus_fills_every_module_and_every_page_still_loads(client, db_session, school, school_admin_token):
    from app.models.module import SchoolModule
    from app.models.boarding import BoardingHouse
    from app.models.library import Book
    from app.models.transport import TransportRun
    from app.models.security import VisitorLog
    from app.models.payroll import PayRun
    from app.models.store import StockItem
    from app.models.award import Award
    from app.models.calendar_event import CalendarEvent
    from tests.conftest import auth_headers

    _enable(db_session, school, ["PP1", "PP2", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9", "G10", "G11", "G12"])
    db_session.add(SchoolModule(school_id=school.id, module_key="boarding", enabled=True)) if not db_session.query(SchoolModule).filter_by(school_id=school.id, module_key="boarding").first() else None
    db_session.query(SchoolModule).filter_by(school_id=school.id, module_key="boarding").update({"enabled": True})
    db_session.commit()
    seed_school(db_session, school)

    for model in (Book, TransportRun, VisitorLog, PayRun, StockItem, Award, CalendarEvent, BoardingHouse):
        assert db_session.query(model).filter_by(school_id=school.id).count() > 0, model.__name__
    assert db_session.query(SchoolClass).filter_by(school_id=school.id).count() == 14

    h = auth_headers(school_admin_token)
    paths = ["students", "classes", "academic-terms", "subjects", "timetable", "homework", "exams", "lesson-plans", "library/books", "transport/runs", "transport/vehicles",
             "boarding/houses", "security/visitors", "finance/summary", "ledger/income-statement", "ledger/accounts", "suppliers", "purchase-orders", "stores/items", "stores/requests",
             "trips", "awards", "activities", "conduct-reports", "complaints", "calendar-events", "announcements", "payroll/runs", "assets", "budgets", "crm/leads"]
    bad = []
    for p in paths:
        r = client.get(f"/schools/{school.id}/{p}", headers=h)
        if r.status_code >= 500:
            bad.append(f"{p}: {r.status_code} {r.text[:120]}")
    assert not bad, "\n".join(bad)


def test_a_campus_uses_the_class_names_it_gave(db_session, school):
    school.slug = "milai-elgon-view"
    db_session.commit()
    _enable(db_session, school, ["DC", "PG", "PP1", "PP2", "G1", "G2", "G3"])
    result = seed_school(db_session, school)

    names = {c.name for c in db_session.query(SchoolClass).filter_by(school_id=school.id)}
    assert {"Daycare A (Malaika)", "Playgroup B (Upendo)", "PP1 C (Rehema)", "PP2 A (Imani)", "Grade 1 B (Shukrani)", "Grade 3 C (Hodari)"} <= names
    assert result["classes"] == 19 and len(names) == 19
    assert result["students"] == 19 * 8      # many streams, so fewer learners in each
    seen = set()
    for slot in db_session.query(TimetableSlot).filter_by(school_id=school.id):
        key = (slot.teacher_user_id, slot.day_of_week, slot.start_time)
        assert key not in seen
        seen.add(key)
