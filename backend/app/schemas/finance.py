from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.expense import ExpenseStatus


class ExpenseCreate(BaseModel):
    category: str
    description: str
    amount: float
    date: date


class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    category: str
    description: str
    amount: float
    date: date
    status: ExpenseStatus
    recorded_by: int | None
    approved_by: int | None
    approved_at: datetime | None
    rejected_reason: str | None
    created_at: datetime


class ExpenseRejectIn(BaseModel):
    reason: str


class CategoryTotal(BaseModel):
    category: str
    total: float


class MonthlyTotal(BaseModel):
    month: str
    income: float
    expenses: float


class FinanceSummaryOut(BaseModel):
    total_income: float
    total_expenses: float
    net: float
    expenses_by_category: list[CategoryTotal]
    monthly: list[MonthlyTotal]
