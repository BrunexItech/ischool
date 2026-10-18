from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, model_validator

from app.models.calendar_event import CalendarEventType


class CalendarEventCreate(BaseModel):
    title: str
    event_type: CalendarEventType
    start_date: date
    end_date: date | None = None
    description: str | None = None

    @model_validator(mode="after")
    def end_not_before_start(self) -> "CalendarEventCreate":
        if self.end_date is not None and self.end_date < self.start_date:
            raise ValueError("end_date cannot be before start_date")
        return self


class CalendarEventUpdate(BaseModel):
    title: str | None = None
    event_type: CalendarEventType | None = None
    start_date: date | None = None
    end_date: date | None = None
    description: str | None = None


class CalendarEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    title: str
    event_type: CalendarEventType
    start_date: date
    end_date: date | None
    description: str | None
    created_at: datetime
    updated_at: datetime
