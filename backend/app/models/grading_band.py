from sqlalchemy import ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class GradingBand(Base):
    """A school's own configurable score-to-CBC-level bands — e.g. EE
    80-100 worth 4 points. Exactly one set of rows per school; a teacher's
    numeric score is converted to a level by matching it into one of
    these ranges, same mechanism for every grade including PP1/PP2."""

    __tablename__ = "grading_bands"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)

    level_code: Mapped[str] = mapped_column(String(10), nullable=False)
    label: Mapped[str] = mapped_column(String(50), nullable=False)
    min_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    max_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)

    school: Mapped["School"] = relationship("School")
