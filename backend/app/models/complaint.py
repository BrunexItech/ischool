import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ComplaintAudience(str, enum.Enum):
    CLASS_TEACHER = "class_teacher"
    PRINCIPAL = "principal"


class ComplaintStatus(str, enum.Enum):
    OPEN = "open"
    RESOLVED = "resolved"


class Complaint(Base):
    """A complaint or concern raised by a student, parent, or teacher —
    addressed either to the relevant class's homeroom teacher or straight
    to the principal/admin."""

    __tablename__ = "complaints"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)

    raised_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    raised_by_name: Mapped[str] = mapped_column(String(255), nullable=False)
    raised_by_role: Mapped[str] = mapped_column(String(30), nullable=False)

    audience: Mapped[ComplaintAudience] = mapped_column(Enum(ComplaintAudience), nullable=False)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("school_classes.id", ondelete="SET NULL"), nullable=True)

    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[ComplaintStatus] = mapped_column(Enum(ComplaintStatus), default=ComplaintStatus.OPEN, nullable=False)

    response: Mapped[str | None] = mapped_column(Text, nullable=True)
    responded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
    school_class: Mapped["SchoolClass | None"] = relationship("SchoolClass")
