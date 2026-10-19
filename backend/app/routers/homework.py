from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.core.teaching import ensure_can_grade
from app.models.academics import SchoolClass, Student
from app.models.homework import Homework, HomeworkSubmission, HomeworkSubmissionStatus
from app.models.user import User, UserRole
from app.schemas.homework import (
    HomeworkCreate,
    HomeworkDetailOut,
    HomeworkListItemOut,
    HomeworkOut,
    HomeworkReviewUpdate,
    HomeworkSubmissionOut,
)

router = APIRouter(prefix="/schools/{school_id}/homework", tags=["homework"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SUPERVISOR, UserRole.TEACHER, UserRole.STAFF)
ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SUPERVISOR)


def _get_homework(db: Session, school_id: int, homework_id: int) -> Homework:
    hw = db.query(Homework).filter_by(school_id=school_id, id=homework_id).first()
    if hw is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Homework not found")
    return hw


def _creator_name(db: Session, homework: Homework) -> str | None:
    if homework.created_by is None:
        return None
    creator = db.get(User, homework.created_by)
    return creator.full_name if creator else None


def _list_item_out(db: Session, hw: Homework) -> HomeworkListItemOut:
    total_students = db.query(Student).filter_by(school_id=hw.school_id, class_id=hw.class_id, is_active=True).count()
    submissions = db.query(HomeworkSubmission).filter_by(homework_id=hw.id).all()
    submitted_count = sum(1 for s in submissions if s.status in (HomeworkSubmissionStatus.SUBMITTED, HomeworkSubmissionStatus.REVIEWED))
    reviewed_count = sum(1 for s in submissions if s.status == HomeworkSubmissionStatus.REVIEWED)
    return HomeworkListItemOut(
        **HomeworkOut.model_validate(hw).model_dump(),
        created_by_name=_creator_name(db, hw),
        total_students=total_students,
        submitted_count=submitted_count,
        reviewed_count=reviewed_count,
    )


@router.get(
    "",
    response_model=list[HomeworkListItemOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("homework"))],
)
def list_homework(
    school_id: int,
    class_id: int | None = None,
    subject_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    query = db.query(Homework).filter_by(school_id=school_id)
    if class_id is not None:
        query = query.filter_by(class_id=class_id)
    if subject_id is not None:
        query = query.filter_by(subject_id=subject_id)
    items = query.order_by(Homework.due_date.desc()).all()
    return [_list_item_out(db, hw) for hw in items]


@router.post(
    "",
    response_model=HomeworkListItemOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("homework"))],
)
def create_homework(
    school_id: int, payload: HomeworkCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    ensure_can_grade(db, current_user, payload.class_id, payload.subject_id)

    school_class = db.query(SchoolClass).filter_by(school_id=school_id, id=payload.class_id).first()
    if school_class is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That class does not belong to this school")

    hw = Homework(school_id=school_id, created_by=current_user.id, **payload.model_dump())
    db.add(hw)
    db.commit()
    db.refresh(hw)
    return _list_item_out(db, hw)


@router.get(
    "/{homework_id}",
    response_model=HomeworkDetailOut,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("homework"))],
)
def get_homework(school_id: int, homework_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The full roster for this homework — every active student in the
    class, synthesized with their submission (or "not submitted" if they
    don't have a row yet, which is the normal case until someone acts)."""
    ensure_school_access(db, current_user, school_id)
    hw = _get_homework(db, school_id, homework_id)

    students = db.query(Student).filter_by(school_id=school_id, class_id=hw.class_id, is_active=True).order_by(Student.first_name).all()
    by_student = {s.student_id: s for s in db.query(HomeworkSubmission).filter_by(homework_id=hw.id).all()}

    submissions = []
    for student in students:
        existing = by_student.get(student.id)
        submissions.append(
            HomeworkSubmissionOut(
                student_id=student.id,
                student_name=f"{student.first_name} {student.last_name}",
                status=existing.status if existing else HomeworkSubmissionStatus.NOT_SUBMITTED,
                file_url=existing.file_url if existing else None,
                submitted_at=existing.submitted_at if existing else None,
                score=existing.score if existing else None,
                teacher_comment=existing.teacher_comment if existing else None,
                reviewed_at=existing.reviewed_at if existing else None,
            )
        )

    list_item = _list_item_out(db, hw)
    return HomeworkDetailOut(**list_item.model_dump(), submissions=submissions)


@router.patch(
    "/{homework_id}/submissions/{student_id}",
    response_model=HomeworkSubmissionOut,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("homework"))],
)
def review_submission(
    school_id: int,
    homework_id: int,
    student_id: int,
    payload: HomeworkReviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The teacher's side of marking — whether the student submitted
    digitally or the teacher just checked their exercise book, this is
    where it gets recorded: a status, an optional score, an optional
    comment."""
    ensure_school_access(db, current_user, school_id)
    hw = _get_homework(db, school_id, homework_id)
    ensure_can_grade(db, current_user, hw.class_id, hw.subject_id)

    student = db.query(Student).filter_by(school_id=school_id, id=student_id, class_id=hw.class_id).first()
    if student is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That student is not in this homework's class")

    submission = db.query(HomeworkSubmission).filter_by(homework_id=hw.id, student_id=student_id).first()
    if submission is None:
        submission = HomeworkSubmission(homework_id=hw.id, student_id=student_id)
        db.add(submission)

    submission.status = payload.status
    submission.score = payload.score
    submission.teacher_comment = payload.teacher_comment
    submission.reviewed_by = current_user.id
    submission.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(submission)

    return HomeworkSubmissionOut(
        student_id=student.id,
        student_name=f"{student.first_name} {student.last_name}",
        status=submission.status,
        file_url=submission.file_url,
        submitted_at=submission.submitted_at,
        score=submission.score,
        teacher_comment=submission.teacher_comment,
        reviewed_at=submission.reviewed_at,
    )


@router.delete(
    "/{homework_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("homework"))],
)
def delete_homework(school_id: int, homework_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    hw = _get_homework(db, school_id, homework_id)
    db.delete(hw)
    db.commit()
