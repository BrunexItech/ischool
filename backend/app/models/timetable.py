from datetime import datetime, time

from sqlalchemy import DateTime, ForeignKey, Integer, String, Time, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TimetableSlot(Base):
    """One period on a class's weekly timetable — a subject taught by a
    teacher at a day/time. Collision rules (enforced in the router, not the
    DB) keep a class from double-booking a period and a teacher from being
    in two places at once."""

    __tablename__ = "timetable_slots"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    class_id: Mapped[int] = mapped_column(ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=False)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    teacher_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # 0 = Monday ... 6 = Sunday (ISO weekday - 1), matching Python's date.weekday()
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    room: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # The block of the school day this lesson sits in. Null on lessons placed
    # before the school defined its day.
    period_id: Mapped[int | None] = mapped_column(ForeignKey("school_periods.id", ondelete="SET NULL"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
    school_class: Mapped["SchoolClass"] = relationship("SchoolClass")
    subject: Mapped["Subject"] = relationship("Subject")
    teacher: Mapped["User | None"] = relationship("User")
