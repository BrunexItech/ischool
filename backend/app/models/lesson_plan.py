import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class LessonPlanEntryStatus(str, enum.Enum):
    PLANNED = "planned"
    COMPLETED = "completed"


class LessonPlan(Base):
    """A teacher's plan for one class/subject/term — deliberately just a
    shell around a list of entries, so it can be filled in one go at the
    start of term or built up week by week as the term goes."""

    __tablename__ = "lesson_plans"
    __table_args__ = (UniqueConstraint("school_id", "class_id", "subject_id", "term", name="uq_lesson_plan_scope"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    class_id: Mapped[int] = mapped_column(ForeignKey("school_classes.id", ondelete="CASCADE"), nullable=False)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    term: Mapped[str] = mapped_column(String(50), nullable=False)

    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    school: Mapped["School"] = relationship("School")
    school_class: Mapped["SchoolClass"] = relationship("SchoolClass")
    subject: Mapped["Subject"] = relationship("Subject")
    entries: Mapped[list["LessonPlanEntry"]] = relationship(
        "LessonPlanEntry", back_populates="lesson_plan", cascade="all, delete-orphan", order_by="LessonPlanEntry.order"
    )

    @property
    def entry_count(self) -> int:
        return len(self.entries)

    @property
    def completed_count(self) -> int:
        return sum(1 for e in self.entries if e.status == LessonPlanEntryStatus.COMPLETED)


class LessonPlanEntry(Base):
    """One slot in the plan — usually a week, but the label is free text
    ("Week 1", "Revision week", "CAT 1") so the structure never forces a
    rigid week-by-week grid onto a term that doesn't actually run that way."""

    __tablename__ = "lesson_plan_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    lesson_plan_id: Mapped[int] = mapped_column(ForeignKey("lesson_plans.id", ondelete="CASCADE"), nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False)

    label: Mapped[str] = mapped_column(String(100), nullable=False)
    topic: Mapped[str] = mapped_column(String(255), nullable=False)
    objectives: Mapped[str | None] = mapped_column(Text, nullable=True)
    resources: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[LessonPlanEntryStatus] = mapped_column(Enum(LessonPlanEntryStatus), default=LessonPlanEntryStatus.PLANNED)

    lesson_plan: Mapped["LessonPlan"] = relationship("LessonPlan", back_populates="entries")
