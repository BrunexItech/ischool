import enum
from datetime import date as date_, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ConductCategory(str, enum.Enum):
    DISRUPTION = "disruption"
    DISRESPECT = "disrespect"
    BULLYING = "bullying"
    FIGHTING = "fighting"
    DISHONESTY = "dishonesty"
    PROPERTY_DAMAGE = "property_damage"
    DRESS_CODE = "dress_code"
    OTHER = "other"


class ConductStatus(str, enum.Enum):
    OPEN = "open"
    REVIEWED = "reviewed"


class ConductReport(Base):
    """A teacher's record of a student's misconduct — visible to school
    leadership, the student, and their guardian, same as a real incident
    slip sent home. Not a disciplinary ruling by itself; `action_taken` and
    a leadership `response` capture whatever follow-up actually happened."""

    __tablename__ = "conduct_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("school_classes.id", ondelete="SET NULL"), nullable=True)

    reported_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reported_by_name: Mapped[str] = mapped_column(String(255), nullable=False)

    category: Mapped[ConductCategory] = mapped_column(Enum(ConductCategory), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    action_taken: Mapped[str | None] = mapped_column(Text, nullable=True)
    incident_date: Mapped[date_] = mapped_column(Date, nullable=False)

    status: Mapped[ConductStatus] = mapped_column(Enum(ConductStatus), default=ConductStatus.OPEN, nullable=False)
    response: Mapped[str | None] = mapped_column(Text, nullable=True)
    responded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
    student: Mapped["Student"] = relationship("Student", foreign_keys=[student_id])
    school_class: Mapped["SchoolClass | None"] = relationship("SchoolClass")
