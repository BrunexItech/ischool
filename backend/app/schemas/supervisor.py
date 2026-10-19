from pydantic import BaseModel, ConfigDict

from app.schemas.dashboard import GroupBranchSummary


class SupervisorCreate(BaseModel):
    email: str
    full_name: str
    password: str


class LinkedSchoolOut(BaseModel):
    id: int
    name: str


class SupervisorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    is_active: bool


class SupervisorWithSchoolsOut(SupervisorOut):
    schools: list[LinkedSchoolOut]


class SupervisorLinkCreate(BaseModel):
    school_id: int


class SupervisorOverviewOut(BaseModel):
    schools: list[GroupBranchSummary]
    total_students: int
    total_active_staff: int
