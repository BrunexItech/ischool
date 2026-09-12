from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TeacherAssignment(Base):
    """Grants a teacher rights over a class: attendance for the class if
    subject_id is null, or grading for that specific subject if set. A
    school admin/super-admin bypasses this check entirely — it only
    constrains the TEACHER role."""

    __tablename__ = "teacher_assignments"
    __table_args__ = (
        UniqueConstraint("teacher_user_id", "class_id", "subject_id", name="uq_teacher_assignment"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    teacher_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    class_id: Mapped[int] = mapped_column(ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=False)
    subject_id: Mapped[int | None] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
    teacher: Mapped["User"] = relationship("User")
    school_class: Mapped["SchoolClass"] = relationship("SchoolClass")
    subject: Mapped["Subject | None"] = relationship("Subject")
