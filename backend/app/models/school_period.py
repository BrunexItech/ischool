from datetime import time

from sqlalchemy import JSON, ForeignKey, Integer, String, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

PERIOD_KINDS = ("lesson", "prep", "break", "lunch", "assembly", "games")
TEACHABLE_KINDS = ("lesson", "prep")


class SchoolPeriod(Base):
    """One block of the school day for a level — a lesson, a break, lunch or a
    prep session. The head (or the secretary, with the head's approval) sets
    these once per level; teachers then only choose the subject and who
    teaches it, so lesson and break times can never be mistyped or clash."""

    __tablename__ = "school_periods"
    __table_args__ = (UniqueConstraint("school_id", "level_group", "position", name="uq_school_period_position"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    level_group: Mapped[str] = mapped_column(String(30), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False, default="lesson")
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    # Weekdays this block runs, 0 = Monday. Prep or games may skip some days.
    days: Mapped[list] = mapped_column(JSON, nullable=False, default=lambda: [0, 1, 2, 3, 4])
