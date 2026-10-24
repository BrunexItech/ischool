import enum

from sqlalchemy import Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class LevelGroup(str, enum.Enum):
    PRE_PRIMARY = "pre_primary"
    PRIMARY = "primary"
    JUNIOR_SCHOOL = "junior_school"
    SENIOR_SCHOOL = "senior_school"


class GradeLevel(Base):
    """The fixed, nationally-defined CBE grade catalogue (PP1 through Grade
    12) — seeded once by migration, never created/edited/deleted by users.
    School-specific availability is a separate, configurable concern (see
    SchoolEnabledGrade)."""

    __tablename__ = "grade_levels"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(50), nullable=False)
    level_group: Mapped[LevelGroup] = mapped_column(Enum(LevelGroup), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)


class SchoolEnabledGrade(Base):
    """Which national grades a specific school currently offers — set only
    by the Group Principal (or super_admin), enforced server-side wherever
    a class is created or a learner is promoted."""

    __tablename__ = "school_enabled_grades"
    __table_args__ = (UniqueConstraint("school_id", "grade_level_id", name="uq_school_enabled_grade"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    grade_level_id: Mapped[int] = mapped_column(ForeignKey("grade_levels.id", ondelete="CASCADE"), nullable=False)

    grade_level: Mapped["GradeLevel"] = relationship("GradeLevel")
