from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SchoolCommunicationConfig(Base):
    """Each school's own MobileSasa (bulk SMS) account — messages send from
    the school's own sender ID and are paid for out of the school's own
    SMS credit balance, never ours. Same bring-your-own-credentials model
    as the payment providers."""

    __tablename__ = "school_communication_configs"

    id: Mapped[int] = mapped_column(primary_key=True)
    school_id: Mapped[int] = mapped_column(ForeignKey("schools.id", ondelete="CASCADE"), unique=True, nullable=False)

    mobilesasa_api_token_encrypted: Mapped[str | None] = mapped_column(String(500), nullable=True)
    mobilesasa_sender_id: Mapped[str | None] = mapped_column(String(50), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    school: Mapped["School"] = relationship("School")

    @property
    def sms_configured(self) -> bool:
        return bool(self.mobilesasa_api_token_encrypted and self.mobilesasa_sender_id)
