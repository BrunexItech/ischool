from datetime import time

from pydantic import BaseModel, ConfigDict


class VehicleCreate(BaseModel):
    registration_number: str
    capacity: int
    driver_name: str
    driver_phone: str


class VehicleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    registration_number: str
    capacity: int
    driver_name: str
    driver_phone: str
    is_active: bool


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


class TransportRouteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    school_id: int
    vehicle_id: int | None
    name: str
    description: str | None
    stops: list[RouteStopOut] = []


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
