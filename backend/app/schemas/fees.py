from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class FeeInvoiceCreate(BaseModel):
    student_id: int
    term: str
    amount_due: float
    due_date: date | None = None


class FeePaymentCreate(BaseModel):
    amount: float
    method: str
    reference: str | None = None


class FeePaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    invoice_id: int
    amount: float
    method: str
    reference: str | None
    paid_at: datetime


class FeeInvoiceOut(BaseModel):
    id: int
    school_id: int
    student_id: int
    term: str
    amount_due: float
    amount_paid: float
    balance: float
    status: str
    due_date: date | None


class FeeInvoiceDetailOut(FeeInvoiceOut):
    payments: list[FeePaymentOut]
