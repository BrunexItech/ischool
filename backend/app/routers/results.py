from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.core.notify import notify
from app.core.report_card import build_report_card
from app.core.teaching import ensure_can_grade
from app.models.academics import Student
from app.models.report_card_remark import ReportCardRemark
from app.models.results import Result, Subject
from app.models.user import User, UserRole
from app.schemas.results import ReportCardOut, ReportCardRemarkUpdate, ResultOut, ResultUpsert, SubjectCreate, SubjectOut

router = APIRouter(prefix="/schools/{school_id}", tags=["results"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.TEACHER, UserRole.STAFF)
MANAGE_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL)
RECORD_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.TEACHER)


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


# --- Subjects ---


@router.get(
    "/subjects",
    response_model=list[SubjectOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("results"))],
)
def list_subjects(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return db.query(Subject).filter_by(school_id=school_id).all()


@router.post(
    "/subjects",
    response_model=SubjectOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*MANAGE_ROLES)), Depends(require_feature("results"))],
)
def create_subject(
    school_id: int,
    payload: SubjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    if db.query(Subject).filter_by(school_id=school_id, name=payload.name).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That subject already exists")

    subject = Subject(school_id=school_id, name=payload.name)
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


# --- Results ---


@router.get(
    "/results",
    response_model=list[ResultOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("results"))],
)
def list_results(
    school_id: int,
    student_id: int | None = Query(default=None),
    subject_id: int | None = Query(default=None),
    term: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    query = db.query(Result).filter_by(school_id=school_id)
    if student_id is not None:
        query = query.filter_by(student_id=student_id)
    if subject_id is not None:
        query = query.filter_by(subject_id=subject_id)
    if term is not None:
        query = query.filter_by(term=term)
    return query.all()


@router.get(
    "/students/{student_id}/report-card",
    response_model=ReportCardOut,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("results"))],
)
def get_report_card(
    school_id: int,
    student_id: int,
    term: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    student = db.query(Student).filter_by(school_id=school_id, id=student_id).first()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
    return build_report_card(db, student, term)


@router.patch(
    "/students/{student_id}/report-card-remarks",
    response_model=ReportCardOut,
    dependencies=[Depends(require_roles(*RECORD_ROLES)), Depends(require_feature("results"))],
)
def update_report_card_remarks(
    school_id: int,
    student_id: int,
    term: str,
    payload: ReportCardRemarkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """A school_admin can set either comment; a teacher can only set the
    class-teacher comment, and only for a class they're the homeroom
    teacher of — the head teacher's word isn't a subject teacher's to give."""
    ensure_school_access(db, current_user, school_id)
    student = db.query(Student).filter_by(school_id=school_id, id=student_id).first()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")

    is_admin = current_user.role in (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL)
    if not is_admin:
        if payload.principal_remark is not None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only a school admin can set the principal's remark")
        is_homeroom_teacher = (
            student.school_class is not None and student.school_class.homeroom_teacher_id == current_user.id
        )
        if not is_homeroom_teacher:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only this class's homeroom teacher can add a remark")

    remark = db.query(ReportCardRemark).filter_by(school_id=school_id, student_id=student_id, term=term).first()
    if remark is None:
        remark = ReportCardRemark(school_id=school_id, student_id=student_id, term=term)
        db.add(remark)

    if payload.class_teacher_remark is not None:
        remark.class_teacher_remark = payload.class_teacher_remark
    if payload.principal_remark is not None:
        remark.principal_remark = payload.principal_remark

    db.commit()
    return build_report_card(db, student, term)


@router.post(
    "/results",
    response_model=ResultOut,
    dependencies=[Depends(require_roles(*RECORD_ROLES)), Depends(require_feature("results"))],
)
def upsert_result(
    school_id: int,
    payload: ResultUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upserts a student's score for a subject/term — re-submitting corrects it,
    matching how a teacher actually enters grades over time."""
    ensure_school_access(db, current_user, school_id)

    student = db.query(Student).filter_by(school_id=school_id, id=payload.student_id).first()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
    ensure_can_grade(db, current_user, student.class_id, payload.subject_id)

    result = (
        db.query(Result)
        .filter_by(school_id=school_id, student_id=payload.student_id, subject_id=payload.subject_id, term=payload.term)
        .first()
    )
    grade = payload.grade or _grade_for(payload.score)

    if result:
        before = {"score": float(result.score), "grade": result.grade, "remarks": result.remarks}
        result.score = payload.score
        result.grade = grade
        result.remarks = payload.remarks
        result.recorded_by = current_user.id
        action = "result.update"
    else:
        before = None
        result = Result(
            school_id=school_id,
            student_id=payload.student_id,
            subject_id=payload.subject_id,
            term=payload.term,
            score=payload.score,
            grade=grade,
            remarks=payload.remarks,
            recorded_by=current_user.id,
        )
        db.add(result)
        db.flush()
        action = "result.create"

    record_audit(
        db,
        school_id=school_id,
        actor_id=current_user.id,
        action=action,
        entity_type="result",
        entity_id=result.id,
        before=before,
        after={"score": payload.score, "grade": grade, "remarks": payload.remarks},
    )

    if student.guardian_user_id is not None:
        notify(
            db,
            school_id=school_id,
            user_id=student.guardian_user_id,
            title=f"New result for {student.first_name}",
            body=f"{student.first_name} {student.last_name} scored {payload.score} ({grade}) for {payload.term}.",
        )

    db.commit()
    db.refresh(result)
    return result
