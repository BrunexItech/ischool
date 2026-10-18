from datetime import datetime

from pydantic import BaseModel, Field

from app.models.payroll import EmploymentType, PayRunStatus


class PayrollProfileCreate(BaseModel):
    user_id: int
    employment_type: EmploymentType
    basic_salary: float = Field(gt=0)
    house_allowance: float = Field(default=0, ge=0)
    transport_allowance: float = Field(default=0, ge=0)
    kra_pin: str
    nssf_number: str
    bank_name: str | None = None
    bank_account: str | None = None


class PayrollProfileUpdate(BaseModel):
    basic_salary: float | None = Field(default=None, gt=0)
    house_allowance: float | None = Field(default=None, ge=0)
    transport_allowance: float | None = Field(default=None, ge=0)
    is_active: bool | None = None


class PayrollProfileOut(BaseModel):
    id: int
    user_id: int
    staff_name: str
    employment_type: EmploymentType
    basic_salary: float
    house_allowance: float
    transport_allowance: float
    kra_pin: str
    nssf_number: str
    is_active: bool


class PayRunCreate(BaseModel):
    period: str = Field(pattern=r"^\d{4}-\d{2}$")


class PayslipLineOut(BaseModel):
    id: int
    user_id: int
    staff_name: str
    employment_type: EmploymentType
    basic: float
    house: float
    transport: float
    gross: float
    nssf: float
    shif: float
    ahl: float
    paye: float
    net: float

    model_config = {"from_attributes": True}


class PayRunOut(BaseModel):
    id: int
    period: str
    status: PayRunStatus
    created_at: datetime
    lines: list[PayslipLineOut]

    model_config = {"from_attributes": True}
