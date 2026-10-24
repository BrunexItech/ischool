import enum
from datetime import date as date_, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, Float, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class HomeworkSubmissionStatus(str, enum.Enum):
    NOT_SUBMITTED = "not_submitted"
    SUBMITTED = "submitted"
    REVIEWED = "reviewed"


class Homework(Base):
    """A teacher's homework posting for one class/subject — instructions
    and a due date, with digital submission optional per posting since most
    homework here is still done in an exercise book, not online."""

    __tablename__ = "homework"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    class_id: Mapped[int] = mapped_column(ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=False)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    # Same free-text-backed, fixed-choices-in-the-UI pattern as Exam.exam_type.
    homework_type: Mapped[str] = mapped_column(String(50), nullable=False, default="Other")
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    attachment_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    due_date: Mapped[date_] = mapped_column(Date, nullable=False)
    allow_digital_submission: Mapped[bool] = mapped_column(Boolean, default=True)

    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
    school_class: Mapped["SchoolClass"] = relationship("SchoolClass")
    subject: Mapped["Subject"] = relationship("Subject")
    submissions: Mapped[list["HomeworkSubmission"]] = relationship(
        "HomeworkSubmission", back_populates="homework", cascade="all, delete-orphan"
    )


class HomeworkSubmission(Base):
    """One student's status on one homework — created lazily (same pattern
    as attendance records) only once a student submits digitally or a
    teacher marks it, so a class roster change never needs backfilling."""

    __tablename__ = "homework_submissions"
    __table_args__ = (UniqueConstraint("homework_id", "student_id", name="uq_homework_submission_student"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    homework_id: Mapped[int] = mapped_column(ForeignKey("homework.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False)

    status: Mapped[HomeworkSubmissionStatus] = mapped_column(
        Enum(HomeworkSubmissionStatus), default=HomeworkSubmissionStatus.NOT_SUBMITTED
    )
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    teacher_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    homework: Mapped["Homework"] = relationship("Homework", back_populates="submissions")
    student: Mapped["Student"] = relationship("Student")
