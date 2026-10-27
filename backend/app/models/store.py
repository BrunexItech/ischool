import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class StockMovementType(str, enum.Enum):
    RECEIPT = "receipt"
    ISSUE = "issue"
    ADJUSTMENT = "adjustment"  # a stocktake correction, with the reason in the note


class StockItem(Base):
    __tablename__ = "stock_items"
    __table_args__ = (UniqueConstraint("school_id", "code", name="uq_stock_item_code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    account_id: Mapped[int] = mapped_column(ForeignKey("ledger_accounts.id", ondelete="RESTRICT"), nullable=False)

    code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    unit: Mapped[str] = mapped_column(String(30), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reorder_level: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    unit_cost: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    school: Mapped["School"] = relationship("School")
    account: Mapped["Account"] = relationship("Account")


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("stock_items.id", ondelete="CASCADE"), nullable=False)

    type: Mapped[StockMovementType] = mapped_column(Enum(StockMovementType), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)

    journal_entry_id: Mapped[int | None] = mapped_column(ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True)
    recorded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
    item: Mapped["StockItem"] = relationship("StockItem")


class StoreRequest(Base):
    """A teacher or department asking the store for items. The store keeper
    issues what is available (which moves stock and posts to the ledger) or
    declines with a reason."""

    __tablename__ = "store_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    reference: Mapped[str] = mapped_column(String(30), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(15), nullable=False, default="requested")  # requested | issued | declined
    requested_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decision_note: Mapped[str | None] = mapped_column(String(500), nullable=True)

    lines: Mapped[list["StoreRequestLine"]] = relationship("StoreRequestLine", cascade="all, delete-orphan", back_populates="request")
    requester: Mapped["User | None"] = relationship("User", foreign_keys=[requested_by])


class StoreRequestLine(Base):
    __tablename__ = "store_request_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("store_requests.id", ondelete="CASCADE"), nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("stock_items.id", ondelete="CASCADE"), nullable=False)
    quantity_requested: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_issued: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    request: Mapped["StoreRequest"] = relationship("StoreRequest", back_populates="lines")
    item: Mapped["StockItem"] = relationship("StockItem")
