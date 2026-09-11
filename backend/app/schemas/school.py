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


class SchoolBrandingUpdate(BaseModel):
    name: str | None = None
    logo_url: str | None = None
    primary_color: str | None = None
    secondary_color: str | None = None
    custom_domain: str | None = None


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
