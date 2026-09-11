from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.live_classes import LiveClassStatus


class LiveClassCreate(BaseModel):
    title: str
    scheduled_start: datetime
    class_id: int | None = None


class LiveClassOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    class_id: int | None
    title: str
    scheduled_start: datetime
    status: LiveClassStatus
    join_code: str


class JoinTokenOut(BaseModel):
    token: str
    url: str
    room_name: str
    class_title: str
