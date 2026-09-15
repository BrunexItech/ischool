from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SchoolClass(Base):
    __tablename__ = "school_classes"
    __table_args__ = (UniqueConstraint("school_id", "name", name="uq_school_class_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    grade_level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    homeroom_teacher_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    school: Mapped["School"] = relationship("School", back_populates="classes")
    homeroom_teacher: Mapped["User | None"] = relationship("User")
    students: Mapped[list["Student"]] = relationship("Student", back_populates="school_class")


class Student(Base):
    __tablename__ = "students"
    __table_args__ = (UniqueConstraint("school_id", "admission_number", name="uq_student_admission_number"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    class_id: Mapped[int | None] = mapped_column(
        ForeignKey("school_classes.id", ondelete="SET NULL"), nullable=True
    )

    admission_number: Mapped[str] = mapped_column(String(50), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)

    guardian_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    guardian_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    guardian_email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Portal accounts — both optional; a student/parent only gets one once the
    # school issues it via the Students page.
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), unique=True, nullable=True
    )
    guardian_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Optional — only set once the transport module is used for this student.
    transport_route_id: Mapped[int | None] = mapped_column(
        ForeignKey("transport_routes.id", ondelete="SET NULL"), nullable=True
    )
    transport_stop_id: Mapped[int | None] = mapped_column(
        ForeignKey("route_stops.id", ondelete="SET NULL"), nullable=True
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School", back_populates="students")
    school_class: Mapped["SchoolClass | None"] = relationship("SchoolClass", back_populates="students")
    user: Mapped["User | None"] = relationship("User", foreign_keys=[user_id])
    guardian_user: Mapped["User | None"] = relationship("User", foreign_keys=[guardian_user_id])
    transport_route: Mapped["TransportRoute | None"] = relationship("TransportRoute", foreign_keys=[transport_route_id])
    transport_stop: Mapped["RouteStop | None"] = relationship("RouteStop", foreign_keys=[transport_stop_id])

    @property
    def has_student_account(self) -> bool:
        return self.user_id is not None

    @property
    def has_guardian_account(self) -> bool:
        return self.guardian_user_id is not None


class StaffProfile(Base):
    """Extra fields for a User whose role is teacher/staff/school_admin — the User row
    itself carries login + role; this carries the school-facing HR fields."""

    __tablename__ = "staff_profiles"
    __table_args__ = (UniqueConstraint("school_id", "staff_number", name="uq_staff_number"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)

    staff_number: Mapped[str] = mapped_column(String(50), nullable=False)
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)

    school: Mapped["School"] = relationship("School", back_populates="staff_profiles")
    user: Mapped["User"] = relationship("User")
