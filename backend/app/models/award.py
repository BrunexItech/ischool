from datetime import date as date_, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Award(Base):
    """Recognition given to a student or a staff member (teacher/staff) —
    exactly one of student_id/staff_user_id is set, enforced at the DB level."""

    __tablename__ = "awards"
    __table_args__ = (
        CheckConstraint(
            "(student_id IS NOT NULL) != (staff_user_id IS NOT NULL)", name="ck_award_exactly_one_recipient"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)

    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=True)
    staff_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    date_awarded: Mapped[date_] = mapped_column(Date, nullable=False)

    awarded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
    student: Mapped["Student | None"] = relationship("Student", foreign_keys=[student_id])
    staff: Mapped["User | None"] = relationship("User", foreign_keys=[staff_user_id])

    @property
    def recipient_name(self) -> str:
        if self.student is not None:
            return f"{self.student.first_name} {self.student.last_name}"
        if self.staff is not None:
            return self.staff.full_name
        return "Unknown"
