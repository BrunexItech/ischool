from datetime import datetime

from pydantic import BaseModel


class FeedbackCreate(BaseModel):
    recipient_user_id: int
    topic: str
    link: str | None = None
    message: str


class FeedbackReply(BaseModel):
    reply: str | None = None


class FeedbackOut(BaseModel):
    id: int
    recipient_user_id: int
    recipient_name: str
    author_name: str | None
    topic: str
    link: str | None
    message: str
    status: str
    reply: str | None
    acknowledged_at: datetime | None
    created_at: datetime
