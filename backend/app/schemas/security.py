from datetime import datetime

from pydantic import BaseModel, Field

from app.models.security import IncidentSeverity, SecurityIncidentStatus, VehicleDirection


class VisitorSignIn(BaseModel):
    name: str
    id_number: str = Field(min_length=6, max_length=20)
    phone: str
    purpose: str
    host_name: str
    vehicle_registration: str | None = None


class VisitorOut(BaseModel):
    id: int
    badge: str
    name: str
    id_number_masked: str
    phone: str
    purpose: str
    host_name: str
    vehicle_registration: str | None
    signed_in_at: datetime
    signed_out_at: datetime | None

    model_config = {"from_attributes": True}


class VehicleLogCreate(BaseModel):
    registration: str
    direction: VehicleDirection
    driver_name: str
    purpose: str


class VehicleLogOut(BaseModel):
    id: int
    registration: str
    direction: VehicleDirection
    driver_name: str
    purpose: str
    logged_at: datetime

    model_config = {"from_attributes": True}


class EarlyPickupCreate(BaseModel):
    student_id: int
    collected_by: str
    relation: str
    reason: str
    verified: bool = True
    note: str | None = None


class EarlyPickupOut(BaseModel):
    id: int
    student_id: int
    collected_by: str
    relation: str
    reason: str
    verified: bool
    note: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SecurityIncidentCreate(BaseModel):
    type: str
    location: str
    severity: IncidentSeverity = IncidentSeverity.LOW
    description: str = Field(min_length=15)
    action_taken: str = Field(min_length=5)


class SecurityIncidentOut(BaseModel):
    id: int
    type: str
    location: str
    severity: IncidentSeverity
    description: str
    action_taken: str
    status: SecurityIncidentStatus
    created_at: datetime

    model_config = {"from_attributes": True}


class SecurityAlertCreate(BaseModel):
    type: str
    message: str = Field(min_length=10)
    sms_parents: bool = False


class SecurityAlertOut(BaseModel):
    id: int
    type: str
    message: str
    active: bool
    sms_parents: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PatrolLogCreate(BaseModel):
    post: str
    ok: bool = True
    note: str = Field(min_length=3)


class PatrolLogOut(BaseModel):
    id: int
    post: str
    ok: bool
    note: str
    created_at: datetime

    model_config = {"from_attributes": True}
