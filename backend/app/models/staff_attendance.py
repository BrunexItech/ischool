from datetime import date as date_, datetime, time

from sqlalchemy import Date, DateTime, ForeignKey, String, Time, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class StaffAttendance(Base):
    """A staff member's own arrival/departure for one day — separate from
    student attendance (AttendanceRecord). One row per user per day; the
    same person clocking in twice in a day just updates clocked_in_at."""

    __tablename__ = "staff_attendance"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_staff_attendance_user_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[date_] = mapped_column(Date, nullable=False)

    clocked_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    clocked_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)

    school: Mapped["School"] = relationship("School")
    user: Mapped["User"] = relationship("User")


class DutyAssignment(Base):
    """A named duty (gate duty, lunch duty, dorm patrol...) assigned to a
    staff member for a specific date and time window — the school's duty
    roster."""

    __tablename__ = "duty_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    title: Mapped[str] = mapped_column(String(100), nullable=False)
    date: Mapped[date_] = mapped_column(Date, nullable=False)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)

    assigned_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])


class StaffAttendanceSettings(Base):
    """When a scan counts as late, and when someone who has not scanned is
    treated as absent. One row per school; defaults apply until it is set."""

    __tablename__ = "staff_attendance_settings"

    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), primary_key=True)
    late_after: Mapped[time] = mapped_column(Time, nullable=False, default=time(7, 45))
    absent_after: Mapped[time] = mapped_column(Time, nullable=False, default=time(10, 0))


class StaffLeave(Base):
    """Approved leave, recorded by school leadership. Days covered are not
    counted as absences."""

    __tablename__ = "staff_leaves"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    start_date: Mapped[date_] = mapped_column(Date, nullable=False)
    end_date: Mapped[date_] = mapped_column(Date, nullable=False)
    leave_type: Mapped[str] = mapped_column(String(30), nullable=False)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recorded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])


class StaffAbsenceNote(Base):
    """A reason attached to one absent day (sick, official duty ...), so that
    a day without a scan can be explained rather than left as a bare absence."""

    __tablename__ = "staff_absence_notes"
    __table_args__ = (UniqueConstraint("user_id", "date", name="uq_staff_absence_note"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[date_] = mapped_column(Date, nullable=False)
    reason: Mapped[str] = mapped_column(String(30), nullable=False)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recorded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)


class StaffTrackingExclusion(Base):
    """Someone who is not expected on a normal school day (a part-timer, a
    visiting teacher): left out of absence tracking."""

    __tablename__ = "staff_tracking_exclusions"

    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
