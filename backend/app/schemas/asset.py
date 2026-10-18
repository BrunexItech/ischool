from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.asset import AssetStatus


class FixedAssetCreate(BaseModel):
    name: str = Field(min_length=3)
    account_id: int
    acquisition_date: date
    cost: float = Field(gt=0)
    residual_value: float = Field(default=0, ge=0)
    useful_life_years: int = Field(gt=0, le=50)


class FixedAssetOut(BaseModel):
    id: int
    code: str
    name: str
    account_id: int
    acquisition_date: date
    cost: float
    residual_value: float
    useful_life_years: int
    accumulated_depreciation: float
    net_book_value: float
    status: AssetStatus

    model_config = {"from_attributes": True}


class DepreciationRunCreate(BaseModel):
    period: str = Field(pattern=r"^\d{4}-\d{2}$")


class DepreciationRunOut(BaseModel):
    id: int
    period: str
    total_amount: float
    created_at: datetime

    model_config = {"from_attributes": True}
