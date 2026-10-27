from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class StaffMeeting(Base):
    """A live video meeting between a head or the group principal and teachers:
    everyone in the chosen schools, or just the teachers picked."""

    __tablename__ = "staff_meetings"

    id: Mapped[int] = mapped_column(primary_key=True)
    host_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    agenda: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    scheduled_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="scheduled")  # scheduled | live | ended | cancelled
    room_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)

    school_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list)       # the schools the meeting is for
    audience: Mapped[str] = mapped_column(String(10), nullable=False, default="all")   # all teachers of those schools | selected
    invitee_user_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list)  # used when audience is "selected"

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    host: Mapped["User"] = relationship("User", foreign_keys=[host_user_id])
    joins: Mapped[list["MeetingJoin"]] = relationship("MeetingJoin", cascade="all, delete-orphan", back_populates="meeting")


class MeetingJoin(Base):
    __tablename__ = "staff_meeting_joins"
    __table_args__ = (UniqueConstraint("meeting_id", "user_id", name="uq_meeting_join"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("staff_meetings.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    meeting: Mapped["StaffMeeting"] = relationship("StaffMeeting", back_populates="joins")
    user: Mapped["User"] = relationship("User")


class PrincipalReportRun(Base):
    """Remembers that a principal's weekly report went out, so a restart or a
    late wake-up never sends it twice in the same week."""

    __tablename__ = "principal_report_runs"
    __table_args__ = (UniqueConstraint("user_id", "iso_year", "iso_week", name="uq_principal_report_run"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    iso_year: Mapped[int] = mapped_column(nullable=False)
    iso_week: Mapped[int] = mapped_column(nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
