from datetime import date, datetime, time

from sqlalchemy import Date, DateTime, ForeignKey, String, Text, Time, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

DELIVERY_STATUSES = ("taught", "partly", "not_taught")
NOT_TAUGHT_REASONS = ("teacher_absent", "public_holiday", "exams", "school_event", "other")


class LessonDelivery(Base):
    """What actually happened in one timetabled lesson on one date — the
    Record of Work Covered. The weekly timetable has no dates, so this is the
    dated fact: taught, partly taught, or not taught (with a reason).

    The topic is copied in at the time so the record stays true even if the
    plan entry is edited or deleted later."""

    __tablename__ = "lesson_deliveries"
    __table_args__ = (
        UniqueConstraint("teacher_user_id", "timetable_slot_id", "lesson_date", name="uq_lesson_delivery_slot_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    teacher_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    class_id: Mapped[int] = mapped_column(ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=False)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    timetable_slot_id: Mapped[int | None] = mapped_column(ForeignKey("timetable_slots.id", ondelete="SET NULL"), nullable=True)
    entry_id: Mapped[int | None] = mapped_column(ForeignKey("lesson_plan_entries.id", ondelete="SET NULL"), nullable=True)

    lesson_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    status: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(30), nullable=True)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
    topic: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    teacher: Mapped["User"] = relationship("User")
    school_class: Mapped["SchoolClass"] = relationship("SchoolClass")
    subject: Mapped["Subject"] = relationship("Subject")
