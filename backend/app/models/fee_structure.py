from sqlalchemy import ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class FeeStructureLine(Base):
    """What one grade is charged for one thing in one term, e.g. Grade 4,
    Term 1, tuition, KES 18,500. Invoices are generated from these lines so
    every learner in a grade is billed the same, once."""

    __tablename__ = "fee_structure_lines"
    __table_args__ = (UniqueConstraint("school_id", "term", "grade_level_id", "category", name="uq_fee_structure_line"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    term: Mapped[str] = mapped_column(String(50), nullable=False)          # the academic term's name
    grade_level_id: Mapped[int] = mapped_column(ForeignKey("grade_levels.id", ondelete="CASCADE"), nullable=False)
    category: Mapped[str] = mapped_column(String(30), nullable=False)      # tuition | transport | meals | boarding | other...
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    grade: Mapped["GradeLevel"] = relationship("GradeLevel")
