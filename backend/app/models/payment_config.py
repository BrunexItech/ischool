from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SchoolPaymentConfig(Base):
    """Each school's own payment provider credentials — money settles
    directly into the school's own paybill/account, never through anything
    we control. Every provider's fields are independently optional (a
    school might set up only M-Pesa, only cards, or both). Secrets are
    stored encrypted (app.core.crypto) and never returned by the API once
    saved."""

    __tablename__ = "school_payment_configs"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), unique=True, nullable=False)

    mpesa_shortcode: Mapped[str | None] = mapped_column(String(20), nullable=True)
    mpesa_consumer_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mpesa_consumer_secret_encrypted: Mapped[str | None] = mapped_column(String(500), nullable=True)
    mpesa_passkey_encrypted: Mapped[str | None] = mapped_column(String(500), nullable=True)
    mpesa_env: Mapped[str] = mapped_column(String(20), default="sandbox")  # "sandbox" | "production"

    flutterwave_public_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    flutterwave_secret_key_encrypted: Mapped[str | None] = mapped_column(String(500), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    school: Mapped["School"] = relationship("School")

    @property
    def mpesa_configured(self) -> bool:
        return bool(self.mpesa_shortcode and self.mpesa_consumer_key and self.mpesa_consumer_secret_encrypted)

    @property
    def card_configured(self) -> bool:
        return bool(self.flutterwave_secret_key_encrypted)
