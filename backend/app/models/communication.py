import enum
from datetime import date as date_, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AnnouncementAudience(str, enum.Enum):
    ALL = "all"
    TEACHERS = "teachers"
    STAFF = "staff"
    STUDENTS = "students"
    PARENTS = "parents"


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    audience: Mapped[AnnouncementAudience] = mapped_column(Enum(AnnouncementAudience), default=AnnouncementAudience.ALL)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=True)

    # Set when this announcement is also a calendar event — e.g. sports day,
    # a mid-term break, a parent-teacher conference. Left null for a plain post.
    event_date: Mapped[date_ | None] = mapped_column(Date, nullable=True)
    event_end_date: Mapped[date_ | None] = mapped_column(Date, nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
