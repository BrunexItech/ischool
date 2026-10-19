from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SchoolCreate(BaseModel):
    name: str
    slug: str
    country: str = "Kenya"
    currency: str = "KES"
    timezone: str = "Africa/Nairobi"
    admin_email: str
    admin_full_name: str
    admin_password: str
    parent_school_id: int | None = None


class SchoolBrandingUpdate(BaseModel):
    name: str | None = None
    logo_url: str | None = None
    primary_color: str | None = None
    secondary_color: str | None = None
    custom_domain: str | None = None
    expense_approval_threshold: float | None = None


class SchoolOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    custom_domain: str | None
    logo_url: str | None
    primary_color: str
    secondary_color: str
    country: str
    currency: str
    timezone: str
    is_active: bool
    parent_school_id: int | None
    branch_count: int
    expense_approval_threshold: float
    plan_id: int | None
    subscription_status: str
    trial_ends_at: datetime


class SchoolPublicOut(BaseModel):
    """What an unauthenticated frontend needs to render a tenant's branding by slug/domain."""

    model_config = ConfigDict(from_attributes=True)

    name: str
    slug: str
    logo_url: str | None
    primary_color: str
    secondary_color: str


class ModuleToggleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    module_key: str
    enabled: bool


class ModuleToggleUpdate(BaseModel):
    enabled: bool


class PlatformOverviewOut(BaseModel):
    """Aggregated, platform-wide numbers for the super-admin — every school
    rolled into one glance, distinct from any single school's own numbers."""

    total_schools: int
    total_students: int
    total_teachers: int
    total_active_staff: int
    total_amount_billed: float
    total_amount_paid: float
    overall_fee_collection_rate: float
