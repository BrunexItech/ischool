from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.academics import Student
from app.models.transport import RouteStop, TransportRoute, Vehicle
from app.models.user import User, UserRole
from app.schemas.transport import (
    VehicleUpdate,
    RouteStopCreate,
    StudentTransportAssignment,
    TransportRouteCreate,
    TransportRouteOut,
    VehicleCreate,
    VehicleOut,
)

router = APIRouter(prefix="/schools/{school_id}/transport", tags=["transport"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.TEACHER, UserRole.STAFF, UserRole.TRANSPORT_STAFF, UserRole.TRANSPORT_ATTENDANT)
ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.TRANSPORT_STAFF)


def _vehicle_out(db: Session, v: Vehicle) -> VehicleOut:
    learners = (
        db.query(Student.id)
        .join(TransportRoute, Student.transport_route_id == TransportRoute.id)
        .filter(TransportRoute.vehicle_id == v.id, Student.is_active.is_(True))
        .count()
    )
    out = VehicleOut.model_validate(v)
    out.attendant_name = v.attendant.full_name if v.attendant else None
    out.assigned_learners = learners
    return out


def _route_out(db: Session, r: TransportRoute) -> TransportRouteOut:
    out = TransportRouteOut.model_validate(r)
    out.learners = db.query(Student.id).filter_by(school_id=r.school_id, transport_route_id=r.id, is_active=True).count()
    return out


def _check_attendant(db: Session, school_id: int, user_id: int | None) -> None:
    if user_id is None:
        return
    ok = db.query(User.id).filter_by(id=user_id, school_id=school_id, role=UserRole.TRANSPORT_ATTENDANT, is_active=True).first()
    if ok is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That person is not a transport attendant at this school")


@router.get(
    "/attendants",
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("transport"))],
)
def list_attendants(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Transport attendants, for choosing who rides on each vehicle."""
    ensure_school_access(db, current_user, school_id)
    rows = db.query(User).filter_by(school_id=school_id, role=UserRole.TRANSPORT_ATTENDANT, is_active=True).order_by(User.full_name).all()
    return [{"user_id": u.id, "full_name": u.full_name} for u in rows]


# --- Vehicles ---


@router.get(
    "/vehicles",
    response_model=list[VehicleOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("transport"))],
)
def list_vehicles(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return [_vehicle_out(db, v) for v in db.query(Vehicle).filter_by(school_id=school_id).order_by(Vehicle.registration_number).all()]


@router.post(
    "/vehicles",
    response_model=VehicleOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("transport"))],
)
def create_vehicle(
    school_id: int, payload: VehicleCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    if db.query(Vehicle).filter_by(school_id=school_id, registration_number=payload.registration_number).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A vehicle with that registration number already exists")

    _check_attendant(db, school_id, payload.attendant_user_id)
    vehicle = Vehicle(school_id=school_id, **payload.model_dump())
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return _vehicle_out(db, vehicle)


@router.patch(
    "/vehicles/{vehicle_id}",
    response_model=VehicleOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("transport"))],
)
def update_vehicle(school_id: int, vehicle_id: int, payload: VehicleUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    vehicle = db.query(Vehicle).filter_by(school_id=school_id, id=vehicle_id).first()
    if vehicle is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vehicle not found")
    changes = payload.model_dump(exclude_unset=True)
    if "attendant_user_id" in changes:
        _check_attendant(db, school_id, changes["attendant_user_id"])
    for field, value in changes.items():
        setattr(vehicle, field, value)
    db.commit()
    db.refresh(vehicle)
    return _vehicle_out(db, vehicle)


# --- Routes & stops ---


@router.get(
    "/routes",
    response_model=list[TransportRouteOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("transport"))],
)
def list_routes(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return [_route_out(db, r) for r in db.query(TransportRoute).filter_by(school_id=school_id).order_by(TransportRoute.name).all()]


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
    ensure_school_access(db, current_user, school_id)
    if db.query(TransportRoute).filter_by(school_id=school_id, name=payload.name).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A route with that name already exists")

    route = TransportRoute(school_id=school_id, **payload.model_dump())
    db.add(route)
    db.commit()
    db.refresh(route)
    return _route_out(db, route)


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
    ensure_school_access(db, current_user, school_id)
    route = db.query(TransportRoute).filter_by(school_id=school_id, id=route_id).first()
    if route is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Route not found")

    stop = RouteStop(route_id=route.id, **payload.model_dump())
    db.add(stop)
    db.commit()
    db.refresh(route)
    return _route_out(db, route)


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
    ensure_school_access(db, current_user, school_id)
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
