import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PaymentTransactionStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"


class PaymentTransaction(Base):
    """Tracks an online payment attempt (card/M-Pesa/Airtel via Pesapal) from
    the moment it's initiated through to completion — the audit trail for
    money that changed hands outside our own recording UI. On completion,
    a matching FeePayment is created via the same path a staff-recorded
    payment uses, so balances/notifications/audit all just work."""

    __tablename__ = "payment_transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), nullable=False)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("fee_invoices.id", ondelete="CASCADE"), nullable=False)

    merchant_reference: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    order_tracking_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="KES")
    status: Mapped[PaymentTransactionStatus] = mapped_column(
        Enum(PaymentTransactionStatus), default=PaymentTransactionStatus.PENDING
    )
    method: Mapped[str | None] = mapped_column(String(30), nullable=True)

    initiated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    invoice: Mapped["FeeInvoice"] = relationship("FeeInvoice")
