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


class StoreRequestLineIn(BaseModel):
    item_id: int
    quantity: int = Field(gt=0, le=100000)


class StoreRequestCreate(BaseModel):
    department: str = Field(min_length=2, max_length=100)
    note: str | None = Field(default=None, max_length=500)
    lines: list[StoreRequestLineIn] = Field(min_length=1)


class StoreRequestLineOut(BaseModel):
    id: int
    item_id: int
    item_name: str
    unit: str
    in_stock: int
    quantity_requested: int
    quantity_issued: int


class StoreRequestOut(BaseModel):
    id: int
    reference: str
    department: str
    note: str | None
    status: str
    requested_by_name: str | None
    requested_at: datetime
    decided_by_name: str | None
    decided_at: datetime | None
    decision_note: str | None
    lines: list[StoreRequestLineOut]


class StoreIssueRequest(BaseModel):
    # line id -> quantity to issue; lines left out are issued in full where stock allows
    quantities: dict[int, int] = {}
    note: str | None = None


class StoreDecline(BaseModel):
    note: str = Field(min_length=3, max_length=500)


class StockCount(BaseModel):
    item_id: int
    counted_quantity: int = Field(ge=0)
    reason: str = Field(min_length=5, max_length=200)
