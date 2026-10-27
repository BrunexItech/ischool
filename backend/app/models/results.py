from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Subject(Base):
    __tablename__ = "subjects"
    __table_args__ = (UniqueConstraint("school_id", "name", name="uq_subject_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    school: Mapped["School"] = relationship("School")
    levels: Mapped[list["SubjectLevel"]] = relationship("SubjectLevel", cascade="all, delete-orphan")

    @property
    def grade_level_ids(self) -> list[int]:
        return sorted(l.grade_level_id for l in self.levels)


class SubjectLevel(Base):
    """A grade a subject is taught in. A subject with no levels is treated
    as open to every class (how subjects worked before this existed)."""

    __tablename__ = "subject_levels"
    __table_args__ = (UniqueConstraint("subject_id", "grade_level_id", name="uq_subject_level"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    grade_level_id: Mapped[int] = mapped_column(ForeignKey("grade_levels.id", ondelete="CASCADE"), nullable=False)


class Result(Base):
    __tablename__ = "results"
    __table_args__ = (
        UniqueConstraint("student_id", "subject_id", "term", "exam_type", name="uq_result_student_subject_term_type"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)

    term: Mapped[str] = mapped_column(String(50), nullable=False)
    # Opener / CAT 1 / Mid Term / End Term ... Free text like Exam.exam_type;
    # "Not specified" for marks recorded before types existed.
    exam_type: Mapped[str] = mapped_column(String(50), nullable=False, default="Not specified", server_default="Not specified")
    score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    grade: Mapped[str | None] = mapped_column(String(5), nullable=True)
    remarks: Mapped[str | None] = mapped_column(String(500), nullable=True)

    recorded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
    student: Mapped["Student"] = relationship("Student")
    subject: Mapped["Subject"] = relationship("Subject")
