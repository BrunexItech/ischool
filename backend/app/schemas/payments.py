from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SchoolPaymentConfigUpdate(BaseModel):
    mpesa_shortcode: str
    mpesa_consumer_key: str
    mpesa_consumer_secret: str
    mpesa_passkey: str
    mpesa_env: str = Field(default="sandbox", pattern="^(sandbox|production)$")


class SchoolPaymentConfigOut(BaseModel):
    is_configured: bool
    mpesa_shortcode: str | None = None
    mpesa_env: str | None = None


class InitiateMpesaPaymentRequest(BaseModel):
    phone_number: str
    amount: float | None = None  # defaults to the invoice's remaining balance


class PaymentTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_id: int
    merchant_reference: str
    amount: float
    currency: str
    status: str
    method: str | None
    created_at: datetime
    completed_at: datetime | None
