import enum
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CalendarEventType(str, enum.Enum):
    MEETING = "meeting"
    EXAM = "exam"
    SPORTS = "sports"
    ADMISSIONS = "admissions"
    HOLIDAY = "holiday"
    TERM = "term"
    TRIP_BRIEFING = "trip_briefing"
    COLLEGE = "college"
    OTHER = "other"


class CalendarEvent(Base):
    """A single school-wide event — a meeting, exam window, holiday, trip
    briefing, or anything else worth putting on everyone's calendar. Spans
    one day when end_date is unset, or a range when it's set."""

    __tablename__ = "calendar_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    event_type: Mapped[CalendarEventType] = mapped_column(Enum(CalendarEventType), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    school: Mapped["School"] = relationship("School")
