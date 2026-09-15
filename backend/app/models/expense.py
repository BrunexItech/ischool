from datetime import date as date_, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Expense(Base):
    """A school's own expenditure — salaries, maintenance, utilities,
    supplies, etc. Income is derived from existing FeePayment records, so
    finance reporting can compare the two without duplicating fee data."""

    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)

    category: Mapped[str] = mapped_column(String(50), nullable=False)  # salaries | maintenance | utilities | supplies...
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    date: Mapped[date_] = mapped_column(Date, nullable=False)

    recorded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
