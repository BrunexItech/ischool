from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


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
    created_at: datetime


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
