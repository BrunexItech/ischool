from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict


class VehicleCreate(BaseModel):
    registration_number: str
    capacity: int
    driver_name: str
    driver_phone: str
    vehicle_type: str = "bus"
    make_model: str | None = None
    insurance_expiry: date | None = None
    inspection_expiry: date | None = None
    next_service_date: date | None = None
    attendant_user_id: int | None = None
    notes: str | None = None


class VehicleUpdate(BaseModel):
    capacity: int | None = None
    driver_name: str | None = None
    driver_phone: str | None = None
    vehicle_type: str | None = None
    make_model: str | None = None
    insurance_expiry: date | None = None
    inspection_expiry: date | None = None
    next_service_date: date | None = None
    attendant_user_id: int | None = None
    notes: str | None = None
    is_active: bool | None = None


class VehicleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    registration_number: str
    capacity: int
    driver_name: str
    driver_phone: str
    is_active: bool
    vehicle_type: str = "bus"
    make_model: str | None = None
    insurance_expiry: date | None = None
    inspection_expiry: date | None = None
    next_service_date: date | None = None
    attendant_user_id: int | None = None
    attendant_name: str | None = None
    notes: str | None = None
    assigned_learners: int = 0


class RouteStopCreate(BaseModel):
    name: str
    stop_order: int
    pickup_time: time | None = None


class RouteStopOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    route_id: int
    name: str
    stop_order: int
    pickup_time: time | None


class TransportRouteCreate(BaseModel):
    name: str
    description: str | None = None
    vehicle_id: int | None = None
    school_arrival_time: time | None = None
    afternoon_departure_time: time | None = None


class TransportRouteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    vehicle_id: int | None
    name: str
    description: str | None
    school_arrival_time: time | None = None
    afternoon_departure_time: time | None = None
    stops: list[RouteStopOut] = []
    learners: int = 0


class StudentTransportAssignment(BaseModel):
    transport_route_id: int | None = None
    transport_stop_id: int | None = None


class StudentTransportOut(BaseModel):
    assigned: bool
    route_name: str | None = None
    stop_name: str | None = None
    pickup_time: time | None = None
    vehicle_registration: str | None = None
    driver_name: str | None = None
    driver_phone: str | None = None


class RunSummary(BaseModel):
    route_id: int
    route_name: str
    direction: str
    vehicle_registration: str | None
    driver_name: str | None
    attendant_name: str | None
    run_id: int | None
    status: str                     # not_started | in_progress | completed
    expected: int
    pending: int
    boarded: int
    dropped: int
    absent: int
    started_at: datetime | None
    completed_at: datetime | None
    due_time: time | None


class ManifestRow(BaseModel):
    student_id: int
    name: str
    class_name: str | None
    admission_number: str
    stop_name: str | None
    stop_time: time | None
    guardian_phone: str | None
    status: str
    boarded_at: datetime | None
    dropped_at: datetime | None
    handed_to: str | None
    note: str | None


class RunDetail(BaseModel):
    summary: RunSummary
    rows: list[ManifestRow]


class RunStart(BaseModel):
    route_id: int
    direction: str


class BoardingUpdate(BaseModel):
    status: str                     # boarded | dropped | absent | pending
    handed_to: str | None = None
    note: str | None = None


class RunComplete(BaseModel):
    note: str | None = None
