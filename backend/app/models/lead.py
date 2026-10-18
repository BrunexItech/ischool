import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class LeadStage(str, enum.Enum):
    ENQUIRY = "enquiry"
    VISIT_BOOKED = "visit_booked"
    APPLIED = "applied"
    OFFER_SENT = "offer_sent"
    ENROLLED = "enrolled"
    LOST = "lost"


class Lead(Base):
    """A prospective student enquiry, tracked through the admissions pipeline
    from first contact to enrolment (or lost)."""

    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)

    child_name: Mapped[str] = mapped_column(String(255), nullable=False)
    grade_interested: Mapped[str | None] = mapped_column(String(50), nullable=True)
    guardian_name: Mapped[str] = mapped_column(String(255), nullable=False)
    guardian_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    guardian_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    stage: Mapped[LeadStage] = mapped_column(Enum(LeadStage), default=LeadStage.ENQUIRY, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Set once a lead converts, linking it to the resulting student record.
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="SET NULL"), nullable=True)

    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    school: Mapped["School"] = relationship("School")
    student: Mapped["Student | None"] = relationship("Student")
