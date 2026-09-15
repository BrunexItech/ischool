from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.communication import AnnouncementAudience


class AnnouncementCreate(BaseModel):
    title: str
    body: str
    audience: AnnouncementAudience = AnnouncementAudience.ALL
    class_id: int | None = None
    event_date: date | None = None
    event_end_date: date | None = None
    location: str | None = None


class AnnouncementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    title: str
    body: str
    audience: AnnouncementAudience
    class_id: int | None
    event_date: date | None
    event_end_date: date | None
    location: str | None
    created_by: int | None
    created_at: datetime
