from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ReportCardRemark(Base):
    """A term's narrative comments for one student's report card — separate
    from Result (which is per-subject) since these are set once per student
    per term, by different people: the class teacher writes their own, a
    school_admin stands in for the head teacher's."""

    __tablename__ = "report_card_remarks"
    __table_args__ = (UniqueConstraint("student_id", "term", name="uq_report_card_remark_student_term"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    term: Mapped[str] = mapped_column(String(50), nullable=False)

    class_teacher_remark: Mapped[str | None] = mapped_column(String(500), nullable=True)
    principal_remark: Mapped[str | None] = mapped_column(String(500), nullable=True)

    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    school: Mapped["School"] = relationship("School")
    student: Mapped["Student"] = relationship("Student")
