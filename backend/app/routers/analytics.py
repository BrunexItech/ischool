from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.academics import SchoolClass, Student
from app.models.results import Result, Subject
from app.models.user import User, UserRole
from app.schemas.analytics import (
    ClassAverage,
    GradeCount,
    ResultsAnalyticsOut,
    SubjectAverage,
    TermTrendPoint,
    TopStudent,
)

router = APIRouter(prefix="/schools/{school_id}/analytics", tags=["analytics"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER, UserRole.STAFF)


@router.get(
    "/results",
    response_model=ResultsAnalyticsOut,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("results"))],
)
def get_results_analytics(
    school_id: int,
    term: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)

    base_query = db.query(Result).filter_by(school_id=school_id)
    if term is not None:
        base_query = base_query.filter(Result.term == term)

    results = base_query.all()
    result_count = len(results)
    overall_average = round(sum(float(r.score) for r in results) / result_count, 2) if result_count else None

    subject_rows = (
        db.query(Subject.name, func.avg(Result.score), func.count(Result.id))
        .join(Result, Result.subject_id == Subject.id)
        .filter(Result.school_id == school_id, *([Result.term == term] if term else []))
        .group_by(Subject.name)
        .all()
    )
    subject_averages = [SubjectAverage(subject=name, average=round(float(avg), 2), count=count) for name, avg, count in subject_rows]

    class_rows = (
        db.query(SchoolClass.name, func.avg(Result.score), func.count(Result.id))
        .join(Student, Student.class_id == SchoolClass.id)
        .join(Result, Result.student_id == Student.id)
        .filter(Result.school_id == school_id, *([Result.term == term] if term else []))
        .group_by(SchoolClass.name)
        .all()
    )
    class_averages = [ClassAverage(class_name=name, average=round(float(avg), 2), count=count) for name, avg, count in class_rows]

    grade_rows = (
        db.query(Result.grade, func.count(Result.id))
        .filter(Result.school_id == school_id, Result.grade.isnot(None), *([Result.term == term] if term else []))
        .group_by(Result.grade)
        .all()
    )
    grade_distribution = [GradeCount(grade=grade, count=count) for grade, count in grade_rows]

    top_rows = (
        db.query(Student.first_name, Student.last_name, func.avg(Result.score).label("avg_score"))
        .join(Result, Result.student_id == Student.id)
        .filter(Result.school_id == school_id, *([Result.term == term] if term else []))
        .group_by(Student.id, Student.first_name, Student.last_name)
        .order_by(func.avg(Result.score).desc())
        .limit(10)
        .all()
    )
    top_students = [TopStudent(student_name=f"{first} {last}", average=round(float(avg), 2)) for first, last, avg in top_rows]

    trend_rows = (
        db.query(Result.term, func.avg(Result.score))
        .filter(Result.school_id == school_id)
        .group_by(Result.term)
        .all()
    )
    term_trend = [TermTrendPoint(term=t, average=round(float(avg), 2)) for t, avg in trend_rows]

    return ResultsAnalyticsOut(
        overall_average=overall_average,
        result_count=result_count,
        subject_averages=subject_averages,
        class_averages=class_averages,
        grade_distribution=grade_distribution,
        top_students=top_students,
        term_trend=term_trend,
    )
