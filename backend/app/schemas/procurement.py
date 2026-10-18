from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.procurement import PurchaseOrderStatus, RequisitionStatus


class RequisitionCreate(BaseModel):
    department: str
    account_id: int
    description: str = Field(min_length=3)
    quantity: int = Field(gt=0)
    unit_cost: float = Field(gt=0)


class RequisitionOut(BaseModel):
    id: int
    reference: str
    department: str
    account_id: int
    description: str
    quantity: int
    unit_cost: float
    total: float
    status: RequisitionStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class PurchaseOrderCreate(BaseModel):
    requisition_id: int
    supplier_id: int
    delivery_date: date


class PurchaseOrderOut(BaseModel):
    id: int
    reference: str
    requisition_id: int
    supplier_id: int
    delivery_date: date
    total: float
    status: PurchaseOrderStatus
    created_at: datetime

    model_config = {"from_attributes": True}
