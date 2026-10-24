from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.conduct_report import ConductCategory, ConductStatus


class ConductReportCreate(BaseModel):
    student_id: int
    category: ConductCategory
    description: str
    action_taken: str | None = None
    incident_date: date


class ConductReportRespond(BaseModel):
    response: str


class ConductReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    student_id: int
    class_id: int | None
    reported_by: int
    reported_by_name: str
    category: ConductCategory
    description: str
    action_taken: str | None
    incident_date: date
    status: ConductStatus
    response: str | None
    responded_by: int | None
    responded_at: datetime | None
    created_at: datetime
    student_name: str
