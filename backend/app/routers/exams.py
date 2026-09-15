from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.exam import Exam, ExamAnswer, ExamQuestion, ExamQuestionType, ExamSubmission, ExamSubmissionStatus
from app.models.results import Subject
from app.models.user import User, UserRole
from app.schemas.exam import (
    ExamAnswerOut,
    ExamCreate,
    ExamDetailOut,
    ExamOut,
    ExamQuestionOut,
    ExamSubmissionDetailOut,
    ExamSubmissionOut,
    GradeAnswerRequest,
)

router = APIRouter(prefix="/schools/{school_id}/exams", tags=["exams"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER, UserRole.STAFF)
ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)


def _detail_out(exam: Exam) -> ExamDetailOut:
    return ExamDetailOut(
        **ExamOut.model_validate(exam).model_dump(),
        questions=[ExamQuestionOut.model_validate(q) for q in exam.questions],
    )


@router.get("", response_model=list[ExamOut], dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("exams"))])
def list_exams(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(current_user, school_id)
    return db.query(Exam).filter_by(school_id=school_id).order_by(Exam.created_at.desc()).all()


@router.post(
    "",
    response_model=ExamDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("exams"))],
)
def create_exam(school_id: int, payload: ExamCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(current_user, school_id)

    subject = db.query(Subject).filter_by(school_id=school_id, id=payload.subject_id).first()
    if subject is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That subject does not belong to this school")

    exam = Exam(
        school_id=school_id,
        subject_id=payload.subject_id,
        class_id=payload.class_id,
        title=payload.title,
        term=payload.term,
        duration_minutes=payload.duration_minutes,
        created_by=current_user.id,
    )
    db.add(exam)
    db.flush()

    for q in payload.questions:
        db.add(
            ExamQuestion(
                exam_id=exam.id,
                question_text=q.question_text,
                question_type=q.question_type,
                marks=q.marks,
                order=q.order,
                options=q.options,
                correct_option_index=q.correct_option_index,
            )
        )

    db.commit()
    db.refresh(exam)
    return _detail_out(exam)


@router.get(
    "/{exam_id}",
    response_model=ExamDetailOut,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("exams"))],
)
def get_exam(school_id: int, exam_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(current_user, school_id)
    exam = db.query(Exam).filter_by(school_id=school_id, id=exam_id).first()
    if exam is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exam not found")
    return _detail_out(exam)


@router.patch(
    "/{exam_id}/publish",
    response_model=ExamOut,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("exams"))],
)
def set_exam_published(
    school_id: int, exam_id: int, published: bool, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(current_user, school_id)
    exam = db.query(Exam).filter_by(school_id=school_id, id=exam_id).first()
    if exam is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exam not found")

    exam.is_published = published
    db.commit()
    db.refresh(exam)
    return exam


@router.delete(
    "/{exam_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("exams"))],
)
def delete_exam(school_id: int, exam_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(current_user, school_id)
    exam = db.query(Exam).filter_by(school_id=school_id, id=exam_id).first()
    if exam is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exam not found")

    db.delete(exam)
    db.commit()


@router.get(
    "/{exam_id}/submissions",
    response_model=list[ExamSubmissionDetailOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("exams"))],
)
def list_submissions(school_id: int, exam_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(current_user, school_id)
    exam = db.query(Exam).filter_by(school_id=school_id, id=exam_id).first()
    if exam is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Exam not found")

    submissions = db.query(ExamSubmission).filter_by(exam_id=exam_id).all()
    return [
        ExamSubmissionDetailOut(
            **ExamSubmissionOut.model_validate(s).model_dump(),
            answers=[ExamAnswerOut.model_validate(a) for a in s.answers],
            student_name=f"{s.student.first_name} {s.student.last_name}",
        )
        for s in submissions
    ]


@router.patch(
    "/{exam_id}/submissions/{submission_id}/answers/{answer_id}/grade",
    response_model=ExamSubmissionDetailOut,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("exams"))],
)
def grade_answer(
    school_id: int,
    exam_id: int,
    submission_id: int,
    answer_id: int,
    payload: GradeAnswerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)
    submission = (
        db.query(ExamSubmission)
        .join(Exam, ExamSubmission.exam_id == Exam.id)
        .filter(Exam.school_id == school_id, ExamSubmission.exam_id == exam_id, ExamSubmission.id == submission_id)
        .first()
    )
    if submission is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Submission not found")

    answer = db.query(ExamAnswer).filter_by(id=answer_id, submission_id=submission_id).first()
    if answer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Answer not found")
    if answer.question.marks < payload.awarded_marks:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Cannot award more than the question's {answer.question.marks} marks")

    answer.awarded_marks = payload.awarded_marks
    db.flush()

    if all(a.awarded_marks is not None for a in submission.answers):
        submission.status = ExamSubmissionStatus.GRADED

    db.commit()
    db.refresh(submission)
    return ExamSubmissionDetailOut(
        **ExamSubmissionOut.model_validate(submission).model_dump(),
        answers=[ExamAnswerOut.model_validate(a) for a in submission.answers],
        student_name=f"{submission.student.first_name} {submission.student.last_name}",
    )
