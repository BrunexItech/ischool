from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.pickup_dropoff import PickupDropoffType


class PickupDropoffCreate(BaseModel):
    event_type: PickupDropoffType
    person_name: str
    notes: str | None = None
    occurred_at: datetime | None = None  # defaults to now if omitted


class PickupDropoffOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    student_id: int
    event_type: PickupDropoffType
    person_name: str
    notes: str | None
    occurred_at: datetime
