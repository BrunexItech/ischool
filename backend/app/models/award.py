from datetime import date as date_, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Award(Base):
    """Recognition for one learner, a whole class, the whole school, or a
    staff member. `scope` says which, and the DB check below guarantees the
    recipient columns agree with it."""

    __tablename__ = "awards"
    __table_args__ = (
        CheckConstraint(
            "(scope = 'student' AND student_id IS NOT NULL AND staff_user_id IS NULL AND class_id IS NULL)"
            " OR (scope = 'staff' AND staff_user_id IS NOT NULL AND student_id IS NULL AND class_id IS NULL)"
            " OR (scope = 'class' AND class_id IS NOT NULL AND student_id IS NULL AND staff_user_id IS NULL)"
            " OR (scope = 'school' AND student_id IS NULL AND staff_user_id IS NULL AND class_id IS NULL)",
            name="ck_award_recipient_scope",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)

    scope: Mapped[str] = mapped_column(String(10), nullable=False, default="student", server_default="student")
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=True)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=True)
    subject_id: Mapped[int | None] = mapped_column(ForeignKey("subjects.id", ondelete="SET NULL"), nullable=True)
    activity_id: Mapped[int | None] = mapped_column(ForeignKey("activities.id", ondelete="SET NULL"), nullable=True)
    staff_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    date_awarded: Mapped[date_] = mapped_column(Date, nullable=False)
    term: Mapped[str | None] = mapped_column(String(50), nullable=True)

    awarded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
    student: Mapped["Student | None"] = relationship("Student", foreign_keys=[student_id])
    staff: Mapped["User | None"] = relationship("User", foreign_keys=[staff_user_id])
    school_class: Mapped["SchoolClass | None"] = relationship("SchoolClass", foreign_keys=[class_id])
    subject: Mapped["Subject | None"] = relationship("Subject", foreign_keys=[subject_id])
    giver: Mapped["User | None"] = relationship("User", foreign_keys=[awarded_by])

    @property
    def recipient_name(self) -> str:
        if self.scope == "school":
            return "Whole school"
        if self.scope == "class" and self.school_class is not None:
            return f"{self.school_class.name} (whole class)"
        if self.student is not None:
            return f"{self.student.first_name} {self.student.last_name}"
        if self.staff is not None:
            return self.staff.full_name
        return "Unknown"

    @property
    def class_name(self) -> str | None:
        if self.school_class is not None:
            return self.school_class.name
        if self.student is not None and self.student.school_class is not None:
            return self.student.school_class.name
        return None

    @property
    def subject_name(self) -> str | None:
        return self.subject.name if self.subject is not None else None

    @property
    def awarded_by_name(self) -> str | None:
        return self.giver.full_name if self.giver is not None else None
