import enum
from datetime import datetime, timedelta, timezone

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

TRIAL_DAYS = 14


class SubscriptionStatus(str, enum.Enum):
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    SUSPENDED = "suspended"


def _default_trial_end() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS)


class School(Base):
    __tablename__ = "schools"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    custom_domain: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)

    # Set when this school is a branch/campus of another — each branch is
    # still a fully independent tenant (its own students/staff/fees/modules),
    # just grouped under a parent for reporting and onboarding purposes.
    parent_school_id: Mapped[int | None] = mapped_column(ForeignKey("schools.id", ondelete="SET NULL"), nullable=True)

    # Branding
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    primary_color: Mapped[str] = mapped_column(String(20), default="#1D4ED8")
    secondary_color: Mapped[str] = mapped_column(String(20), default="#111827")

    # Locale / billing defaults — Kenya first, global-ready
    country: Mapped[str] = mapped_column(String(100), default="Kenya")
    currency: Mapped[str] = mapped_column(String(10), default="KES")
    timezone: Mapped[str] = mapped_column(String(50), default="Africa/Nairobi")

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # iSchool's own revenue from this school — entirely separate from the
    # fees a school collects from its own parents. No payment collection is
    # wired to this yet: a super-admin assigns a plan and flips the status
    # by hand once a school has paid outside the system.
    plan_id: Mapped[int | None] = mapped_column(ForeignKey("plans.id", ondelete="SET NULL"), nullable=True)
    subscription_status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus), default=SubscriptionStatus.TRIALING
    )
    trial_ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_default_trial_end)

    plan: Mapped["Plan | None"] = relationship("Plan", back_populates="schools")
    modules: Mapped[list["SchoolModule"]] = relationship(
        "SchoolModule", back_populates="school", cascade="all, delete-orphan"
    )
    users: Mapped[list["User"]] = relationship("User", back_populates="school")
    classes: Mapped[list["SchoolClass"]] = relationship(
        "SchoolClass", back_populates="school", cascade="all, delete-orphan"
    )
    students: Mapped[list["Student"]] = relationship(
        "Student", back_populates="school", cascade="all, delete-orphan"
    )
    staff_profiles: Mapped[list["StaffProfile"]] = relationship(
        "StaffProfile", back_populates="school", cascade="all, delete-orphan"
    )
    parent_school: Mapped["School | None"] = relationship("School", remote_side=[id], back_populates="branches")
    branches: Mapped[list["School"]] = relationship("School", back_populates="parent_school")

    @property
    def branch_count(self) -> int:
        return len(self.branches)
