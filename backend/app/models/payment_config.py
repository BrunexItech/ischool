from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SchoolPaymentConfig(Base):
    """Each school's own Safaricom Daraja credentials — money from an STK
    push settles directly into the school's own paybill/till, never through
    any account we control. consumer_secret and passkey are stored encrypted
    (app.core.crypto) and are never returned by the API once saved."""

    __tablename__ = "school_payment_configs"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), unique=True, nullable=False)

    mpesa_shortcode: Mapped[str] = mapped_column(String(20), nullable=False)
    mpesa_consumer_key: Mapped[str] = mapped_column(String(255), nullable=False)
    mpesa_consumer_secret_encrypted: Mapped[str] = mapped_column(String(500), nullable=False)
    mpesa_passkey_encrypted: Mapped[str] = mapped_column(String(500), nullable=False)
    mpesa_env: Mapped[str] = mapped_column(String(20), default="sandbox")  # "sandbox" | "production"

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    school: Mapped["School"] = relationship("School")
