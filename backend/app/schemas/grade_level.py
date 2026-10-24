from pydantic import BaseModel, ConfigDict

from app.models.grade_level import LevelGroup


class GradeLevelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    display_name: str
    level_group: LevelGroup
    sort_order: int


class SchoolEnabledGradesUpdate(BaseModel):
    grade_level_ids: list[int]
