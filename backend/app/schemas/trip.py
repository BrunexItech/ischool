from datetime import date, datetime, time

from pydantic import BaseModel, Field, model_validator

from app.models.trip import TripStatus


class TripCreate(BaseModel):
    title: str = Field(min_length=5)
    trip_type: str
    purpose: str = Field(min_length=15)
    destination: str = Field(min_length=3)
    start_date: date
    end_date: date
    departure_time: time
    return_time: time
    class_ids: list[int] = Field(default_factory=list)
    student_ids: list[int] = Field(min_length=1)
    staff_count: int = Field(ge=1)
    distance_km: int = Field(ge=1, le=1500)

    @model_validator(mode="after")
    def valid_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        if (self.end_date - self.start_date).days > 6:
            raise ValueError("Trips can last up to 7 days")
        return self


class TripApprove(BaseModel):
    vehicle_id: int | None = None


class TripOut(BaseModel):
    id: int
    reference: str
    title: str
    trip_type: str
    purpose: str
    destination: str
    start_date: date
    end_date: date
    departure_time: time
    return_time: time
    class_ids: list[int]
    student_ids: list[int]
    staff_count: int
    distance_km: int
    estimated_cost: float
    vehicle_id: int | None
    status: TripStatus
    created_at: datetime

    model_config = {"from_attributes": True}
