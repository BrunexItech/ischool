from datetime import time

from pydantic import BaseModel, ConfigDict, model_validator


class TimetableSlotCreate(BaseModel):
    class_id: int
    subject_id: int
    teacher_user_id: int | None = None
    day_of_week: int
    start_time: time
    end_time: time
    room: str | None = None

    @model_validator(mode="after")
    def valid_window(self) -> "TimetableSlotCreate":
        if not (0 <= self.day_of_week <= 6):
            raise ValueError("day_of_week must be between 0 (Monday) and 6 (Sunday)")
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


class TimetableSlotDetailOut(TimetableSlotOut):
    class_name: str
    subject_name: str
    teacher_name: str | None


class MyTimetableSlotOut(TimetableSlotOut):
    class_name: str
    subject_name: str
