from sqlalchemy.orm import Session

from app.models.academics import Student
from app.models.results import Result
from app.schemas.results import ReportCardOut, ReportCardRow


def _grade_for(score: float) -> str:
    if score >= 80:
        return "A"
    if score >= 70:
        return "B"
    if score >= 60:
        return "C"
    if score >= 50:
        return "D"
    return "E"


def build_report_card(db: Session, student: Student, term: str) -> ReportCardOut:
    results = (
        db.query(Result)
        .filter_by(school_id=student.school_id, student_id=student.id, term=term)
        .join(Result.subject)
        .all()
    )
    rows = [
        ReportCardRow(subject_name=r.subject.name, score=float(r.score), grade=r.grade, remarks=r.remarks)
        for r in results
    ]
    average = round(sum(r.score for r in rows) / len(rows), 2) if rows else None

    return ReportCardOut(
        school_name=student.school.name,
        school_logo_url=student.school.logo_url,
        school_primary_color=student.school.primary_color,
        student_name=f"{student.first_name} {student.last_name}",
        admission_number=student.admission_number,
        class_name=student.school_class.name if student.school_class else None,
        term=term,
        rows=rows,
        average=average,
        overall_grade=_grade_for(average) if average is not None else None,
    )
