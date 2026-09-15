from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PlanCreate(BaseModel):
    name: str
    price: float
    currency: str = "USD"
    billing_period: str = Field(default="monthly", pattern="^(monthly|annual)$")
    max_students: int | None = None


class PlanUpdate(BaseModel):
    name: str | None = None
    price: float | None = None
    currency: str | None = None
    billing_period: str | None = Field(default=None, pattern="^(monthly|annual)$")
    max_students: int | None = None
    is_active: bool | None = None


class PlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    price: float
    currency: str
    billing_period: str
    max_students: int | None
    is_active: bool


class SubscriptionUpdate(BaseModel):
    plan_id: int | None = None
    subscription_status: str | None = Field(default=None, pattern="^(trialing|active|past_due|suspended)$")
    trial_ends_at: datetime | None = None
