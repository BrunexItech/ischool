"""The whole sample-data run for one school."""

from sqlalchemy.orm import Session

from app.models.grade_level import GradeLevel, SchoolEnabledGrade
from app.models.module import SchoolModule
from app.models.school import School
from app.seed import academics, community, events, finance, learners, learning, money, operations
from app.seed.academics import Ctx
from app.seed.core import Seeder, remove_sample_rows
from app.models.sample_data import SampleDataRow


def has_sample_data(db: Session, school_id: int) -> bool:
    return db.query(SampleDataRow.id).filter_by(school_id=school_id).first() is not None


def _tag(school: School) -> str:
    parts = [p for p in school.slug.split("-") if p != "milai"]
    word = "".join(p[0] for p in parts) or school.slug[:2]
    return ("M" + word).upper()[:6]


def seed_school(db: Session, school: School) -> dict:
    if has_sample_data(db, school.id):
        raise ValueError("This school already has sample data. Remove it first.")
    grades = (
        db.query(GradeLevel)
        .join(SchoolEnabledGrade, SchoolEnabledGrade.grade_level_id == GradeLevel.id)
        .filter(SchoolEnabledGrade.school_id == school.id)
        .order_by(GradeLevel.sort_order)
        .all()
    )
    if not grades:
        raise ValueError("Choose the grades this school teaches first: sign in as its head, open Classes, then Grades and streams.")

    s = Seeder(db, school)
    ctx = Ctx(grades=grades)
    boarding = db.query(SchoolModule).filter_by(school_id=school.id, module_key="boarding").first()
    ctx.boarding = bool(boarding and boarding.enabled)
    tag = _tag(school)

    academics.seed_terms(s, ctx)
    academics.seed_bands(s)
    academics.seed_periods(s, ctx)
    academics.seed_subjects(s, ctx)
    academics.seed_teachers_and_classes(s, ctx, tag)
    academics.seed_timetable(s, ctx)
    learners.seed_learners(s, ctx, tag)
    learners.seed_attendance(s, ctx)
    learners.seed_results(s, ctx)
    learning.seed_homework(s, ctx)
    learning.seed_exams(s, ctx)
    learning.seed_lesson_plans(s, ctx)
    operations.seed_support_staff(s, ctx, tag)
    money.seed_fees(s, ctx)
    operations.seed_library(s, ctx, tag)
    operations.seed_meals(s, ctx)
    operations.seed_transport(s, ctx, tag)
    operations.seed_boarding(s, ctx)
    operations.seed_security(s, ctx)
    operations.seed_staff_attendance(s, ctx)
    finance.seed_ledger_and_expenses(s, ctx)
    finance.seed_budgets_and_assets(s, ctx)
    finance.seed_payroll(s, ctx)
    finance.seed_procurement(s, ctx, tag)
    finance.seed_stores(s, ctx, tag)
    community.seed_activities_and_awards(s, ctx)
    community.seed_conduct_and_complaints(s, ctx)
    community.seed_trips(s, ctx)
    community.seed_competency(s, ctx)
    community.seed_remarks_feedback_crm(s, ctx)
    community.seed_live_and_meetings(s, ctx)
    events.seed_calendar(s, ctx)
    events.seed_announcements(s, ctx)

    s.save_log()
    db.commit()
    first_teacher = ctx.teachers[0][0]
    return {
        "classes": len(ctx.classes),
        "students": sum(len(v) for v in ctx.students.values()),
        "staff": len(ctx.teachers),
        "teacher_login": {"email": first_teacher.email, "password": f"@{ctx.teachers[0][1]['first']}@#1"},
    }


def remove_school_sample(db: Session, school_id: int) -> dict:
    removed = remove_sample_rows(db, school_id)
    return {"removed": removed}
