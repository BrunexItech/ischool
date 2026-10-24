from sqlalchemy.orm import Session

from app.models.academic_term import AcademicTerm
from app.models.academics import Student
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.competency_assessment import CompetencyAssessment
from app.models.grade_level import LevelGroup
from app.models.report_card_remark import ReportCardRemark
from app.models.results import Result
from app.schemas.competency_assessment import CompetencyAssessmentOut
from app.schemas.results import ReportCardOut, ReportCardRow


def _is_pre_primary(student: Student) -> bool:
    """A PP1/PP2 class — identified via the class's assigned national grade,
    never by name-matching. No class/grade means "not pre-primary" (treat
    as the conventional flow)."""
    return (
        student.school_class is not None
        and student.school_class.grade is not None
        and student.school_class.grade.level_group == LevelGroup.PRE_PRIMARY
    )


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


def _class_position(db: Session, student: Student, term: str) -> str | None:
    """Ranks every student in the same class by their term average, highest
    first — the classic '7 / 32' line on a printed report card.

    Never computed for PP1/PP2: the Kenya School Readiness Assessment Tool
    (Ministry of Education Assessors' Guide, April 2022, Scoring Guide
    p.2/p.xiv) states this assessment "shall not be used for ranking
    learners" — so pre-primary report cards omit a position entirely
    rather than ranking a 4-5 year-old."""
    if student.class_id is None or _is_pre_primary(student):
        return None

    classmates = db.query(Student.id).filter_by(school_id=student.school_id, class_id=student.class_id, is_active=True).all()
    classmate_ids = [c.id for c in classmates]
    if not classmate_ids:
        return None

    rows = db.query(Result.student_id, Result.score).filter(Result.term == term, Result.student_id.in_(classmate_ids)).all()
    totals: dict[int, list[float]] = {}
    for sid, score in rows:
        totals.setdefault(sid, []).append(float(score))
    if student.id not in totals:
        return None

    averages = sorted(((sid, sum(scores) / len(scores)) for sid, scores in totals.items()), key=lambda x: x[1], reverse=True)
    rank = next((i for i, (sid, _) in enumerate(averages, start=1) if sid == student.id), None)
    return f"{rank} / {len(averages)}" if rank else None


def _attendance_rate(db: Session, student: Student, term: str) -> float | None:
    """The student's own attendance rate across the term's date range, if
    the term has one set — nothing to compute against otherwise."""
    academic_term = db.query(AcademicTerm).filter_by(school_id=student.school_id, name=term).first()
    if academic_term is None or academic_term.start_date is None or academic_term.end_date is None:
        return None

    records = (
        db.query(AttendanceRecord.status)
        .filter(
            AttendanceRecord.school_id == student.school_id,
            AttendanceRecord.student_id == student.id,
            AttendanceRecord.date >= academic_term.start_date,
            AttendanceRecord.date <= academic_term.end_date,
        )
        .all()
    )
    if not records:
        return None
    present = sum(1 for (status,) in records if status != AttendanceStatus.ABSENT)
    return round(present / len(records) * 100, 1)


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

    remark = db.query(ReportCardRemark).filter_by(school_id=student.school_id, student_id=student.id, term=term).first()

    competency_assessments = []
    if _is_pre_primary(student):
        # A compiled summary of this term's observations — presented as our
        # own record, not formatted as or claimed to be the official KSRAT
        # form itself (that form's exact layout hasn't been reproduced here).
        competency_rows = (
            db.query(CompetencyAssessment)
            .filter_by(school_id=student.school_id, student_id=student.id, term=term)
            .order_by(CompetencyAssessment.subject_id, CompetencyAssessment.assessment_date)
            .all()
        )
        competency_assessments = [CompetencyAssessmentOut.model_validate(c) for c in competency_rows]

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
        class_position=_class_position(db, student, term),
        attendance_rate=_attendance_rate(db, student, term),
        class_teacher_remark=remark.class_teacher_remark if remark else None,
        principal_remark=remark.principal_remark if remark else None,
        competency_assessments=competency_assessments,
    )
