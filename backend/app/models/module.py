from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

# Every module a school can be gated on. Add new modules here as they ship.
# The *_section keys gate which school levels/campuses a school operates, as opposed
# to the feature modules below them (attendance, fees, etc.).
MODULE_KEYS = [
    "pre_primary",
    "primary_section",
    "secondary_section",
    "college_section",
    "students_staff",
    "attendance",
    "results",
    "fees",
    "live_classes",
    "communication",
    "transport",
    "meals",
    "awards",
    "activities",
    "finance",
    "pickup_dropoff",
    "exams",
    "sms",
    "lesson_plans",
    "admissions_crm",
    "school_calendar",
    "boarding",
    "security",
    "trips",
    "erp_finance",
    "timetable",
    "staff_attendance",
    "homework",
    "conduct",
]


class SchoolModule(Base):
    __tablename__ = "school_modules"
    __table_args__ = (UniqueConstraint("school_id", "module_key", name="uq_school_module"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    module_key: Mapped[str] = mapped_column(String(50), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    school: Mapped["School"] = relationship("School", back_populates="modules")
