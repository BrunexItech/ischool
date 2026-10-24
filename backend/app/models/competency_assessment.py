import enum
from datetime import date as date_, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PerformanceLevel(str, enum.Enum):
    """The four official levels — Kenya School Readiness Assessment Tool,
    Ministry of Education Assessors' Guide (April 2022), Scoring Guide
    p.xv. Verified wording; explicitly not a ranking scale — see the
    guide's own note (p.2/p.xiv) that this assessment "shall not be used
    for ranking learners"."""

    EXCEEDING_EXPECTATION = "exceeding_expectation"
    MEETING_EXPECTATION = "meeting_expectation"
    APPROACHING_EXPECTATION = "approaching_expectation"
    BELOW_EXPECTATION = "below_expectation"


class CompetencyAssessment(Base):
    """A single dated observation of a learner against one competency
    criterion within a learning area/strand/sub-strand — the PP1/PP2
    alternative to a numeric Result. Strand, sub-strand, and criterion
    text are teacher-entered (per the school's own curriculum design
    document), not hardcoded: only the four performance levels above are
    fixed, verified official content. Historical — never overwritten, a
    new row per observation, so progress over time is just the row
    history for a student/subject."""

    __tablename__ = "competency_assessments"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    class_id: Mapped[int] = mapped_column(ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=False)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    teacher_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    term: Mapped[str] = mapped_column(String(50), nullable=False)
    strand: Mapped[str] = mapped_column(String(255), nullable=False)
    sub_strand: Mapped[str | None] = mapped_column(String(255), nullable=True)
    criterion: Mapped[str] = mapped_column(Text, nullable=False)
    performance_level: Mapped[PerformanceLevel] = mapped_column(Enum(PerformanceLevel), nullable=False)

    assessment_date: Mapped[date_] = mapped_column(Date, nullable=False)
    teacher_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    follow_up_action: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    student: Mapped["Student"] = relationship("Student")
    school_class: Mapped["SchoolClass"] = relationship("SchoolClass")
    subject: Mapped["Subject"] = relationship("Subject")
    teacher: Mapped["User | None"] = relationship("User")
