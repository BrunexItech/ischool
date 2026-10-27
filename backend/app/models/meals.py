from datetime import date as date_, datetime, time as time_

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Time, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class MealMenu(Base):
    """One meal slot on one day — e.g. Monday's lunch. Fee tracking for meal
    plans reuses the existing FeeInvoice with category='meals', so this
    model only handles the menu itself."""

    __tablename__ = "meal_menus"
    __table_args__ = (UniqueConstraint("school_id", "date", "meal_type", name="uq_meal_menu_slot"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)

    date: Mapped[date_] = mapped_column(Date, nullable=False)
    meal_type: Mapped[str] = mapped_column(String(20), nullable=False)  # breakfast | lunch | snack
    description: Mapped[str] = mapped_column(String(1000), nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")


class MealTime(Base):
    """A meal the school serves and when, e.g. Lunch 12:30 to 13:30. Boarders
    may have meals day students do not (supper), hence `audience`."""

    __tablename__ = "meal_times"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    start_time: Mapped[time_] = mapped_column(Time, nullable=False)
    end_time: Mapped[time_] = mapped_column(Time, nullable=False)
    audience: Mapped[str] = mapped_column(String(10), nullable=False, default="all", server_default="all")  # all | boarders

    items: Mapped[list["WeeklyMenuItem"]] = relationship("WeeklyMenuItem", cascade="all, delete-orphan", back_populates="meal_time")


class WeeklyMenuItem(Base):
    """What is served at a meal on a weekday. The week repeats until the menu changes."""

    __tablename__ = "weekly_menu_items"
    __table_args__ = (UniqueConstraint("meal_time_id", "weekday", name="uq_weekly_menu_item"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    meal_time_id: Mapped[int] = mapped_column(ForeignKey("meal_times.id", ondelete="CASCADE"), nullable=False)
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)  # 0 = Monday
    description: Mapped[str] = mapped_column(String(1000), nullable=False)

    meal_time: Mapped["MealTime"] = relationship("MealTime", back_populates="items")
