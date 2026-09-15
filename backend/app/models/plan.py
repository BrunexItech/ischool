import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class BillingPeriod(str, enum.Enum):
    MONTHLY = "monthly"
    ANNUAL = "annual"


class Plan(Base):
    """A subscription tier iSchool sells to schools — this is our own
    revenue, separate from and never mixed with the fee money schools
    collect from parents. No payment collection is wired to this yet;
    a super-admin assigns/changes a school's plan and status by hand
    until that's built."""

    __tablename__ = "plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="USD")
    billing_period: Mapped[BillingPeriod] = mapped_column(Enum(BillingPeriod), default=BillingPeriod.MONTHLY)
    max_students: Mapped[int | None] = mapped_column(nullable=True)  # None = unlimited
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)  # inactive = no longer offered to new schools

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    schools: Mapped[list["School"]] = relationship("School", back_populates="plan")
