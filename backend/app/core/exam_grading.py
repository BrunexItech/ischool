from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.exam import Exam, ExamAnswer, ExamQuestionType, ExamSubmission, ExamSubmissionStatus
from app.schemas.exam import ExamAnswerSubmit


def upsert_answer(db: Session, submission: ExamSubmission, question_id: int, answer_text: str) -> None:
    """Saves one answer without finalizing the submission — called on every
    change while the student is still sitting the exam, so progress survives
    a closed tab or a dead connection."""
    existing = db.query(ExamAnswer).filter_by(submission_id=submission.id, question_id=question_id).first()
    if existing is not None:
        existing.answer_text = answer_text
    else:
        db.add(ExamAnswer(submission_id=submission.id, question_id=question_id, answer_text=answer_text))


def finalize_submission(db: Session, exam: Exam, submission: ExamSubmission, answers: list[ExamAnswerSubmit] | None = None) -> None:
    """Grades every MCQ answer and moves the submission out of IN_PROGRESS —
    used both by the student's own "Submit" action and by the background
    sweep that closes out sessions whose time has run out, so a closed tab
    never leaves a submission stuck in progress forever."""
    questions_by_id = {q.id: q for q in exam.questions}

    if answers:
        for answer_payload in answers:
            if answer_payload.question_id in questions_by_id:
                upsert_answer(db, submission, answer_payload.question_id, answer_payload.answer_text)
        db.flush()

    # A short-answer question the student never touched still needs a row —
    # otherwise it's indistinguishable from "there was nothing to grade" and
    # the submission would be marked fully graded despite a blank answer
    # nobody has actually reviewed. Query fresh rather than the (possibly
    # already-cached) submission.answers relationship, since we're adding
    # more rows below and need every subsequent read to see them.
    existing_answers = db.query(ExamAnswer).filter_by(submission_id=submission.id).all()
    answered_question_ids = {a.question_id for a in existing_answers}
    for question in exam.questions:
        if question.question_type == ExamQuestionType.SHORT_ANSWER and question.id not in answered_question_ids:
            db.add(ExamAnswer(submission_id=submission.id, question_id=question.id, answer_text=None, awarded_marks=None))
    db.flush()

    all_answers = db.query(ExamAnswer).filter_by(submission_id=submission.id).all()
    has_short_answer = False
    for answer in all_answers:
        question = questions_by_id.get(answer.question_id)
        if question is None:
            continue
        if question.question_type == ExamQuestionType.MCQ:
            try:
                selected = int(answer.answer_text) if answer.answer_text is not None else None
            except ValueError:
                selected = None
            answer.awarded_marks = float(question.marks) if selected == question.correct_option_index else 0.0
        else:
            has_short_answer = True

    submission.status = ExamSubmissionStatus.SUBMITTED if has_short_answer else ExamSubmissionStatus.GRADED
    submission.submitted_at = datetime.now(timezone.utc)
