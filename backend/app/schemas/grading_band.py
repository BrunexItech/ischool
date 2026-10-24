from pydantic import BaseModel, ConfigDict


class GradingBandIn(BaseModel):
    level_code: str
    label: str
    min_score: float
    max_score: float
    points: int


class GradingBandsUpdate(BaseModel):
    bands: list[GradingBandIn]


class GradingBandOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    level_code: str
    label: str
    min_score: float
    max_score: float
    points: int
    sort_order: int
