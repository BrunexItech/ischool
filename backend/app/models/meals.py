from datetime import date as date_, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, UniqueConstraint, func
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
