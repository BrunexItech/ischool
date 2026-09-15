import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PickupDropoffType(str, enum.Enum):
    PICKUP = "pickup"
    DROPOFF = "dropoff"


class PickupDropoffLog(Base):
    """A real, timestamped record of when a student was picked up from or
    dropped off at school, and by whom — visible to parents for full
    transparency. Kept for a year by default (see scripts/purge_old_pickup_logs.py);
    a school can delete a record any time before that."""

    __tablename__ = "pickup_dropoff_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False)

    event_type: Mapped[PickupDropoffType] = mapped_column(Enum(PickupDropoffType), nullable=False)
    person_name: Mapped[str] = mapped_column(String(255), nullable=False)  # who physically did the pickup/dropoff
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    recorded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
    student: Mapped["Student"] = relationship("Student")
