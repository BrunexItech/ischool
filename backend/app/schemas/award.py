from datetime import date

from pydantic import BaseModel, ConfigDict, model_validator


class AwardCreate(BaseModel):
    student_id: int | None = None
    staff_user_id: int | None = None
    title: str
    description: str | None = None
    category: str | None = None
    date_awarded: date

    @model_validator(mode="after")
    def exactly_one_recipient(self) -> "AwardCreate":
        if (self.student_id is None) == (self.staff_user_id is None):
            raise ValueError("Provide exactly one of student_id or staff_user_id")
        return self


class AwardOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    student_id: int | None
    staff_user_id: int | None
    recipient_name: str
    title: str
    description: str | None
    category: str | None
    date_awarded: date
