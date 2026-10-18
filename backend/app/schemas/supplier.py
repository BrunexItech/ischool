import re
from datetime import date, datetime

from pydantic import BaseModel, field_validator

KRA_PIN_RE = re.compile(r"^[AP]\d{9}[A-Z]$")


class SupplierCreate(BaseModel):
    name: str
    kra_pin: str
    category: str
    phone: str
    email: str
    bank_account: str | None = None
    etims_registered: bool = False

    @field_validator("kra_pin")
    @classmethod
    def valid_pin(cls, v: str) -> str:
        v = v.upper()
        if not KRA_PIN_RE.match(v):
            raise ValueError("KRA PINs look like P051234567X")
        return v


class SupplierUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    phone: str | None = None
    email: str | None = None
    bank_account: str | None = None
    etims_registered: bool | None = None
    is_active: bool | None = None


class SupplierOut(BaseModel):
    id: int
    name: str
    kra_pin: str
    category: str
    phone: str
    email: str
    bank_account: str | None
    etims_registered: bool
    is_active: bool
    since: date
    created_at: datetime

    model_config = {"from_attributes": True}
