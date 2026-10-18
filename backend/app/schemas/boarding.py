from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator

from app.models.boarding import ExeatStatus, IncidentStatus, RollSession, SickBayAction


class BoardingHouseCreate(BaseModel):
    name: str
    gender: str
    total_beds: int = Field(gt=0)


class BoardingHouseOut(BaseModel):
    id: int
    school_id: int
    name: str
    gender: str
    total_beds: int
    occupied_beds: int = 0

    model_config = {"from_attributes": True}


class BoardingAssignmentCreate(BaseModel):
    student_id: int
    house_id: int
    bed_number: str


class BoardingAssignmentOut(BaseModel):
    id: int
    student_id: int
    house_id: int
    bed_number: str
    assigned_at: datetime

    model_config = {"from_attributes": True}


class RollCallSubmit(BaseModel):
    house_id: int
    date: date
    session: RollSession
    marks: dict[str, str]

    @model_validator(mode="after")
    def valid_marks(self):
        for v in self.marks.values():
            if v not in ("P", "A", "S"):
                raise ValueError("Each mark must be P (present), A (absent) or S (sick bay)")
        return self


class RollCallOut(BaseModel):
    id: int
    house_id: int
    date: date
    session: RollSession
    marks: dict[str, str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ExeatCreate(BaseModel):
    student_id: int
    from_date: date
    to_date: date
    reason: str
    detail: str | None = None
    pickup_name: str
    pickup_relation: str | None = None
    pickup_phone: str | None = None

    @model_validator(mode="after")
    def to_not_before_from(self):
        if self.to_date < self.from_date:
            raise ValueError("to_date cannot be before from_date")
        return self


class ExeatOut(BaseModel):
    id: int
    student_id: int
    from_date: date
    to_date: date
    reason: str
    detail: str | None
    pickup_name: str
    pickup_relation: str | None
    pickup_phone: str | None
    status: ExeatStatus
    gate_pass: str | None
    out_at: datetime | None
    back_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SickBayVisitCreate(BaseModel):
    student_id: int
    complaint: str
    temperature: float | None = None
    action: SickBayAction
    parent_notified: bool = True


class SickBayVisitOut(BaseModel):
    id: int
    student_id: int
    complaint: str
    temperature: float | None
    action: SickBayAction
    status: str
    parent_notified: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class BoardingIncidentCreate(BaseModel):
    house_id: int
    type: str
    description: str = Field(min_length=15)
    action_taken: str = Field(min_length=5)


class BoardingIncidentOut(BaseModel):
    id: int
    house_id: int
    type: str
    description: str
    action_taken: str
    status: IncidentStatus
    created_at: datetime

    model_config = {"from_attributes": True}
