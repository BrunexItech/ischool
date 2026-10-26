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


class GuestRequestCreate(BaseModel):
    name: str


class GuestRequestOut(BaseModel):
    request_code: str
    status: str


class GuestStatusOut(BaseModel):
    status: str
    join: JoinTokenOut | None = None


class PendingGuestOut(BaseModel):
    id: int
    name: str
    requested_at: datetime


class JoinRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    kind: str
    joined_at: datetime


class SpeakingSet(BaseModel):
    allowed: bool


class ControlResult(BaseModel):
    affected: int
