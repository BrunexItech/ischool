from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.complaint import ComplaintAudience, ComplaintStatus


class ComplaintCreate(BaseModel):
    audience: ComplaintAudience
    subject: str
    message: str
    student_id: int | None = None
    """Required when a parent raises it, so we can resolve the child's class."""


class ComplaintRespond(BaseModel):
    response: str


class ComplaintOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    raised_by: int
    raised_by_name: str
    raised_by_role: str
    audience: ComplaintAudience
    class_id: int | None
    subject: str
    message: str
    status: ComplaintStatus
    response: str | None
    responded_by: int | None
    responded_at: datetime | None
    created_at: datetime
