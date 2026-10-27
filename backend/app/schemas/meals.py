from datetime import date, time

from pydantic import BaseModel, ConfigDict, Field


class MealMenuCreate(BaseModel):
    date: date
    meal_type: str = Field(pattern="^(breakfast|lunch|snack)$")
    description: str


class MealMenuUpdate(BaseModel):
    description: str


class MealMenuOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    date: date
    meal_type: str
    description: str


class MenuSlotIn(BaseModel):
    name: str
    start_time: time
    end_time: time
    audience: str = "all"
    items: dict[str, str] = {}      # weekday ("0" = Monday) -> what is served


class MenuSlotOut(MenuSlotIn):
    id: int
    position: int


class WeeklyMenuIn(BaseModel):
    slots: list[MenuSlotIn]


class WeeklyMenuOut(BaseModel):
    slots: list[MenuSlotOut]


class MenuSaveResult(BaseModel):
    applied: bool
    request_id: int | None = None
    message: str
