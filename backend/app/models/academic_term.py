from datetime import date as date_

from sqlalchemy import Boolean, Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AcademicTerm(Base):
    """The source of truth for term names — Results/Fees still store the
    term as a plain string (avoiding a schema migration on live data), but
    the frontend now only ever offers one of these names, so 'Term 1 2026'
    and 'term 1 2026' can't silently fragment as two different terms."""

    __tablename__ = "academic_terms"
    __table_args__ = (UniqueConstraint("school_id", "name", name="uq_academic_term_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    start_date: Mapped[date_ | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date_ | None] = mapped_column(Date, nullable=True)
    is_current: Mapped[bool] = mapped_column(Boolean, default=False)

    school: Mapped["School"] = relationship("School")
