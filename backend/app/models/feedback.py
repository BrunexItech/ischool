from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class LeadershipFeedback(Base):
    """A note from school leadership to a teacher about their work: a lesson
    plan, a class, homework. The teacher acknowledges it (optionally with a
    reply), so the head can see that it was read and what came of it."""

    __tablename__ = "leadership_feedback"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    recipient_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    author_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    topic: Mapped[str] = mapped_column(String(100), nullable=False)       # e.g. "Lesson plan: Mathematics, Grade 6 North"
    link: Mapped[str | None] = mapped_column(String(200), nullable=True)  # where the teacher can open it
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(15), nullable=False, default="sent")  # sent | acknowledged
    reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    recipient: Mapped["User"] = relationship("User", foreign_keys=[recipient_user_id])
    author: Mapped["User | None"] = relationship("User", foreign_keys=[author_user_id])
