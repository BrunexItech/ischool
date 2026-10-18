from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.lead import LeadStage


class LeadCreate(BaseModel):
    child_name: str
    grade_interested: str | None = None
    guardian_name: str
    guardian_phone: str | None = None
    guardian_email: str | None = None
    source: str | None = None
    notes: str | None = None


class LeadUpdate(BaseModel):
    child_name: str | None = None
    grade_interested: str | None = None
    guardian_name: str | None = None
    guardian_phone: str | None = None
    guardian_email: str | None = None
    source: str | None = None
    stage: LeadStage | None = None
    notes: str | None = None


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    child_name: str
    grade_interested: str | None
    guardian_name: str
    guardian_phone: str | None
    guardian_email: str | None
    source: str | None
    stage: LeadStage
    notes: str | None
    student_id: int | None
    created_at: datetime
    updated_at: datetime
