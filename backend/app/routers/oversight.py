from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from datetime import date, timedelta

from app.core.activity_feed import KINDS, activity_counts, build_activity
from app.core.dates import school_today
from app.core.module_pulse import PULSES, module_pulse, weekly_report
from app.core.finance_activity import finance_activity
from app.core.transport_oversight import transport_overview
from app.core.oversight import exam_readiness, performance_overview, attendance_oversight, class_cards, class_detail, head_overview, homework_grid, teacher_cards
from app.models.school import School
from app.models.user import User, UserRole
from app.schemas.oversight import ExamReadiness, FinanceActivity, TransportOverview, PerformanceOverview, ActivityFeed, MarkOverride, PulseSection, WeeklyReport, AttendanceOversight, ClassCard, ClassDetail, HeadOverview, HomeworkGrid, TeacherCard

router = APIRouter(prefix="/schools/{school_id}/oversight", tags=["oversight"])

LEADERSHIP = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL)
OFFICE = LEADERSHIP + (UserRole.SECRETARY,)
CLASS_VIEWERS = OFFICE + (UserRole.STAFF,)


@router.get(
    "/classes",
    response_model=list[ClassCard],
    dependencies=[Depends(require_roles(*CLASS_VIEWERS)), Depends(require_feature("students_staff"))],
)
def classes_overview(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Every class at a glance: who teaches it, how many learners, whether
    today's register was taken, the average, syllabus coverage and open concerns."""
    ensure_school_access(db, current_user, school_id)
    return class_cards(db, school_id)


@router.get(
    "/classes/{class_id}",
    response_model=ClassDetail,
    dependencies=[Depends(require_roles(*CLASS_VIEWERS)), Depends(require_feature("students_staff"))],
)
def class_overview(school_id: int, class_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    detail = class_detail(db, school_id, class_id)
    if detail is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
    return detail


@router.get(
    "/teachers",
    response_model=list[TeacherCard],
    dependencies=[Depends(require_roles(*OFFICE)), Depends(require_feature("students_staff"))],
)
def teachers_overview(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Every teacher at a glance: contact details, what and where they teach,
    today's presence, plan progress, lessons marked and homework given this week."""
    ensure_school_access(db, current_user, school_id)
    return teacher_cards(db, school_id)


@router.get(
    "/homework",
    response_model=HomeworkGrid,
    dependencies=[Depends(require_roles(*LEADERSHIP)), Depends(require_feature("homework"))],
)
def homework_overview(school_id: int, week: date | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """For each class and subject, each day of the week: was homework given
    (typed in, or on the board), declared as none, or not recorded?"""
    ensure_school_access(db, current_user, school_id)
    return homework_grid(db, school_id, week)


@router.get(
    "/attendance",
    response_model=AttendanceOversight,
    dependencies=[Depends(require_roles(*OFFICE)), Depends(require_feature("attendance"))],
)
def attendance_overview(school_id: int, on: date | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Which registers were taken, by whom, and who is away, class by class."""
    ensure_school_access(db, current_user, school_id)
    return attendance_oversight(db, school_id, on or school_today(db, school_id))


@router.get(
    "/overview",
    response_model=HeadOverview,
    dependencies=[Depends(require_roles(*LEADERSHIP))],
)
def head_overview_endpoint(school_id: int, start: date | None = None, end: date | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The pulse of the school for a day, or added up over a span of days
    (default: today), and everything still waiting on the head."""
    ensure_school_access(db, current_user, school_id)
    if start and end and end < start:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "The end date is before the start date")
    if start and (end or school_today(db, school_id)) - start > timedelta(days=62):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Pick a span of about two months or less")
    return head_overview(db, school_id, start, end)


# The departments the head's office can see a summary of. Money, staff
# conduct and complaints stay with the head.
OFFICE_PULSES = {"students", "calendar", "announcements", "admissions", "activities", "awards", "trips", "attendance", "exams"}


@router.get("/pulse/{key}", response_model=PulseSection, dependencies=[Depends(require_roles(*OFFICE))])
def department_pulse(school_id: int, key: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """One department's week in a few figures, with what needs a look."""
    ensure_school_access(db, current_user, school_id)
    if key not in PULSES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown department")
    if current_user.role == UserRole.SECRETARY and key not in OFFICE_PULSES:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not permitted for this role")
    return module_pulse(db, school_id, key)


@router.get("/weekly-report", response_model=WeeklyReport, dependencies=[Depends(require_roles(*LEADERSHIP))])
def weekly_report_endpoint(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The combined report of every department, as it will be emailed on Saturday morning."""
    ensure_school_access(db, current_user, school_id)
    school = db.get(School, school_id)
    return weekly_report(db, school)


@router.post("/weekly-report/email-me", dependencies=[Depends(require_roles(*LEADERSHIP))])
def email_me_the_report(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Sends this week's report to the signed-in head right now."""
    from app.services.weekly_reports import email_digest

    ensure_school_access(db, current_user, school_id)
    school = db.get(School, school_id)
    return {"sent": bool(email_digest(db, school, [current_user]))}


@router.post("/overrides/mark", dependencies=[Depends(require_roles(*LEADERSHIP)), Depends(require_feature("results"))])
def override_mark(school_id: int, payload: MarkOverride, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Leadership corrects a recorded mark. Marks belong to the teacher, so this
    only changes a mark that already exists, needs a written reason, is kept in
    the activity log, and the teacher who entered it is notified."""
    from app.core.audit import record_audit
    from app.core.grading import level_for_score
    from app.core.notify import notify
    from app.models.academics import Student
    from app.models.results import Result, Subject

    ensure_school_access(db, current_user, school_id)
    reason = payload.reason.strip()
    if len(reason) < 10:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Give a reason of at least a few words, so the teacher understands the change")
    if not 0 <= payload.score <= 100:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A mark must be between 0 and 100")
    result = db.query(Result).filter_by(school_id=school_id, student_id=payload.student_id, subject_id=payload.subject_id, term=payload.term, exam_type=payload.exam_type).first()
    if result is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "There is no recorded mark to correct. The teacher enters new marks.")

    before = {"score": float(result.score), "grade": result.grade}
    result.score = payload.score
    result.grade = level_for_score(db, school_id, payload.score)
    after = {"score": payload.score, "grade": result.grade, "reason": reason}
    record_audit(db, school_id=school_id, actor_id=current_user.id, action="result.override", entity_type="result", entity_id=result.id, before=before, after=after)
    if result.recorded_by and result.recorded_by != current_user.id:
        student = db.get(Student, payload.student_id)
        subject = db.get(Subject, payload.subject_id)
        notify(
            db,
            school_id=school_id,
            user_id=result.recorded_by,
            title=f"{current_user.full_name} corrected a mark",
            body=f"{subject.name if subject else 'Subject'}, {student.first_name if student else 'learner'} {student.last_name if student else ''}: {before['score']:g} became {payload.score:g}. Reason: {reason}"[:300],
            link="/dashboard/results",
        )
    db.commit()
    return {"score": result.score, "grade": result.grade}


@router.get("/activity", response_model=ActivityFeed, dependencies=[Depends(require_roles(*LEADERSHIP))])
def activity_feed(
    school_id: int,
    start: date | None = None,
    end: date | None = None,
    kinds: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """What happened across the school between two dates (default: today).
    One day gives the "Find by date" view; a few days gives recent activity."""
    ensure_school_access(db, current_user, school_id)
    today = school_today(db, school_id)
    first = start or end or today
    last = end or first
    if last < first:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "End date is before the start date")
    if (last - first).days > 92:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Pick a span of three months or less")
    wanted = {k for k in (kinds or "").split(",") if k in KINDS} or None
    events = build_activity(db, school_id, first, last, wanted)
    return ActivityFeed(start=first, end=last, total=len(events), counts=activity_counts(events), events=events)


@router.get(
    "/performance",
    response_model=PerformanceOverview,
    dependencies=[Depends(require_roles(*LEADERSHIP)), Depends(require_feature("results"))],
)
def performance(school_id: int, term: str | None = None, exam_types: str | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Every class's average, pass rate and top learners with their positions,
    so the head sees how each class is doing before opening a report card."""
    ensure_school_access(db, current_user, school_id)
    chosen = [t.strip() for t in (exam_types or "").split(",") if t.strip()]
    return performance_overview(db, school_id, term, chosen)


@router.get(
    "/transport",
    response_model=TransportOverview,
    dependencies=[Depends(require_roles(*LEADERSHIP)), Depends(require_feature("transport"))],
)
def transport_oversight(school_id: int, on: date | None = None, class_id: int | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """How every child arrived at and left school on a day, by class, with the
    day's bus runs and vehicle papers. Pick any date to look back."""
    ensure_school_access(db, current_user, school_id)
    return transport_overview(db, school_id, on or school_today(db, school_id), class_id)


@router.get("/finance-activity", response_model=FinanceActivity, dependencies=[Depends(require_roles(*LEADERSHIP))])
def finance_desk_activity(school_id: int, start: date | None = None, end: date | None = None, actor_id: int | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """What the bursar, accountant, procurement officer and store keeper did,
    person by person, for a span of days (default: the last 7 days)."""
    ensure_school_access(db, current_user, school_id)
    today = school_today(db, school_id)
    last = end or today
    first = start or (last - timedelta(days=6))
    if last < first:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "End date is before the start date")
    if (last - first).days > 92:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Pick a span of three months or less")
    return finance_activity(db, school_id, first, last, actor_id)


@router.get("/exam-readiness", response_model=ExamReadiness, dependencies=[Depends(require_roles(*OFFICE)), Depends(require_feature("students_staff"))])
def exam_readiness_endpoint(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """For Grades 6, 9 and 12: which learners still lack the numbers a national
    assessment needs (UPI, assessment or index number, birth certificate number)."""
    ensure_school_access(db, current_user, school_id)
    return exam_readiness(db, school_id)
