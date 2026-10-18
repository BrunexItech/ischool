import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PayRunStatus(str, enum.Enum):
    DRAFT = "draft"
    PAID = "paid"


class EmploymentType(str, enum.Enum):
    TEACHING = "teaching"
    NON_TEACHING = "non_teaching"


class PayrollProfile(Base):
    """Salary structure for one staff member — basic + allowances. Kenya
    statutory deductions (PAYE, NSSF, SHIF, housing levy) are computed fresh
    for every pay run rather than stored here."""

    __tablename__ = "payroll_profiles"
    __table_args__ = (UniqueConstraint("school_id", "user_id", name="uq_payroll_profile_user"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    employment_type: Mapped[EmploymentType] = mapped_column(Enum(EmploymentType), nullable=False)
    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    house_allowance: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    transport_allowance: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    kra_pin: Mapped[str] = mapped_column(String(20), nullable=False)
    nssf_number: Mapped[str] = mapped_column(String(30), nullable=False)
    bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    bank_account: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    school: Mapped["School"] = relationship("School")
    user: Mapped["User"] = relationship("User")


class PayRun(Base):
    __tablename__ = "pay_runs"
    __table_args__ = (UniqueConstraint("school_id", "period", name="uq_pay_run_period"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    period: Mapped[str] = mapped_column(String(7), nullable=False)  # "YYYY-MM"
    status: Mapped[PayRunStatus] = mapped_column(Enum(PayRunStatus), default=PayRunStatus.DRAFT, nullable=False)

    journal_entry_id: Mapped[int | None] = mapped_column(ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    paid_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
    lines: Mapped[list["PayslipLine"]] = relationship("PayslipLine", back_populates="pay_run", cascade="all, delete-orphan")


class PayslipLine(Base):
    __tablename__ = "payslip_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    pay_run_id: Mapped[int] = mapped_column(ForeignKey("pay_runs.id", ondelete="CASCADE"), nullable=False)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    staff_name: Mapped[str] = mapped_column(String(255), nullable=False)
    employment_type: Mapped[EmploymentType] = mapped_column(Enum(EmploymentType), nullable=False)
    basic: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    house: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    transport: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    gross: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    nssf: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    shif: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    ahl: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    paye: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    net: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    pay_run: Mapped["PayRun"] = relationship("PayRun", back_populates="lines")
