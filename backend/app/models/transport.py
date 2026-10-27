from datetime import date, datetime, time as time_

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Text, Time, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Vehicle(Base):
    __tablename__ = "vehicles"
    __table_args__ = (UniqueConstraint("school_id", "registration_number", name="uq_vehicle_registration"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    registration_number: Mapped[str] = mapped_column(String(20), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    driver_name: Mapped[str] = mapped_column(String(255), nullable=False)
    driver_phone: Mapped[str] = mapped_column(String(30), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    vehicle_type: Mapped[str] = mapped_column(String(20), nullable=False, default="bus", server_default="bus")
    make_model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    insurance_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)
    inspection_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)
    next_service_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # The person who rides with the driver and checks children on and off.
    attendant_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)

    school: Mapped["School"] = relationship("School")
    attendant: Mapped["User | None"] = relationship("User", foreign_keys=[attendant_user_id])
    routes: Mapped[list["TransportRoute"]] = relationship("TransportRoute", back_populates="vehicle")


class TransportRoute(Base):
    __tablename__ = "transport_routes"
    __table_args__ = (UniqueConstraint("school_id", "name", name="uq_transport_route_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    vehicle_id: Mapped[int | None] = mapped_column(ForeignKey("vehicles.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    school_arrival_time: Mapped[time_ | None] = mapped_column(Time, nullable=True)       # morning: due at school
    afternoon_departure_time: Mapped[time_ | None] = mapped_column(Time, nullable=True)  # afternoon: leaves school

    school: Mapped["School"] = relationship("School")
    vehicle: Mapped["Vehicle | None"] = relationship("Vehicle", back_populates="routes")
    stops: Mapped[list["RouteStop"]] = relationship(
        "RouteStop", back_populates="route", cascade="all, delete-orphan", order_by="RouteStop.stop_order"
    )


class RouteStop(Base):
    __tablename__ = "route_stops"

    id: Mapped[int] = mapped_column(primary_key=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("transport_routes.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    stop_order: Mapped[int] = mapped_column(Integer, nullable=False)
    pickup_time: Mapped[time_ | None] = mapped_column(Time, nullable=True)

    route: Mapped["TransportRoute"] = relationship("TransportRoute", back_populates="stops")


class TransportRun(Base):
    """One journey of one route on one day: the morning run brings children to
    school, the afternoon run takes them home. The attendant starts it, checks
    each child on and off, and completes it."""

    __tablename__ = "transport_runs"
    __table_args__ = (UniqueConstraint("route_id", "run_date", "direction", name="uq_transport_run"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    route_id: Mapped[int] = mapped_column(ForeignKey("transport_routes.id", ondelete="CASCADE"), nullable=False)
    vehicle_id: Mapped[int | None] = mapped_column(ForeignKey("vehicles.id", ondelete="SET NULL"), nullable=True)
    run_date: Mapped[date] = mapped_column(Date, nullable=False)
    direction: Mapped[str] = mapped_column(String(10), nullable=False)  # morning | afternoon
    status: Mapped[str] = mapped_column(String(15), nullable=False, default="in_progress")
    started_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    route: Mapped["TransportRoute"] = relationship("TransportRoute")
    vehicle: Mapped["Vehicle | None"] = relationship("Vehicle")
    starter: Mapped["User | None"] = relationship("User", foreign_keys=[started_by])
    boardings: Mapped[list["TransportBoarding"]] = relationship("TransportBoarding", back_populates="run", cascade="all, delete-orphan")


class TransportBoarding(Base):
    """One child on one run: waiting, on the vehicle, handed over, or absent."""

    __tablename__ = "transport_boardings"
    __table_args__ = (UniqueConstraint("run_id", "student_id", name="uq_transport_boarding"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("transport_runs.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    stop_id: Mapped[int | None] = mapped_column(ForeignKey("route_stops.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(15), nullable=False, default="pending")  # pending|boarded|dropped|absent
    boarded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dropped_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    handed_to: Mapped[str | None] = mapped_column(String(255), nullable=True)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    recorded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    run: Mapped["TransportRun"] = relationship("TransportRun", back_populates="boardings")
    student: Mapped["Student"] = relationship("Student")
    stop: Mapped["RouteStop | None"] = relationship("RouteStop")
