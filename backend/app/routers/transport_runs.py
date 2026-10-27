"""The daily runs: the attendant who rides with the driver starts a run, checks
each child on and off, and completes it. Every check writes the same
pick-up/drop-off record parents already see, so the head's date search covers
the bus and the school gate alike."""

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dates import school_today
from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.core.notify import notify
from app.models.academics import Student
from app.models.pickup_dropoff import PickupDropoffLog, PickupDropoffType
from app.models.transport import RouteStop, TransportBoarding, TransportRoute, TransportRun, Vehicle
from app.models.user import User, UserRole
from app.schemas.transport import BoardingUpdate, ManifestRow, RunComplete, RunDetail, RunStart, RunSummary

router = APIRouter(prefix="/schools/{school_id}/transport/runs", tags=["transport runs"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.TRANSPORT_STAFF, UserRole.TRANSPORT_ATTENDANT, UserRole.STAFF)
OPERATE_ROLES = (UserRole.SUPER_ADMIN, UserRole.TRANSPORT_STAFF, UserRole.TRANSPORT_ATTENDANT)
DIRECTIONS = ("morning", "afternoon")
STATUSES = ("pending", "boarded", "dropped", "absent")


def _roster(db: Session, school_id: int, route_id: int) -> list[Student]:
    stops = {s.id: s.stop_order for s in db.query(RouteStop).filter_by(route_id=route_id)}
    kids = db.query(Student).filter_by(school_id=school_id, transport_route_id=route_id, is_active=True).all()
    kids.sort(key=lambda s: (stops.get(s.transport_stop_id, 9999), s.first_name, s.last_name))
    return kids


def _my_routes(db: Session, school_id: int, user: User) -> list[TransportRoute]:
    q = db.query(TransportRoute).filter_by(school_id=school_id)
    if user.role == UserRole.TRANSPORT_ATTENDANT:
        mine = [v.id for v in db.query(Vehicle).filter_by(school_id=school_id, attendant_user_id=user.id)]
        q = q.filter(TransportRoute.vehicle_id.in_(mine or [-1]))
    return q.order_by(TransportRoute.name).all()


def _summary(db: Session, route: TransportRoute, direction: str, run: TransportRun | None, roster_size: int) -> RunSummary:
    counts = {k: 0 for k in STATUSES}
    if run is not None:
        for b in run.boardings:
            counts[b.status] += 1
    vehicle = route.vehicle
    return RunSummary(
        route_id=route.id,
        route_name=route.name,
        direction=direction,
        vehicle_registration=vehicle.registration_number if vehicle else None,
        driver_name=vehicle.driver_name if vehicle else None,
        attendant_name=vehicle.attendant.full_name if vehicle and vehicle.attendant else None,
        run_id=run.id if run else None,
        status=run.status if run else "not_started",
        expected=len(run.boardings) if run else roster_size,
        pending=counts["pending"] if run else roster_size,
        boarded=counts["boarded"],
        dropped=counts["dropped"],
        absent=counts["absent"],
        started_at=run.started_at if run else None,
        completed_at=run.completed_at if run else None,
        due_time=route.school_arrival_time if direction == "morning" else route.afternoon_departure_time,
    )


def runs_for_day(db: Session, school_id: int, day: date, routes: list[TransportRoute]) -> list[RunSummary]:
    runs = {(r.route_id, r.direction): r for r in db.query(TransportRun).filter(TransportRun.school_id == school_id, TransportRun.run_date == day)}
    sizes = {r.id: db.query(Student.id).filter_by(school_id=school_id, transport_route_id=r.id, is_active=True).count() for r in routes}
    out = []
    for route in routes:
        for direction in DIRECTIONS:
            out.append(_summary(db, route, direction, runs.get((route.id, direction)), sizes[route.id]))
    return out


@router.get("", response_model=list[RunSummary], dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("transport"))])
def list_runs(school_id: int, on: date | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Every route's morning and afternoon run for a day. An attendant sees
    only the vehicle they ride on."""
    ensure_school_access(db, current_user, school_id)
    return runs_for_day(db, school_id, on or school_today(db, school_id), _my_routes(db, school_id, current_user))


def _run_or_404(db: Session, school_id: int, run_id: int, user: User) -> TransportRun:
    run = db.query(TransportRun).filter_by(school_id=school_id, id=run_id).first()
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Run not found")
    if user.role == UserRole.TRANSPORT_ATTENDANT and run.route_id not in {r.id for r in _my_routes(db, school_id, user)}:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "That run is not on your vehicle")
    return run


def _detail(db: Session, run: TransportRun) -> RunDetail:
    stops = {s.id: s for s in db.query(RouteStop).filter_by(route_id=run.route_id)}
    rows = []
    for b in sorted(run.boardings, key=lambda b: (stops[b.stop_id].stop_order if b.stop_id in stops else 9999, b.student.first_name)):
        st = stops.get(b.stop_id)
        rows.append(
            ManifestRow(
                student_id=b.student_id,
                name=f"{b.student.first_name} {b.student.last_name}",
                class_name=b.student.school_class.name if b.student.school_class else None,
                admission_number=b.student.admission_number,
                stop_name=st.name if st else None,
                stop_time=st.pickup_time if st else None,
                guardian_phone=b.student.guardian_phone,
                status=b.status,
                boarded_at=b.boarded_at,
                dropped_at=b.dropped_at,
                handed_to=b.handed_to,
                note=b.note,
            )
        )
    return RunDetail(summary=_summary(db, run.route, run.direction, run, len(run.boardings)), rows=rows)


@router.post("", response_model=RunDetail, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles(*OPERATE_ROLES)), Depends(require_feature("transport"))])
def start_run(school_id: int, payload: RunStart, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Start today's run for a route. Starting twice returns the same run."""
    ensure_school_access(db, current_user, school_id)
    if payload.direction not in DIRECTIONS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Direction must be morning or afternoon")
    route = next((r for r in _my_routes(db, school_id, current_user) if r.id == payload.route_id), None)
    if route is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That route is not on your vehicle")
    today = school_today(db, school_id)
    run = db.query(TransportRun).filter_by(route_id=route.id, run_date=today, direction=payload.direction).first()
    if run is None:
        run = TransportRun(school_id=school_id, route_id=route.id, vehicle_id=route.vehicle_id, run_date=today, direction=payload.direction, started_by=current_user.id)
        for kid in _roster(db, school_id, route.id):
            run.boardings.append(TransportBoarding(student_id=kid.id, stop_id=kid.transport_stop_id, status="pending"))
        db.add(run)
        db.commit()
        db.refresh(run)
    return _detail(db, run)


@router.get("/{run_id}", response_model=RunDetail, dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("transport"))])
def get_run(school_id: int, run_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return _detail(db, _run_or_404(db, school_id, run_id, current_user))


def _log(db: Session, run: TransportRun, boarding: TransportBoarding, *, kind: PickupDropoffType, at_school: bool, who: str, user: User, stop_name: str | None) -> None:
    reg = run.vehicle.registration_number if run.vehicle else "school transport"
    where = f"at {stop_name}" if stop_name and not at_school else ("at school" if at_school else "on the route")
    db.add(
        PickupDropoffLog(
            school_id=run.school_id,
            student_id=boarding.student_id,
            event_type=kind,
            person_name=who,
            notes=f"{run.route.name}, {run.direction} run, {reg}, {where}",
            source="bus",
            at_school=at_school,
            run_id=run.id,
            recorded_by=user.id,
        )
    )


def _tell_family(db: Session, run: TransportRun, boarding: TransportBoarding, text: str) -> None:
    kid = boarding.student
    if kid.guardian_user_id:
        notify(db, school_id=run.school_id, user_id=kid.guardian_user_id, title=f"{kid.first_name}: school transport", body=text, link="/dashboard/children")


@router.post("/{run_id}/students/{student_id}", response_model=RunDetail, dependencies=[Depends(require_roles(*OPERATE_ROLES)), Depends(require_feature("transport"))])
def mark_student(school_id: int, run_id: int, student_id: int, payload: BoardingUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Record that a child boarded, was handed over, or did not come."""
    ensure_school_access(db, current_user, school_id)
    run = _run_or_404(db, school_id, run_id, current_user)
    if run.status == "completed":
        raise HTTPException(status.HTTP_409_CONFLICT, "This run is already completed")
    b = next((x for x in run.boardings if x.student_id == student_id), None)
    if b is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That child is not on this run")
    if payload.status not in STATUSES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Unknown status")
    now = datetime.now(timezone.utc)
    stop = db.get(RouteStop, b.stop_id) if b.stop_id else None
    who = f"{current_user.full_name} (attendant)"
    kid = b.student

    if payload.status == "boarded" and b.status != "boarded":
        if b.status == "dropped":
            raise HTTPException(status.HTTP_409_CONFLICT, "This child has already been handed over")
        b.status, b.boarded_at = "boarded", now
        morning = run.direction == "morning"
        _log(db, run, b, kind=PickupDropoffType.PICKUP, at_school=not morning, who=who, user=current_user, stop_name=stop.name if stop else None)
        _tell_family(db, run, b, f"{kid.first_name} boarded the bus{' at ' + stop.name if morning and stop else ' to go home' if not morning else ''}.")
    elif payload.status == "dropped" and b.status != "dropped":
        if run.direction == "morning":
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "On the morning run children are dropped at school when the run is completed")
        if b.status != "boarded":
            raise HTTPException(status.HTTP_409_CONFLICT, "Mark the child as boarded before handing them over")
        if not (payload.handed_to or "").strip():
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Say who the child was handed to")
        b.status, b.dropped_at, b.handed_to = "dropped", now, payload.handed_to.strip()
        _log(db, run, b, kind=PickupDropoffType.DROPOFF, at_school=False, who=payload.handed_to.strip(), user=current_user, stop_name=stop.name if stop else None)
        _tell_family(db, run, b, f"{kid.first_name} was dropped off{' at ' + stop.name if stop else ''} and handed to {payload.handed_to.strip()}.")
    elif payload.status == "absent":
        if b.status in ("boarded", "dropped"):
            raise HTTPException(status.HTTP_409_CONFLICT, "This child is already on the vehicle")
        b.status = "absent"
    elif payload.status == "pending":
        if b.status in ("dropped",):
            raise HTTPException(status.HTTP_409_CONFLICT, "This child has already been handed over")
        b.status, b.boarded_at = "pending", None
    if payload.note is not None:
        b.note = payload.note.strip() or None
    b.recorded_by = current_user.id
    db.commit()
    db.refresh(run)
    return _detail(db, run)


@router.post("/{run_id}/complete", response_model=RunDetail, dependencies=[Depends(require_roles(*OPERATE_ROLES)), Depends(require_feature("transport"))])
def complete_run(school_id: int, run_id: int, payload: RunComplete | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Finish the run. In the morning everyone on board is dropped at school.
    In the afternoon it cannot finish while a child is still on the vehicle."""
    ensure_school_access(db, current_user, school_id)
    run = _run_or_404(db, school_id, run_id, current_user)
    if run.status == "completed":
        return _detail(db, run)
    now = datetime.now(timezone.utc)
    if run.direction == "afternoon":
        still = [f"{b.student.first_name} {b.student.last_name}" for b in run.boardings if b.status == "boarded"]
        if still:
            raise HTTPException(status.HTTP_409_CONFLICT, "Still on the vehicle: " + ", ".join(still) + ". Hand them over before completing the run.")
    else:
        who = f"{current_user.full_name} (attendant)"
        for b in run.boardings:
            if b.status == "boarded":
                b.status, b.dropped_at, b.handed_to = "dropped", now, "School"
                _log(db, run, b, kind=PickupDropoffType.DROPOFF, at_school=True, who=who, user=current_user, stop_name=None)
                _tell_family(db, run, b, f"{b.student.first_name} arrived safely at school.")
    run.status, run.completed_at = "completed", now
    if payload and payload.note:
        run.note = payload.note.strip() or None
    db.commit()
    db.refresh(run)
    return _detail(db, run)
