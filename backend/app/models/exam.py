import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ExamQuestionType(str, enum.Enum):
    MCQ = "mcq"
    SHORT_ANSWER = "short_answer"


class ExamSubmissionStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    GRADED = "graded"


class Exam(Base):
    """A set exam — printable as-is for a paper sitting, or published so
    students sit it online through the portal within a time limit."""

    __tablename__ = "exams"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("school_classes.id", ondelete="SET NULL"), nullable=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    term: Mapped[str] = mapped_column(String(50), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)  # open for students to sit online

    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
    subject: Mapped["Subject"] = relationship("Subject")
    school_class: Mapped["SchoolClass | None"] = relationship("SchoolClass")
    questions: Mapped[list["ExamQuestion"]] = relationship(
        "ExamQuestion", back_populates="exam", cascade="all, delete-orphan", order_by="ExamQuestion.order"
    )

    @property
    def total_marks(self) -> float:
        return sum(float(q.marks) for q in self.questions)

    @property
    def question_count(self) -> int:
        return len(self.questions)


class ExamQuestion(Base):
    __tablename__ = "exam_questions"

    id: Mapped[int] = mapped_column(primary_key=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)

    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_type: Mapped[ExamQuestionType] = mapped_column(Enum(ExamQuestionType), nullable=False)
    marks: Mapped[float] = mapped_column(Numeric(6, 2), nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False)

    options: Mapped[list | None] = mapped_column(JSON, nullable=True)  # MCQ only: list[str]
    correct_option_index: Mapped[int | None] = mapped_column(Integer, nullable=True)  # MCQ only

    exam: Mapped["Exam"] = relationship("Exam", back_populates="questions")


class ExamSubmission(Base):
    __tablename__ = "exam_submissions"
    __table_args__ = (UniqueConstraint("exam_id", "student_id", name="uq_exam_submission_student"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    exam_id: Mapped[int] = mapped_column(ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False)

    status: Mapped[ExamSubmissionStatus] = mapped_column(Enum(ExamSubmissionStatus), default=ExamSubmissionStatus.IN_PROGRESS)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    exam: Mapped["Exam"] = relationship("Exam")
    student: Mapped["Student"] = relationship("Student")
    answers: Mapped[list["ExamAnswer"]] = relationship(
        "ExamAnswer", back_populates="submission", cascade="all, delete-orphan"
    )

    @property
    def score(self) -> float | None:
        if self.status == ExamSubmissionStatus.IN_PROGRESS:
            return None
        if any(a.awarded_marks is None for a in self.answers):
            return None
        return sum(float(a.awarded_marks) for a in self.answers)


class ExamAnswer(Base):
    __tablename__ = "exam_answers"
    __table_args__ = (UniqueConstraint("submission_id", "question_id", name="uq_exam_answer_question"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    submission_id: Mapped[int] = mapped_column(ForeignKey("exam_submissions.id", ondelete="CASCADE"), nullable=False)
    question_id: Mapped[int] = mapped_column(ForeignKey("exam_questions.id", ondelete="CASCADE"), nullable=False)

    answer_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    awarded_marks: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)

    submission: Mapped["ExamSubmission"] = relationship("ExamSubmission", back_populates="answers")
    question: Mapped["ExamQuestion"] = relationship("ExamQuestion")
