import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class LiveClassStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    ENDED = "ended"


class LiveClass(Base):
    __tablename__ = "live_classes"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("school_classes.id", ondelete="SET NULL"), nullable=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    scheduled_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[LiveClassStatus] = mapped_column(Enum(LiveClassStatus), default=LiveClassStatus.SCHEDULED)

    room_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    join_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
    school_class: Mapped["SchoolClass | None"] = relationship("SchoolClass")


class LiveClassGuestRequest(Base):
    """Someone who followed the join link and is waiting for the teacher to let
    them in. They only get a room token once admitted."""

    __tablename__ = "live_class_guest_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    live_class_id: Mapped[int] = mapped_column(ForeignKey("live_classes.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    request_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="pending")  # pending | admitted | denied
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LiveClassJoin(Base):
    """Who came into a class and when — the live-class attendance list. One row
    per person per class (first time they were given a way in)."""

    __tablename__ = "live_class_joins"
    __table_args__ = (UniqueConstraint("live_class_id", "identity", name="uq_live_class_join"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    live_class_id: Mapped[int] = mapped_column(ForeignKey("live_classes.id", ondelete="CASCADE"), nullable=False)
    identity: Mapped[str] = mapped_column(String(60), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    kind: Mapped[str] = mapped_column(String(10), nullable=False)  # host | student | guest
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
