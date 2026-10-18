from pydantic import BaseModel, Field


class BudgetSet(BaseModel):
    account_id: int
    year: int
    amount: float = Field(ge=0)


class BudgetLineOut(BaseModel):
    account_id: int
    account_code: str
    account_name: str
    year: int
    budget: float
    actual: float
    committed: float
    available: float
