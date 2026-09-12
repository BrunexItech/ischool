from datetime import date

from pydantic import BaseModel, ConfigDict


class AcademicTermCreate(BaseModel):
    name: str
    start_date: date | None = None
    end_date: date | None = None


class AcademicTermOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    name: str
    start_date: date | None
    end_date: date | None
    is_current: bool
