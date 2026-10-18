import enum
from datetime import date as date_, datetime, time as time_

from sqlalchemy import JSON, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, Time, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class TripStatus(str, enum.Enum):
    REQUESTED = "requested"
    APPROVED = "approved"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DECLINED = "declined"
    CANCELLED = "cancelled"


class Trip(Base):
    """A school bus booking — a field trip, sports fixture, or excursion —
    from request through the transport office's review to completion."""

    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)

    reference: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    trip_type: Mapped[str] = mapped_column(String(50), nullable=False)
    purpose: Mapped[str] = mapped_column(Text, nullable=False)
    destination: Mapped[str] = mapped_column(String(255), nullable=False)

    start_date: Mapped[date_] = mapped_column(Date, nullable=False)
    end_date: Mapped[date_] = mapped_column(Date, nullable=False)
    departure_time: Mapped[time_] = mapped_column(Time, nullable=False)
    return_time: Mapped[time_] = mapped_column(Time, nullable=False)

    class_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    student_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    staff_count: Mapped[int] = mapped_column(Integer, nullable=False)
    distance_km: Mapped[int] = mapped_column(Integer, nullable=False)
    estimated_cost: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    vehicle_id: Mapped[int | None] = mapped_column(ForeignKey("vehicles.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[TripStatus] = mapped_column(Enum(TripStatus), default=TripStatus.REQUESTED, nullable=False)

    requested_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
    vehicle: Mapped["Vehicle | None"] = relationship("Vehicle")
