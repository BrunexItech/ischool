import enum
from datetime import date as date_, datetime

from sqlalchemy import JSON, Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ExeatStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    DENIED = "denied"
    OUT = "out"
    RETURNED = "returned"
    RETURNED_LATE = "returned_late"


class SickBayAction(str, enum.Enum):
    REST_IN_SICK_BAY = "rest_in_sick_bay"
    REFER_TO_CLINIC = "refer_to_clinic"
    FIRST_AID = "first_aid"


class RollSession(str, enum.Enum):
    MORNING = "morning"
    EVENING = "evening"
    NIGHT = "night"


class IncidentStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"


class BoardingHouse(Base):
    __tablename__ = "boarding_houses"
    __table_args__ = (UniqueConstraint("school_id", "name", name="uq_boarding_house_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    gender: Mapped[str] = mapped_column(String(10), nullable=False)
    total_beds: Mapped[int] = mapped_column(Integer, nullable=False)

    school: Mapped["School"] = relationship("School")
    assignments: Mapped[list["BoardingAssignment"]] = relationship(
        "BoardingAssignment", back_populates="house", cascade="all, delete-orphan"
    )


class BoardingAssignment(Base):
    """A boarder's current bed. One active row per student — moving beds
    updates this row rather than creating a history we don't need yet."""

    __tablename__ = "boarding_assignments"
    __table_args__ = (UniqueConstraint("student_id", name="uq_boarding_assignment_student"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    house_id: Mapped[int] = mapped_column(ForeignKey("boarding_houses.id", ondelete="CASCADE"), nullable=False)
    bed_number: Mapped[str] = mapped_column(String(20), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
    student: Mapped["Student"] = relationship("Student")
    house: Mapped["BoardingHouse"] = relationship("BoardingHouse", back_populates="assignments")


class BoardingRollCall(Base):
    """One roll call for one house, one date, one session (morning/evening/
    night). `marks` is {student_id: "P"|"A"|"S"} — present, absent, sick bay."""

    __tablename__ = "boarding_roll_calls"
    __table_args__ = (UniqueConstraint("house_id", "date", "session", name="uq_boarding_roll_call"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    house_id: Mapped[int] = mapped_column(ForeignKey("boarding_houses.id", ondelete="CASCADE"), nullable=False)
    date: Mapped[date_] = mapped_column(Date, nullable=False)
    session: Mapped[RollSession] = mapped_column(Enum(RollSession), nullable=False)
    marks: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    recorded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    school: Mapped["School"] = relationship("School")
    house: Mapped["BoardingHouse"] = relationship("BoardingHouse")


class Exeat(Base):
    """A boarder's leave-out request, from the ask through gate pass issue,
    departure and return."""

    __tablename__ = "exeats"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False)

    from_date: Mapped[date_] = mapped_column(Date, nullable=False)
    to_date: Mapped[date_] = mapped_column(Date, nullable=False)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    pickup_name: Mapped[str] = mapped_column(String(255), nullable=False)
    pickup_relation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pickup_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)

    status: Mapped[ExeatStatus] = mapped_column(Enum(ExeatStatus), default=ExeatStatus.PENDING, nullable=False)
    gate_pass: Mapped[str | None] = mapped_column(String(30), nullable=True)
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    back_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
    student: Mapped["Student"] = relationship("Student")


class SickBayVisit(Base):
    __tablename__ = "sick_bay_visits"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False)

    complaint: Mapped[str] = mapped_column(String(255), nullable=False)
    temperature: Mapped[float | None] = mapped_column(Numeric(4, 1), nullable=True)
    action: Mapped[SickBayAction] = mapped_column(Enum(SickBayAction), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    parent_notified: Mapped[bool] = mapped_column(default=True)

    logged_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
    student: Mapped["Student"] = relationship("Student")


class BoardingIncident(Base):
    __tablename__ = "boarding_incidents"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    house_id: Mapped[int] = mapped_column(ForeignKey("boarding_houses.id", ondelete="CASCADE"), nullable=False)

    type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    action_taken: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[IncidentStatus] = mapped_column(Enum(IncidentStatus), default=IncidentStatus.OPEN, nullable=False)

    logged_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
    house: Mapped["BoardingHouse"] = relationship("BoardingHouse")
