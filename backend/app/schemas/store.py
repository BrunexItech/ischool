from datetime import datetime

from pydantic import BaseModel, Field

from app.models.store import StockMovementType


class StockItemCreate(BaseModel):
    name: str = Field(min_length=3)
    category: str
    unit: str = Field(min_length=1)
    reorder_level: int = Field(ge=0)
    unit_cost: float = Field(gt=0)
    account_id: int


class StockItemOut(BaseModel):
    id: int
    code: str
    name: str
    category: str
    unit: str
    quantity: int
    reorder_level: int
    unit_cost: float
    account_id: int

    model_config = {"from_attributes": True}


class StockReceiptCreate(BaseModel):
    item_id: int
    quantity: int = Field(gt=0)
    unit_cost: float | None = Field(default=None, gt=0)
    note: str | None = None


class StockIssueCreate(BaseModel):
    item_id: int
    quantity: int = Field(gt=0)
    department: str
    note: str | None = None


class StockMovementOut(BaseModel):
    id: int
    item_id: int
    type: StockMovementType
    quantity: int
    department: str | None
    note: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
