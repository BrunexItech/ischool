from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SupervisorSchoolLink(Base):
    """Which schools a SUPERVISOR account may see — set by the super-admin,
    an arbitrary set of schools (not a parent/branch hierarchy). A school
    never has to pretend to be 'the group' for this to work."""

    __tablename__ = "supervisor_school_links"
    __table_args__ = (UniqueConstraint("supervisor_user_id", "school_id", name="uq_supervisor_school"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    supervisor_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    supervisor: Mapped["User"] = relationship("User", foreign_keys=[supervisor_user_id])
    school: Mapped["School"] = relationship("School")
