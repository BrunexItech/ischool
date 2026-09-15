from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.academics import Student
from app.models.transport import RouteStop, TransportRoute, Vehicle
from app.models.user import User, UserRole
from app.schemas.transport import (
    RouteStopCreate,
    StudentTransportAssignment,
    TransportRouteCreate,
    TransportRouteOut,
    VehicleCreate,
    VehicleOut,
)

router = APIRouter(prefix="/schools/{school_id}/transport", tags=["transport"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER, UserRole.STAFF)
ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)


# --- Vehicles ---


@router.get(
    "/vehicles",
    response_model=list[VehicleOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("transport"))],
)
def list_vehicles(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(current_user, school_id)
    return db.query(Vehicle).filter_by(school_id=school_id).all()


@router.post(
    "/vehicles",
    response_model=VehicleOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("transport"))],
)
def create_vehicle(
    school_id: int, payload: VehicleCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(current_user, school_id)
    if db.query(Vehicle).filter_by(school_id=school_id, registration_number=payload.registration_number).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A vehicle with that registration number already exists")

    vehicle = Vehicle(school_id=school_id, **payload.model_dump())
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


# --- Routes & stops ---


@router.get(
    "/routes",
    response_model=list[TransportRouteOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("transport"))],
)
def list_routes(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(current_user, school_id)
    return db.query(TransportRoute).filter_by(school_id=school_id).all()


@router.post(
    "/routes",
    response_model=TransportRouteOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("transport"))],
)
def create_route(
    school_id: int,
    payload: TransportRouteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)
    if db.query(TransportRoute).filter_by(school_id=school_id, name=payload.name).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A route with that name already exists")

    route = TransportRoute(school_id=school_id, **payload.model_dump())
    db.add(route)
    db.commit()
    db.refresh(route)
    return route


@router.post(
    "/routes/{route_id}/stops",
    response_model=TransportRouteOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("transport"))],
)
def add_stop(
    school_id: int,
    route_id: int,
    payload: RouteStopCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)
    route = db.query(TransportRoute).filter_by(school_id=school_id, id=route_id).first()
    if route is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Route not found")

    stop = RouteStop(route_id=route.id, **payload.model_dump())
    db.add(stop)
    db.commit()
    db.refresh(route)
    return route


# --- Student assignment ---


@router.patch(
    "/students/{student_id}/assignment",
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("transport"))],
)
def assign_student_transport(
    school_id: int,
    student_id: int,
    payload: StudentTransportAssignment,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)
    student = db.query(Student).filter_by(school_id=school_id, id=student_id).first()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")

    if payload.transport_route_id is not None:
        route = db.query(TransportRoute).filter_by(school_id=school_id, id=payload.transport_route_id).first()
        if route is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That route does not belong to this school")
    if payload.transport_stop_id is not None:
        stop = db.query(RouteStop).filter_by(id=payload.transport_stop_id).first()
        if stop is None or stop.route_id != payload.transport_route_id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That stop does not belong to the selected route")

    student.transport_route_id = payload.transport_route_id
    student.transport_stop_id = payload.transport_stop_id
    db.commit()
    return {"message": "Transport assignment updated"}
