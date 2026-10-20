from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.core.notify import notify
from app.models.academics import Student
from app.models.security import (
    EarlyPickup,
    PatrolLog,
    SecurityAlert,
    SecurityIncident,
    SecurityIncidentStatus,
    VehicleDirection,
    VehicleLog,
    VehicleReleaseRequest,
    VehicleReleaseStatus,
    VisitorLog,
)
from app.models.user import User, UserRole
from app.schemas.security import (
    EarlyPickupCreate,
    EarlyPickupOut,
    PatrolLogCreate,
    PatrolLogOut,
    SecurityAlertCreate,
    SecurityAlertOut,
    SecurityIncidentCreate,
    SecurityIncidentOut,
    VehicleLogCreate,
    VehicleLogOut,
    VehicleReleaseDecision,
    VehicleReleaseRequestCreate,
    VehicleReleaseRequestOut,
    VisitorOut,
    VisitorSignIn,
)

router = APIRouter(prefix="/schools/{school_id}/security", tags=["security"])

STAFF_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SUPERVISOR, UserRole.STAFF, UserRole.SECURITY)
ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SUPERVISOR)


def _student_or_404(db: Session, school_id: int, student_id: int) -> Student:
    student = db.query(Student).filter_by(school_id=school_id, id=student_id).first()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
    return student


# --- Visitors ---


@router.get(
    "/visitors",
    response_model=list[VisitorOut],
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("security"))],
)
def list_visitors(
    school_id: int,
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    query = db.query(VisitorLog).filter_by(school_id=school_id)
    if date_from is not None:
        query = query.filter(VisitorLog.signed_in_at >= date_from)
    if date_to is not None:
        query = query.filter(VisitorLog.signed_in_at < date_to + timedelta(days=1))
    return query.order_by(VisitorLog.signed_in_at.desc()).all()


@router.post(
    "/visitors",
    response_model=VisitorOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("security"))],
)
def sign_in_visitor(
    school_id: int, payload: VisitorSignIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)

    already_in = (
        db.query(VisitorLog)
        .filter(
            VisitorLog.school_id == school_id,
            VisitorLog.signed_out_at.is_(None),
            VisitorLog.name.ilike(payload.name),
        )
        .first()
    )
    if already_in:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This visitor is already signed in")

    count = db.query(VisitorLog).filter_by(school_id=school_id).count()
    visitor = VisitorLog(
        school_id=school_id,
        badge=f"V-{count + 31:03d}",
        name=payload.name,
        id_number_masked="•••••" + payload.id_number[-3:],
        phone=payload.phone,
        purpose=payload.purpose,
        host_name=payload.host_name,
        vehicle_registration=payload.vehicle_registration,
    )
    db.add(visitor)
    db.commit()
    db.refresh(visitor)
    return visitor


@router.post(
    "/visitors/{visitor_id}/sign-out",
    response_model=VisitorOut,
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("security"))],
)
def sign_out_visitor(
    school_id: int, visitor_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    visitor = db.query(VisitorLog).filter_by(school_id=school_id, id=visitor_id).first()
    if visitor is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Visitor not found")
    if visitor.signed_out_at is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This visitor has already signed out")
    visitor.signed_out_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(visitor)
    return visitor


# --- Vehicles ---


@router.get(
    "/vehicles",
    response_model=list[VehicleLogOut],
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("security"))],
)
def list_vehicle_logs(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return db.query(VehicleLog).filter_by(school_id=school_id).order_by(VehicleLog.logged_at.desc()).all()


@router.post(
    "/vehicles",
    response_model=VehicleLogOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("security"))],
)
def log_vehicle(
    school_id: int, payload: VehicleLogCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Entering is unrestricted — a vehicle arriving poses no risk, so
    security logs it straight away. Leaving is a different story: that
    direction only ever gets written by approving a release request, never
    through this endpoint."""
    ensure_school_access(db, current_user, school_id)
    if payload.direction == VehicleDirection.OUT:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "A vehicle can't be logged out directly — raise a release request for admin approval first",
        )
    last = (
        db.query(VehicleLog)
        .filter_by(school_id=school_id, registration=payload.registration)
        .order_by(VehicleLog.logged_at.desc())
        .first()
    )
    if last and last.direction == payload.direction:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{payload.registration} is already logged {payload.direction.value}")

    entry = VehicleLog(school_id=school_id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


# --- Vehicle release requests (security asks, admin approves, only then does the vehicle actually leave) ---


@router.get(
    "/vehicles/release-requests",
    response_model=list[VehicleReleaseRequestOut],
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("security"))],
)
def list_release_requests(
    school_id: int,
    status_filter: VehicleReleaseStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    query = db.query(VehicleReleaseRequest).filter_by(school_id=school_id)
    if status_filter is not None:
        query = query.filter_by(status=status_filter)
    return query.order_by(VehicleReleaseRequest.requested_at.desc()).all()


@router.post(
    "/vehicles/release-requests",
    response_model=VehicleReleaseRequestOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("security"))],
)
def create_release_request(
    school_id: int,
    payload: VehicleReleaseRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    last = (
        db.query(VehicleLog)
        .filter_by(school_id=school_id, registration=payload.registration)
        .order_by(VehicleLog.logged_at.desc())
        .first()
    )
    if last is None or last.direction != VehicleDirection.IN:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{payload.registration} isn't currently logged in on the premises")
    pending = (
        db.query(VehicleReleaseRequest)
        .filter_by(school_id=school_id, registration=payload.registration, status=VehicleReleaseStatus.PENDING)
        .first()
    )
    if pending is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"A release request for {payload.registration} is already pending")

    request_row = VehicleReleaseRequest(school_id=school_id, requested_by=current_user.id, **payload.model_dump())
    db.add(request_row)
    db.flush()

    admins = db.query(User).filter(User.school_id == school_id, User.role.in_(ADMIN_ROLES)).all()
    for admin in admins:
        notify(
            db,
            school_id=school_id,
            user_id=admin.id,
            title="Vehicle release request",
            body=f"{current_user.full_name} wants {payload.registration} released",
            link="/dashboard/security",
        )

    db.commit()
    db.refresh(request_row)
    return request_row


@router.post(
    "/vehicles/release-requests/{request_id}/approve",
    response_model=VehicleReleaseRequestOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("security"))],
)
def approve_release_request(
    school_id: int,
    request_id: int,
    payload: VehicleReleaseDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    request_row = db.query(VehicleReleaseRequest).filter_by(school_id=school_id, id=request_id).first()
    if request_row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Release request not found")
    if request_row.status != VehicleReleaseStatus.PENDING:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This request has already been decided")

    request_row.status = VehicleReleaseStatus.APPROVED
    request_row.decision_note = payload.note
    request_row.decided_by = current_user.id
    request_row.decided_at = datetime.now(timezone.utc)

    db.add(
        VehicleLog(
            school_id=school_id,
            registration=request_row.registration,
            direction=VehicleDirection.OUT,
            driver_name=request_row.driver_name,
            purpose=request_row.purpose,
        )
    )
    notify(
        db,
        school_id=school_id,
        user_id=request_row.requested_by,
        title="Vehicle release approved",
        body=f"{request_row.registration} has been approved for release",
        link="/dashboard/security",
    )
    db.commit()
    db.refresh(request_row)
    return request_row


@router.post(
    "/vehicles/release-requests/{request_id}/reject",
    response_model=VehicleReleaseRequestOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("security"))],
)
def reject_release_request(
    school_id: int,
    request_id: int,
    payload: VehicleReleaseDecision,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    request_row = db.query(VehicleReleaseRequest).filter_by(school_id=school_id, id=request_id).first()
    if request_row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Release request not found")
    if request_row.status != VehicleReleaseStatus.PENDING:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This request has already been decided")

    request_row.status = VehicleReleaseStatus.REJECTED
    request_row.decision_note = payload.note
    request_row.decided_by = current_user.id
    request_row.decided_at = datetime.now(timezone.utc)
    notify(
        db,
        school_id=school_id,
        user_id=request_row.requested_by,
        title="Vehicle release rejected",
        body=f"{request_row.registration} was not approved for release"
        + (f": {payload.note}" if payload.note else ""),
        link="/dashboard/security",
    )
    db.commit()
    db.refresh(request_row)
    return request_row


# --- Early pick-ups ---


@router.get(
    "/pickups",
    response_model=list[EarlyPickupOut],
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("security"))],
)
def list_pickups(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return db.query(EarlyPickup).filter_by(school_id=school_id).order_by(EarlyPickup.created_at.desc()).all()


@router.post(
    "/pickups",
    response_model=EarlyPickupOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("security"))],
)
def log_pickup(
    school_id: int, payload: EarlyPickupCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    _student_or_404(db, school_id, payload.student_id)
    pickup = EarlyPickup(school_id=school_id, logged_by=current_user.id, **payload.model_dump())
    db.add(pickup)
    db.commit()
    db.refresh(pickup)
    return pickup


# --- Incidents ---


@router.get(
    "/incidents",
    response_model=list[SecurityIncidentOut],
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("security"))],
)
def list_security_incidents(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return db.query(SecurityIncident).filter_by(school_id=school_id).order_by(SecurityIncident.created_at.desc()).all()


@router.post(
    "/incidents",
    response_model=SecurityIncidentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("security"))],
)
def report_security_incident(
    school_id: int, payload: SecurityIncidentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    incident = SecurityIncident(school_id=school_id, logged_by=current_user.id, **payload.model_dump())
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


@router.post(
    "/incidents/{incident_id}/close",
    response_model=SecurityIncidentOut,
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("security"))],
)
def close_security_incident(
    school_id: int, incident_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    incident = db.query(SecurityIncident).filter_by(school_id=school_id, id=incident_id).first()
    if incident is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")
    incident.status = SecurityIncidentStatus.CLOSED
    db.commit()
    db.refresh(incident)
    return incident


# --- Emergency alerts ---


@router.get(
    "/alerts",
    response_model=list[SecurityAlertOut],
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("security"))],
)
def list_alerts(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return db.query(SecurityAlert).filter_by(school_id=school_id).order_by(SecurityAlert.created_at.desc()).all()


@router.post(
    "/alerts",
    response_model=SecurityAlertOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("security"))],
)
def raise_alert(
    school_id: int, payload: SecurityAlertCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    alert = SecurityAlert(school_id=school_id, raised_by=current_user.id, **payload.model_dump())
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@router.post(
    "/alerts/{alert_id}/stand-down",
    response_model=SecurityAlertOut,
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("security"))],
)
def stand_down_alert(school_id: int, alert_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    alert = db.query(SecurityAlert).filter_by(school_id=school_id, id=alert_id).first()
    if alert is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Alert not found")
    alert.active = False
    db.commit()
    db.refresh(alert)
    return alert


# --- Patrols ---


@router.get(
    "/patrols",
    response_model=list[PatrolLogOut],
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("security"))],
)
def list_patrols(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return db.query(PatrolLog).filter_by(school_id=school_id).order_by(PatrolLog.created_at.desc()).all()


@router.post(
    "/patrols",
    response_model=PatrolLogOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("security"))],
)
def log_patrol(
    school_id: int, payload: PatrolLogCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    patrol = PatrolLog(school_id=school_id, logged_by=current_user.id, **payload.model_dump())
    db.add(patrol)
    db.commit()
    db.refresh(patrol)
    return patrol
