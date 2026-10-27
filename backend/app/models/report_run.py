from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class WeeklyReportRun(Base):
    """Remembers that a school's weekly report went out for an ISO week, so a
    restart or a late wake-up never sends it twice, and a missed Friday is
    caught up the next time the scheduler ticks."""

    __tablename__ = "weekly_report_runs"
    __table_args__ = (UniqueConstraint("school_id", "iso_year", "iso_week", name="uq_weekly_report_run"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    iso_year: Mapped[int] = mapped_column(Integer, nullable=False)
    iso_week: Mapped[int] = mapped_column(Integer, nullable=False)
    emails_sent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
