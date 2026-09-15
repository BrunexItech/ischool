from datetime import date

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
