from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict


class StaffClockInRequest(BaseModel):
    note: str | None = None


class StaffAttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    user_id: int
    date: date
    clocked_in_at: datetime | None
    clocked_out_at: datetime | None
    note: str | None


class StaffAttendanceWithNameOut(StaffAttendanceOut):
    staff_name: str


class DutyAssignmentCreate(BaseModel):
    user_id: int
    title: str
    date: date
    start_time: time | None = None
    end_time: time | None = None
    notes: str | None = None


class DutyAssignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    user_id: int
    title: str
    date: date
    start_time: time | None
    end_time: time | None
    notes: str | None
    assigned_by: int | None


class DutyAssignmentWithNameOut(DutyAssignmentOut):
    staff_name: str
