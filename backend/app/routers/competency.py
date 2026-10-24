from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.core.teaching import ensure_can_grade, ensure_has_any_assignment
from app.models.academics import SchoolClass, Student
from app.models.competency_assessment import CompetencyAssessment
from app.models.observation_note import ObservationNote
from app.models.user import User, UserRole
from app.schemas.competency_assessment import CompetencyAssessmentCreate, CompetencyAssessmentOut
from app.schemas.observation_note import ObservationNoteCreate, ObservationNoteOut

router = APIRouter(prefix="/schools/{school_id}", tags=["competency"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.TEACHER, UserRole.STAFF)
RECORD_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.TEACHER)


def _student_in_class(db: Session, school_id: int, student_id: int, class_id: int) -> Student:
    student = db.query(Student).filter_by(id=student_id, school_id=school_id, class_id=class_id).first()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found in that class")
    return student


# --- Competency assessments ---


@router.post(
    "/competency-assessments",
    response_model=CompetencyAssessmentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*RECORD_ROLES)), Depends(require_feature("results"))],
)
def create_competency_assessment(
    school_id: int,
    payload: CompetencyAssessmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    ensure_can_grade(db, current_user, payload.class_id, payload.subject_id)
    _student_in_class(db, school_id, payload.student_id, payload.class_id)

    record = CompetencyAssessment(school_id=school_id, teacher_user_id=current_user.id, **payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get(
    "/competency-assessments",
    response_model=list[CompetencyAssessmentOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("results"))],
)
def list_competency_assessments(
    school_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full chronological history for one learner — nothing is ever
    overwritten, so this is the student's whole competency record."""
    ensure_school_access(db, current_user, school_id)
    student = db.query(Student).filter_by(id=student_id, school_id=school_id).first()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
    if current_user.role == UserRole.TEACHER and student.class_id is not None:
        ensure_has_any_assignment(db, current_user, student.class_id)

    return (
        db.query(CompetencyAssessment)
        .filter_by(school_id=school_id, student_id=student_id)
        .order_by(CompetencyAssessment.assessment_date.desc(), CompetencyAssessment.id.desc())
        .all()
    )


# --- Observation notes ---


@router.post(
    "/observation-notes",
    response_model=ObservationNoteOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*RECORD_ROLES)), Depends(require_feature("results"))],
)
def create_observation_note(
    school_id: int,
    payload: ObservationNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    ensure_has_any_assignment(db, current_user, payload.class_id)
    _student_in_class(db, school_id, payload.student_id, payload.class_id)

    note = ObservationNote(school_id=school_id, teacher_user_id=current_user.id, **payload.model_dump())
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.get(
    "/observation-notes",
    response_model=list[ObservationNoteOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("results"))],
)
def list_observation_notes(
    school_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    student = db.query(Student).filter_by(id=student_id, school_id=school_id).first()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
    if current_user.role == UserRole.TEACHER and student.class_id is not None:
        ensure_has_any_assignment(db, current_user, student.class_id)

    return (
        db.query(ObservationNote)
        .filter_by(school_id=school_id, student_id=student_id)
        .order_by(ObservationNote.noted_on.desc(), ObservationNote.id.desc())
        .all()
    )
