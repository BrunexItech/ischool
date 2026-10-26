from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict


class StaffClockInRequest(BaseModel):
    note: str | None = None


class AttendanceQrCodeOut(BaseModel):
    token: str


class AttendanceQrScanRequest(BaseModel):
    token: str


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


class AttendanceQrScanResult(BaseModel):
    action: str  # "clocked_in" or "clocked_out"
    record: StaffAttendanceOut


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


# --- Expected-staff attendance ---

from datetime import date as _date, time as _time  # noqa: E402
from typing import Literal  # noqa: E402

LeaveType = Literal["annual", "sick", "maternity", "paternity", "study", "official_duty", "compassionate", "other"]
AbsenceReason = Literal["sick", "official_duty", "family_matter", "other"]
DayStatus = Literal["present", "late", "absent", "on_leave", "expected"]


class StaffSettingsOut(BaseModel):
    late_after: _time
    absent_after: _time


class StaffSettingsUpdate(BaseModel):
    late_after: _time
    absent_after: _time


class StaffDayRow(BaseModel):
    user_id: int
    name: str
    role: str
    status: DayStatus
    source: str | None
    clocked_in_at: datetime | None
    clocked_out_at: datetime | None
    leave_type: str | None
    reason: str | None
    note: str | None
    lessons: int
    register_status: Literal["self", "other", "missing"] | None


class StaffDayOut(BaseModel):
    date: _date
    school_day: bool
    holiday: str | None
    rows: list[StaffDayRow]


class StaffSummaryRow(BaseModel):
    user_id: int
    name: str
    role: str
    school_days: int
    present: int
    late: int
    absent_explained: int
    absent_unexplained: int
    on_leave: int


class StaffSummaryOut(BaseModel):
    date_from: _date
    date_to: _date
    school_days: int
    rows: list[StaffSummaryRow]


class LeaveCreate(BaseModel):
    user_id: int
    start_date: _date
    end_date: _date
    leave_type: LeaveType
    note: str | None = None


class LeaveOut(BaseModel):
    id: int
    user_id: int
    staff_name: str
    start_date: _date
    end_date: _date
    leave_type: str
    note: str | None
    recorded_by_name: str | None


class AbsenceNoteSet(BaseModel):
    user_id: int
    date: _date
    reason: AbsenceReason
    note: str | None = None


class TrackingSet(BaseModel):
    user_id: int
    tracked: bool


class StaffPersonOut(BaseModel):
    user_id: int
    name: str
    role: str
    tracked: bool
