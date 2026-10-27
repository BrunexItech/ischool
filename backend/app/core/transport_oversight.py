"""The head's view of transport: how every child arrived and left on a day,
class by class, plus the day's bus runs and any vehicle papers running out.
Read-only; the attendants and gate staff keep the records."""

from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.dates import school_today, school_tz
from app.core.staff_presence import _Context
from app.models.academics import SchoolClass, Student
from app.models.pickup_dropoff import PickupDropoffLog, PickupDropoffType
from app.models.transport import TransportRoute, Vehicle
from app.routers.transport_runs import runs_for_day
from app.schemas.oversight import FleetAlert, TransportClass, TransportEventOut, TransportLearner, TransportOverview, TransportSummary

SOON = 30  # days before a paper expires that it is flagged


def fleet_alerts(db: Session, school_id: int, today: date) -> list[FleetAlert]:
    out: list[FleetAlert] = []
    for v in db.query(Vehicle).filter_by(school_id=school_id, is_active=True).order_by(Vehicle.registration_number):
        for label, due in (("Insurance", v.insurance_expiry), ("Inspection", v.inspection_expiry), ("Service", v.next_service_date)):
            if due is None:
                continue
            days = (due - today).days
            if days < 0:
                out.append(FleetAlert(vehicle=v.registration_number, text=f"{label} expired {-days} day{'s' if days != -1 else ''} ago", urgent=True))
            elif days <= SOON:
                out.append(FleetAlert(vehicle=v.registration_number, text=f"{label} due in {days} day{'s' if days != 1 else ''}", urgent=days <= 7))
        if v.attendant_user_id is None:
            out.append(FleetAlert(vehicle=v.registration_number, text="No attendant assigned", urgent=False))
    out.sort(key=lambda a: (not a.urgent, a.vehicle))
    return out


def transport_overview(db: Session, school_id: int, day: date, class_id: int | None = None) -> TransportOverview:
    tz = school_tz(db, school_id)
    lo = datetime.combine(day, time.min, tzinfo=tz).astimezone(timezone.utc)
    hi = datetime.combine(day + timedelta(days=1), time.min, tzinfo=tz).astimezone(timezone.utc)
    logs = db.query(PickupDropoffLog).filter(PickupDropoffLog.school_id == school_id, PickupDropoffLog.occurred_at >= lo, PickupDropoffLog.occurred_at < hi).order_by(PickupDropoffLog.occurred_at).all()
    by_student: dict[int, list[PickupDropoffLog]] = defaultdict(list)
    for l in logs:
        by_student[l.student_id].append(l)

    def ev(l: PickupDropoffLog) -> TransportEventOut:
        return TransportEventOut(at=l.occurred_at, by=l.person_name, via=l.source if l.source in ("bus", "parent") else "gate", note=l.notes)

    classes = db.query(SchoolClass).filter_by(school_id=school_id).all()
    if class_id is not None:
        classes = [c for c in classes if c.id == class_id]
    classes.sort(key=lambda c: ((c.grade.sort_order if c.grade else 999), c.name))
    kids = db.query(Student).filter_by(school_id=school_id, is_active=True).order_by(Student.first_name, Student.last_name).all()
    roster: dict[int, list[Student]] = defaultdict(list)
    for k in kids:
        if k.class_id:
            roster[k.class_id].append(k)

    rows_out: list[TransportClass] = []
    tot = dict(learners=0, arrived=0, left=0, bus=0)
    for c in classes:
        learners = []
        for k in roster.get(c.id, []):
            mine = by_student.get(k.id, [])
            arrivals = [l for l in mine if l.event_type == PickupDropoffType.DROPOFF and l.at_school]
            departures = [l for l in mine if l.event_type == PickupDropoffType.PICKUP and l.at_school]
            route = [ev(l) for l in mine if not l.at_school]
            learners.append(
                TransportLearner(
                    student_id=k.id,
                    name=f"{k.first_name} {k.last_name}",
                    admission_number=k.admission_number,
                    bus_rider=k.transport_route_id is not None,
                    arrival=ev(arrivals[0]) if arrivals else None,
                    departure=ev(departures[-1]) if departures else None,
                    on_route=route,
                )
            )
        arrived = sum(1 for r in learners if r.arrival)
        left = sum(1 for r in learners if r.departure)
        rows_out.append(TransportClass(class_id=c.id, class_name=c.name, level=c.grade.level_group.value if c.grade else "other", learners=len(learners), arrived=arrived, left=left, bus_riders=sum(1 for r in learners if r.bus_rider), rows=learners))
        tot["learners"] += len(learners)
        tot["arrived"] += arrived
        tot["left"] += left
        tot["bus"] += sum(1 for r in learners if r.bus_rider)

    routes = db.query(TransportRoute).filter_by(school_id=school_id).order_by(TransportRoute.name).all()
    runs = runs_for_day(db, school_id, day, routes)
    started = [r for r in runs if r.status != "not_started"]
    return TransportOverview(
        date=day,
        school_day=_Context(db, school_id, day, day).is_school_day(day),
        summary=TransportSummary(
            learners=tot["learners"], arrived=tot["arrived"], left=tot["left"], bus_riders=tot["bus"],
            runs_total=len(runs), runs_completed=sum(1 for r in started if r.status == "completed"), runs_in_progress=sum(1 for r in started if r.status == "in_progress"),
        ),
        runs=runs,
        fleet_alerts=fleet_alerts(db, school_id, school_today(db, school_id)),
        classes=rows_out,
    )
