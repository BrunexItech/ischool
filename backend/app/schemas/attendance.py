from datetime import date

from pydantic import BaseModel, ConfigDict

from app.models.attendance import AttendanceStatus


class AttendanceEntry(BaseModel):
    student_id: int
    status: AttendanceStatus


class AttendanceMarkRequest(BaseModel):
    class_id: int
    date: date
    records: list[AttendanceEntry]


class AttendanceRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    class_id: int
    student_id: int
    date: date
    status: AttendanceStatus
    recorded_by: int | None
