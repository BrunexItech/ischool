from datetime import datetime

from pydantic import BaseModel


class AuditLogOut(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: int
    actor_name: str | None
    before: dict | None
    after: dict | None
    created_at: datetime
