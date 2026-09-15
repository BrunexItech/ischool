from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SchoolPaymentConfigUpdate(BaseModel):
    """All fields optional — a school can set up M-Pesa, cards, or both,
    in separate calls, without needing to re-supply the other's credentials."""

    mpesa_shortcode: str | None = None
    mpesa_consumer_key: str | None = None
    mpesa_consumer_secret: str | None = None
    mpesa_passkey: str | None = None
    mpesa_env: str | None = Field(default=None, pattern="^(sandbox|production)$")

    pesapal_consumer_key: str | None = None
    pesapal_consumer_secret: str | None = None
    pesapal_env: str | None = Field(default=None, pattern="^(sandbox|production)$")


class SchoolPaymentConfigOut(BaseModel):
    mpesa_configured: bool
    mpesa_shortcode: str | None = None
    mpesa_env: str | None = None
    card_configured: bool
    pesapal_env: str | None = None


class PaymentMethodsOut(BaseModel):
    mpesa: bool
    card: bool


class InitiateMpesaPaymentRequest(BaseModel):
    phone_number: str
    amount: float | None = None  # defaults to the invoice's remaining balance


class InitiateCardPaymentRequest(BaseModel):
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


class CardPaymentInitiated(BaseModel):
    transaction: PaymentTransactionOut
    checkout_url: str
