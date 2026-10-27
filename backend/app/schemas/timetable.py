from datetime import time

from pydantic import BaseModel, ConfigDict, model_validator


class TimetableSlotCreate(BaseModel):
    class_id: int
    subject_id: int
    teacher_user_id: int | None = None
    day_of_week: int
    # Either a block of the school day (the times come from it), or explicit
    # times for a school that has not set its day up.
    period_id: int | None = None
    start_time: time | None = None
    end_time: time | None = None
    room: str | None = None

    @model_validator(mode="after")
    def valid_window(self) -> "TimetableSlotCreate":
        if not (0 <= self.day_of_week <= 6):
            raise ValueError("day_of_week must be between 0 (Monday) and 6 (Sunday)")
        if self.period_id is None:
            if self.start_time is None or self.end_time is None:
                raise ValueError("Choose a lesson period")
            if self.end_time <= self.start_time:
                raise ValueError("end_time must be after start_time")
        return self


class TimetableSlotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    class_id: int
    subject_id: int
    teacher_user_id: int | None
    day_of_week: int
    start_time: time
    end_time: time
    room: str | None
    period_id: int | None = None


class TimetableSlotDetailOut(TimetableSlotOut):
    class_name: str
    subject_name: str
    teacher_name: str | None


class MyTimetableSlotOut(TimetableSlotOut):
    class_name: str
    subject_name: str


class PeriodIn(BaseModel):
    name: str
    kind: str
    start_time: time
    end_time: time
    days: list[int] = [0, 1, 2, 3, 4]


class PeriodOut(PeriodIn):
    model_config = ConfigDict(from_attributes=True)

    id: int
    level_group: str
    position: int


class DayIn(BaseModel):
    periods: list[PeriodIn]


class DayResult(BaseModel):
    applied: bool
    request_id: int | None = None
    message: str
