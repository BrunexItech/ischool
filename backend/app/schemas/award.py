from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, model_validator

AwardScope = Literal["student", "staff", "class", "school"]


class AwardCreate(BaseModel):
    scope: AwardScope | None = None
    student_id: int | None = None
    staff_user_id: int | None = None
    class_id: int | None = None
    subject_id: int | None = None
    activity_id: int | None = None
    title: str
    description: str | None = None
    category: str | None = None
    date_awarded: date
    notify_guardian: bool = True

    @model_validator(mode="after")
    def recipient_matches_scope(self) -> "AwardCreate":
        given = [name for name in ("student_id", "staff_user_id", "class_id") if getattr(self, name) is not None]
        if self.scope == "school":
            if given:
                raise ValueError("A whole-school award has no individual recipient")
            return self
        if len(given) != 1:
            raise ValueError("Provide exactly one of student_id, staff_user_id or class_id (or scope 'school')")
        inferred = {"student_id": "student", "staff_user_id": "staff", "class_id": "class"}[given[0]]
        if self.scope is not None and self.scope != inferred:
            raise ValueError(f"The recipient given does not match scope '{self.scope}'")
        self.scope = inferred  # type: ignore[assignment]
        return self


class AwardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    scope: str
    student_id: int | None
    staff_user_id: int | None
    class_id: int | None
    subject_id: int | None
    activity_id: int | None
    recipient_name: str
    class_name: str | None
    subject_name: str | None
    title: str
    description: str | None
    category: str | None
    term: str | None
    date_awarded: date
    awarded_by: int | None
    awarded_by_name: str | None
    created_at: datetime
