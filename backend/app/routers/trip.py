import math

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.awards import teacher_class_ids
from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.transport import Vehicle
from app.models.trip import Trip, TripStatus
from app.models.academics import Student
from app.models.user import User, UserRole
from app.schemas.trip import TripApprove, TripCreate, TripOut

router = APIRouter(prefix="/schools/{school_id}/trips", tags=["trips"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.TEACHER, UserRole.STAFF, UserRole.SECRETARY)
REQUEST_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.TEACHER, UserRole.SECRETARY)
ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL)

COST_PER_KM = 150
BASE_ALLOWANCE = 5000


def _estimate_cost(distance_km: int, nights: int) -> float:
    return distance_km * 2 * COST_PER_KM + BASE_ALLOWANCE + nights * 3000


def _trip_or_404(db: Session, school_id: int, trip_id: int) -> Trip:
    trip = db.query(Trip).filter_by(school_id=school_id, id=trip_id).first()
    if trip is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Trip not found")
    return trip


@router.get(
    "",
    response_model=list[TripOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("trips"))],
)
def list_trips(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Leadership sees every trip; a teacher sees the trips they asked for."""
    ensure_school_access(db, current_user, school_id)
    query = db.query(Trip).filter_by(school_id=school_id)
    if current_user.role == UserRole.TEACHER:
        query = query.filter(Trip.requested_by == current_user.id)
    return query.order_by(Trip.created_at.desc()).all()


@router.post(
    "",
    response_model=TripOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*REQUEST_ROLES)), Depends(require_feature("trips"))],
)
def request_trip(
    school_id: int, payload: TripCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)

    if current_user.role == UserRole.TEACHER:
        allowed = teacher_class_ids(db, school_id, current_user)
        classes = {cid for (cid,) in db.query(Student.class_id).filter(Student.school_id == school_id, Student.id.in_(payload.student_ids))}
        found = db.query(Student.id).filter(Student.school_id == school_id, Student.id.in_(payload.student_ids)).count()
        if found != len(set(payload.student_ids)) or not classes <= allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You can only take learners from classes you teach")

    needed_staff = math.ceil(len(payload.student_ids) / 15)
    if payload.staff_count < needed_staff:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"{len(payload.student_ids)} learners need at least {needed_staff} adults (1 per 15)",
        )
    if payload.end_date > payload.start_date and payload.staff_count < 2:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Overnight trips need at least 2 adults")

    count = db.query(Trip).filter_by(school_id=school_id).count()
    nights = (payload.end_date - payload.start_date).days
    trip = Trip(
        school_id=school_id,
        reference=f"TRP-{payload.start_date.year}-{count + 1:04d}",
        requested_by=current_user.id,
        estimated_cost=_estimate_cost(payload.distance_km, nights),
        **payload.model_dump(),
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


@router.post(
    "/{trip_id}/approve",
    response_model=TripOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("trips"))],
)
def approve_trip(
    school_id: int, trip_id: int, payload: TripApprove, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    trip = _trip_or_404(db, school_id, trip_id)
    if trip.status != TripStatus.REQUESTED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only a requested trip can be approved")

    if payload.vehicle_id is not None:
        vehicle = db.query(Vehicle).filter_by(school_id=school_id, id=payload.vehicle_id).first()
        if vehicle is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Vehicle not found")
        if not vehicle.is_active:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{vehicle.registration_number} is not active")
        party = len(trip.student_ids) + trip.staff_count
        if vehicle.capacity < party:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{vehicle.registration_number} has {vehicle.capacity} seats; this party is {party}")

        clash = (
            db.query(Trip)
            .filter(
                Trip.school_id == school_id,
                Trip.id != trip_id,
                Trip.vehicle_id == payload.vehicle_id,
                Trip.status.in_([TripStatus.APPROVED, TripStatus.IN_PROGRESS]),
                Trip.start_date <= trip.end_date,
                Trip.end_date >= trip.start_date,
            )
            .first()
        )
        if clash:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{vehicle.registration_number} is already booked for {clash.reference} on those dates")

        trip.vehicle_id = payload.vehicle_id

    trip.status = TripStatus.APPROVED
    db.commit()
    db.refresh(trip)
    return trip


@router.post(
    "/{trip_id}/decline",
    response_model=TripOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("trips"))],
)
def decline_trip(school_id: int, trip_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    trip = _trip_or_404(db, school_id, trip_id)
    if trip.status != TripStatus.REQUESTED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only a requested trip can be declined")
    trip.status = TripStatus.DECLINED
    db.commit()
    db.refresh(trip)
    return trip


@router.post(
    "/{trip_id}/start",
    response_model=TripOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("trips"))],
)
def start_trip(school_id: int, trip_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    trip = _trip_or_404(db, school_id, trip_id)
    if trip.status != TripStatus.APPROVED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only an approved trip can be started")
    trip.status = TripStatus.IN_PROGRESS
    db.commit()
    db.refresh(trip)
    return trip


@router.post(
    "/{trip_id}/complete",
    response_model=TripOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("trips"))],
)
def complete_trip(school_id: int, trip_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    trip = _trip_or_404(db, school_id, trip_id)
    if trip.status != TripStatus.IN_PROGRESS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only a trip in progress can be completed")
    trip.status = TripStatus.COMPLETED
    db.commit()
    db.refresh(trip)
    return trip


@router.post(
    "/{trip_id}/cancel",
    response_model=TripOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("trips"))],
)
def cancel_trip(school_id: int, trip_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    trip = _trip_or_404(db, school_id, trip_id)
    if trip.status not in (TripStatus.REQUESTED, TripStatus.APPROVED):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only a requested or approved trip can be cancelled")
    trip.status = TripStatus.CANCELLED
    db.commit()
    db.refresh(trip)
    return trip
