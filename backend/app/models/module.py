from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

# Every module a school can be gated on. Add new modules here as they ship.
MODULE_KEYS = [
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
]


class SchoolModule(Base):
    __tablename__ = "school_modules"
    __table_args__ = (UniqueConstraint("school_id", "module_key", name="uq_school_module"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    module_key: Mapped[str] = mapped_column(String(50), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    school: Mapped["School"] = relationship("School", back_populates="modules")
