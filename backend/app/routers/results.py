from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.results import Result, Subject
from app.models.user import User, UserRole
from app.schemas.results import ResultOut, ResultUpsert, SubjectCreate, SubjectOut

router = APIRouter(prefix="/schools/{school_id}", tags=["results"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER, UserRole.STAFF)
MANAGE_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
RECORD_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER)


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
    ensure_school_access(current_user, school_id)
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
    ensure_school_access(current_user, school_id)
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
    ensure_school_access(current_user, school_id)
    query = db.query(Result).filter_by(school_id=school_id)
    if student_id is not None:
        query = query.filter_by(student_id=student_id)
    if subject_id is not None:
        query = query.filter_by(subject_id=subject_id)
    if term is not None:
        query = query.filter_by(term=term)
    return query.all()


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
    ensure_school_access(current_user, school_id)

    result = (
        db.query(Result)
        .filter_by(school_id=school_id, student_id=payload.student_id, subject_id=payload.subject_id, term=payload.term)
        .first()
    )
    grade = payload.grade or _grade_for(payload.score)

    if result:
        result.score = payload.score
        result.grade = grade
        result.remarks = payload.remarks
        result.recorded_by = current_user.id
    else:
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

    db.commit()
    db.refresh(result)
    return result
