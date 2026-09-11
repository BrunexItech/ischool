from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.communication import AnnouncementAudience


class AnnouncementCreate(BaseModel):
    title: str
    body: str
    audience: AnnouncementAudience = AnnouncementAudience.ALL
    class_id: int | None = None


class AnnouncementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    title: str
    body: str
    audience: AnnouncementAudience
    class_id: int | None
    created_by: int | None
    created_at: datetime
