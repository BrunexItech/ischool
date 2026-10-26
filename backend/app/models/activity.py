from datetime import date as date_, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Activity(Base):
    """A school event/competition — sports day, debate championship, science
    fair, club event, etc. Participation is tracked separately so a student's
    record shows what they took part in, win or not."""

    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)  # sports | academic | arts | clubs...
    date: Mapped[date_] = mapped_column(Date, nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    # Who runs it, and who it is for: the whole school, one class, or invited learners.
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    scope: Mapped[str] = mapped_column(String(10), nullable=False, default="school", server_default="school")
    class_id: Mapped[int | None] = mapped_column(ForeignKey("school_classes.id", ondelete="SET NULL"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
    creator: Mapped["User | None"] = relationship("User", foreign_keys=[created_by])
    school_class: Mapped["SchoolClass | None"] = relationship("SchoolClass", foreign_keys=[class_id])
    participants: Mapped[list["ActivityParticipant"]] = relationship(
        "ActivityParticipant", back_populates="activity", cascade="all, delete-orphan"
    )

    @property
    def created_by_name(self) -> str | None:
        return self.creator.full_name if self.creator is not None else None

    @property
    def class_name(self) -> str | None:
        return self.school_class.name if self.school_class is not None else None

    @property
    def participant_count(self) -> int:
        return len(self.participants)


class ActivityParticipant(Base):
    __tablename__ = "activity_participants"
    __table_args__ = (UniqueConstraint("activity_id", "student_id", name="uq_activity_participant"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id", ondelete="CASCADE"), nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g. "Participant", "Team Captain", "1st Place"

    activity: Mapped["Activity"] = relationship("Activity", back_populates="participants")
    student: Mapped["Student"] = relationship("Student")

    @property
    def student_name(self) -> str:
        return f"{self.student.first_name} {self.student.last_name}"
