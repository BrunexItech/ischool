import enum
from datetime import date as date_, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class RequisitionStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    APPROVED = "approved"
    DECLINED = "declined"


class PurchaseOrderStatus(str, enum.Enum):
    ISSUED = "issued"
    RECEIVED = "received"
    CANCELLED = "cancelled"


class PurchaseRequisition(Base):
    """A department's request to spend — raised against a budget line
    (ledger account), reviewed, then turned into a purchase order once
    approved."""

    __tablename__ = "purchase_requisitions"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)

    reference: Mapped[str] = mapped_column(String(30), nullable=False)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    account_id: Mapped[int] = mapped_column(ForeignKey("ledger_accounts.id", ondelete="RESTRICT"), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_cost: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    status: Mapped[RequisitionStatus] = mapped_column(Enum(RequisitionStatus), default=RequisitionStatus.SUBMITTED, nullable=False)
    requested_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
    account: Mapped["Account"] = relationship("Account")
    purchase_order: Mapped["PurchaseOrder | None"] = relationship("PurchaseOrder", back_populates="requisition", uselist=False)


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    requisition_id: Mapped[int] = mapped_column(ForeignKey("purchase_requisitions.id", ondelete="CASCADE"), nullable=False, unique=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False)

    reference: Mapped[str] = mapped_column(String(30), nullable=False)
    delivery_date: Mapped[date_] = mapped_column(Date, nullable=False)
    total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[PurchaseOrderStatus] = mapped_column(Enum(PurchaseOrderStatus), default=PurchaseOrderStatus.ISSUED, nullable=False)

    journal_entry_id: Mapped[int | None] = mapped_column(ForeignKey("journal_entries.id", ondelete="SET NULL"), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    school: Mapped["School"] = relationship("School")
    requisition: Mapped["PurchaseRequisition"] = relationship("PurchaseRequisition", back_populates="purchase_order")
    supplier: Mapped["Supplier"] = relationship("Supplier")
