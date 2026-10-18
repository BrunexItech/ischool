import random
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.academics import Student
from app.models.boarding import (
    BoardingAssignment,
    BoardingHouse,
    BoardingIncident,
    BoardingRollCall,
    Exeat,
    ExeatStatus,
    IncidentStatus,
    SickBayAction,
    SickBayVisit,
)
from app.models.user import User, UserRole
from app.schemas.boarding import (
    BoardingAssignmentCreate,
    BoardingAssignmentOut,
    BoardingHouseCreate,
    BoardingHouseOut,
    BoardingIncidentCreate,
    BoardingIncidentOut,
    ExeatCreate,
    ExeatOut,
    RollCallOut,
    RollCallSubmit,
    SickBayVisitCreate,
    SickBayVisitOut,
)

router = APIRouter(prefix="/schools/{school_id}/boarding", tags=["boarding"])

ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
STAFF_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.STAFF, UserRole.BOARDING_STAFF)


def _house_or_404(db: Session, school_id: int, house_id: int) -> BoardingHouse:
    house = db.query(BoardingHouse).filter_by(school_id=school_id, id=house_id).first()
    if house is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "House not found")
    return house


def _student_or_404(db: Session, school_id: int, student_id: int) -> Student:
    student = db.query(Student).filter_by(school_id=school_id, id=student_id).first()
    if student is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found")
    return student


def _house_out(db: Session, house: BoardingHouse) -> BoardingHouseOut:
    occupied = db.query(BoardingAssignment).filter_by(house_id=house.id).count()
    out = BoardingHouseOut.model_validate(house)
    out.occupied_beds = occupied
    return out


# --- Houses ---


@router.get(
    "/houses",
    response_model=list[BoardingHouseOut],
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("boarding"))],
)
def list_houses(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    houses = db.query(BoardingHouse).filter_by(school_id=school_id).all()
    return [_house_out(db, h) for h in houses]


@router.post(
    "/houses",
    response_model=BoardingHouseOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("boarding"))],
)
def create_house(
    school_id: int, payload: BoardingHouseCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    if db.query(BoardingHouse).filter_by(school_id=school_id, name=payload.name).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A house with that name already exists")
    house = BoardingHouse(school_id=school_id, **payload.model_dump())
    db.add(house)
    db.commit()
    db.refresh(house)
    return _house_out(db, house)


# --- Bed assignments ---


@router.get(
    "/assignments",
    response_model=list[BoardingAssignmentOut],
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("boarding"))],
)
def list_assignments(
    school_id: int, house_id: int | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    query = db.query(BoardingAssignment).filter_by(school_id=school_id)
    if house_id is not None:
        query = query.filter_by(house_id=house_id)
    return query.all()


@router.post(
    "/assignments",
    response_model=BoardingAssignmentOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("boarding"))],
)
def assign_bed(
    school_id: int,
    payload: BoardingAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    _student_or_404(db, school_id, payload.student_id)
    house = _house_or_404(db, school_id, payload.house_id)

    taken = (
        db.query(BoardingAssignment)
        .filter(
            BoardingAssignment.house_id == payload.house_id,
            BoardingAssignment.bed_number == payload.bed_number,
            BoardingAssignment.student_id != payload.student_id,
        )
        .first()
    )
    if taken:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Bed {payload.bed_number} is already occupied")

    existing = db.query(BoardingAssignment).filter_by(student_id=payload.student_id).first()
    if existing:
        existing.house_id = house.id
        existing.bed_number = payload.bed_number
        assignment = existing
    else:
        assignment = BoardingAssignment(school_id=school_id, **payload.model_dump())
        db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


# --- Roll calls ---


@router.get(
    "/roll-calls",
    response_model=list[RollCallOut],
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("boarding"))],
)
def list_roll_calls(
    school_id: int,
    house_id: int,
    date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    return db.query(BoardingRollCall).filter_by(school_id=school_id, house_id=house_id, date=date).all()


@router.put(
    "/roll-calls",
    response_model=RollCallOut,
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("boarding"))],
)
def submit_roll_call(
    school_id: int, payload: RollCallSubmit, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    _house_or_404(db, school_id, payload.house_id)

    existing = (
        db.query(BoardingRollCall)
        .filter_by(school_id=school_id, house_id=payload.house_id, date=payload.date, session=payload.session)
        .first()
    )
    if existing:
        existing.marks = payload.marks
        existing.recorded_by = current_user.id
        roll_call = existing
    else:
        roll_call = BoardingRollCall(
            school_id=school_id,
            house_id=payload.house_id,
            date=payload.date,
            session=payload.session,
            marks=payload.marks,
            recorded_by=current_user.id,
        )
        db.add(roll_call)
    db.commit()
    db.refresh(roll_call)
    return roll_call


# --- Leave-outs (exeats) ---


@router.get(
    "/exeats",
    response_model=list[ExeatOut],
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("boarding"))],
)
def list_exeats(
    school_id: int, status_filter: str | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    query = db.query(Exeat).filter_by(school_id=school_id)
    if status_filter:
        query = query.filter_by(status=status_filter)
    return query.order_by(Exeat.created_at.desc()).all()


@router.get(
    "/exeats/by-pass/{code}",
    response_model=ExeatOut,
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("boarding"))],
)
def find_exeat_by_gate_pass(
    school_id: int, code: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    exeat = db.query(Exeat).filter_by(school_id=school_id, gate_pass=code.upper()).first()
    if exeat is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No pass with this code")
    return exeat


@router.post(
    "/exeats",
    response_model=ExeatOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("boarding"))],
)
def create_exeat(
    school_id: int, payload: ExeatCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    _student_or_404(db, school_id, payload.student_id)

    clash = (
        db.query(Exeat)
        .filter(
            Exeat.student_id == payload.student_id,
            Exeat.status.in_([ExeatStatus.PENDING, ExeatStatus.APPROVED, ExeatStatus.OUT]),
            Exeat.from_date <= payload.to_date,
            Exeat.to_date >= payload.from_date,
        )
        .first()
    )
    if clash:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "There is already a leave-out for these dates")

    exeat = Exeat(school_id=school_id, **payload.model_dump())
    db.add(exeat)
    db.commit()
    db.refresh(exeat)
    return exeat


def _exeat_or_404(db: Session, school_id: int, exeat_id: int) -> Exeat:
    exeat = db.query(Exeat).filter_by(school_id=school_id, id=exeat_id).first()
    if exeat is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Leave-out not found")
    return exeat


@router.post(
    "/exeats/{exeat_id}/approve",
    response_model=ExeatOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("boarding"))],
)
def approve_exeat(
    school_id: int, exeat_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    exeat = _exeat_or_404(db, school_id, exeat_id)
    if exeat.status != ExeatStatus.PENDING:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only a pending leave-out can be approved")
    exeat.status = ExeatStatus.APPROVED
    exeat.gate_pass = f"GP-{random.randint(1000, 9999)}"
    exeat.approved_by = current_user.id
    db.commit()
    db.refresh(exeat)
    return exeat


@router.post(
    "/exeats/{exeat_id}/deny",
    response_model=ExeatOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("boarding"))],
)
def deny_exeat(school_id: int, exeat_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    exeat = _exeat_or_404(db, school_id, exeat_id)
    if exeat.status != ExeatStatus.PENDING:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only a pending leave-out can be denied")
    exeat.status = ExeatStatus.DENIED
    db.commit()
    db.refresh(exeat)
    return exeat


@router.post(
    "/exeats/{exeat_id}/check-out",
    response_model=ExeatOut,
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("boarding"))],
)
def check_out_exeat(
    school_id: int, exeat_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    exeat = _exeat_or_404(db, school_id, exeat_id)
    if exeat.status != ExeatStatus.APPROVED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The gate pass must be approved before checking out")
    exeat.status = ExeatStatus.OUT
    exeat.out_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(exeat)
    return exeat


@router.post(
    "/exeats/{exeat_id}/check-in",
    response_model=ExeatOut,
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("boarding"))],
)
def check_in_exeat(
    school_id: int, exeat_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    exeat = _exeat_or_404(db, school_id, exeat_id)
    if exeat.status != ExeatStatus.OUT:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This learner is not currently out")
    now = datetime.now(timezone.utc)
    expected_back = datetime.combine(exeat.to_date, datetime.min.time()).replace(hour=18, tzinfo=timezone.utc)
    exeat.back_at = now
    exeat.status = ExeatStatus.RETURNED_LATE if now > expected_back else ExeatStatus.RETURNED
    db.commit()
    db.refresh(exeat)
    return exeat


# --- Sick bay ---


@router.get(
    "/sick-bay",
    response_model=list[SickBayVisitOut],
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("boarding"))],
)
def list_sick_bay(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return db.query(SickBayVisit).filter_by(school_id=school_id).order_by(SickBayVisit.created_at.desc()).all()


@router.post(
    "/sick-bay",
    response_model=SickBayVisitOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("boarding"))],
)
def create_sick_bay_visit(
    school_id: int, payload: SickBayVisitCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    _student_or_404(db, school_id, payload.student_id)

    status_map = {
        SickBayAction.REST_IN_SICK_BAY: "In sick bay",
        SickBayAction.REFER_TO_CLINIC: "Referred to clinic",
        SickBayAction.FIRST_AID: "Back to dorm",
    }
    visit = SickBayVisit(
        school_id=school_id,
        logged_by=current_user.id,
        status=status_map[payload.action],
        **payload.model_dump(),
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)
    return visit


# --- Incidents ---


@router.get(
    "/incidents",
    response_model=list[BoardingIncidentOut],
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("boarding"))],
)
def list_incidents(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return db.query(BoardingIncident).filter_by(school_id=school_id).order_by(BoardingIncident.created_at.desc()).all()


@router.post(
    "/incidents",
    response_model=BoardingIncidentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("boarding"))],
)
def create_incident(
    school_id: int, payload: BoardingIncidentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    _house_or_404(db, school_id, payload.house_id)
    incident = BoardingIncident(school_id=school_id, logged_by=current_user.id, **payload.model_dump())
    db.add(incident)
    db.commit()
    db.refresh(incident)
    return incident


@router.post(
    "/incidents/{incident_id}/close",
    response_model=BoardingIncidentOut,
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("boarding"))],
)
def close_incident(
    school_id: int, incident_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    incident = db.query(BoardingIncident).filter_by(school_id=school_id, id=incident_id).first()
    if incident is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Incident not found")
    incident.status = IncidentStatus.CLOSED
    db.commit()
    db.refresh(incident)
    return incident
