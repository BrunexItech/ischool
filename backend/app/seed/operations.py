from datetime import date, datetime, time, timedelta, timezone

from app.models.academics import StaffProfile, Student
from app.models.boarding import (
    BoardingAssignment, BoardingHouse, BoardingIncident, BoardingRollCall, Exeat, ExeatStatus, IncidentStatus, RollSession, SickBayAction, SickBayVisit,
)
from app.models.library import Book, BookCopy, Loan
from app.models.meals import MealMenu, MealTime, WeeklyMenuItem
from app.models.pickup_dropoff import PickupDropoffLog, PickupDropoffType
from app.models.security import (
    EarlyPickup, IncidentSeverity, PatrolLog, SecurityAlert, SecurityIncident, SecurityIncidentStatus, VehicleDirection, VehicleLog, VehicleReleaseRequest,
    VehicleReleaseStatus, VisitorLog,
)
from app.models.staff_attendance import DutyAssignment, StaffAttendance, StaffLeave
from app.models.transport import RouteStop, TransportBoarding, TransportRoute, TransportRun, Vehicle
from app.models.user import User, UserRole
from app.seed.academics import Ctx
from app.seed.core import Seeder

SUPPORT_ROLES = [
    (UserRole.SECRETARY, "Administration", 1), (UserRole.BURSAR, "Finance", 1), (UserRole.ACCOUNTANT, "Finance", 1),
    (UserRole.PROCUREMENT_OFFICER, "Procurement", 1), (UserRole.STORE_KEEPER, "Stores", 1), (UserRole.LIBRARIAN, "Library", 1),
    (UserRole.SECURITY, "Security", 2), (UserRole.TRANSPORT_STAFF, "Transport", 1), (UserRole.TRANSPORT_ATTENDANT, "Transport", 2),
]


def _head(s: Seeder):
    return s.db.query(User).filter_by(school_id=s.sid, role=UserRole.HEAD_OF_INSTITUTION).first()


def _hid(s: Seeder):
    h = _head(s)
    return h.id if h else None


def _at(d: date, h: int, m: int = 0) -> datetime:
    return datetime(d.year, d.month, d.day, h, m, tzinfo=timezone.utc)


def seed_support_staff(s: Seeder, ctx: Ctx, tag: str):
    ctx.staff = {}
    roles = list(SUPPORT_ROLES)
    if ctx.boarding:
        roles.append((UserRole.BOARDING_STAFF, "Boarding", 2))
    n = 100
    for role, dept, count in roles:
        for _ in range(count):
            n += 1
            user, person = s.account(role)
            s.add(StaffProfile(school_id=s.sid, user_id=user.id, staff_number=f"{tag}-S{n}", department=dept, phone=s.phone(), is_demo=True))
            ctx.staff.setdefault(role, []).append(user)
    s.flush()


def _first(ctx: Ctx, role: UserRole):
    return ctx.staff[role][0] if ctx.staff.get(role) else None


BOOKS = [
    ("The River and the Source", "Margaret Ogola", "Novel", 7), ("Blossoms of the Savannah", "Henry ole Kulet", "Novel", 8), ("Chozi la Heri", "Assumpta Matei", "Riwaya", 8),
    ("Kidagaa Kimemuramba", "Ken Walibora", "Riwaya", 9), ("Siku Njema", "Ken Walibora", "Riwaya", 8), ("Oliver Twist", "Charles Dickens", "Novel", 6),
    ("Animal Farm", "George Orwell", "Novel", 6), ("The Pearl", "John Steinbeck", "Novel", 5), ("Tales from Africa", "Traditional collection", "Storybook", 10),
    ("My First Picture Dictionary", "Oxford Kenya", "Reference", 8), ("Kiswahili Sanifu Dictionary", "TUKI", "Reference", 5), ("Atlas of Kenya", "Longhorn", "Reference", 4),
    ("Mathematics Activities Grade 4", "KICD", "Textbook", 12), ("Science and Technology Grade 5", "KICD", "Textbook", 12), ("Integrated Science Grade 7", "KICD", "Textbook", 12),
    ("English Grade 6 Learner's Book", "KICD", "Textbook", 12), ("Social Studies Grade 6", "KICD", "Textbook", 10), ("Simple Machines", "Longhorn", "Science", 4),
    ("Wangari Maathai: Planting Trees", "Local readers series", "Storybook", 6), ("The Hare and the Tortoise", "Traditional collection", "Storybook", 8),
    ("Hadithi za Kiswahili", "Phoenix Publishers", "Storybook", 6), ("Atlas of the World", "Oxford", "Reference", 3),
]


def seed_library(s: Seeder, ctx: Ctx, tag: str):
    librarian = _first(ctx, UserRole.LIBRARIAN)
    number = 0
    copies = []
    for title, author, category, qty in BOOKS:
        b = s.add(Book(school_id=s.sid, title=title, author=author, isbn=f"978-9966-{s.rng.randint(10000, 99999)}-{s.rng.randint(0, 9)}", category=category, shelf=f"{category[:1]}-{s.rng.randint(1, 8)}"))
        s.flush()
        for _ in range(min(qty, 6)):
            number += 1
            copies.append(s.add(BookCopy(school_id=s.sid, book_id=b.id, copy_number=f"BK-{tag}-{number:05d}", condition=s.rng.choice(["good", "good", "fair"]), status="available")))
    s.flush()
    learners = [st for sts in ctx.students.values() for st in sts]
    teachers = [t for t, _ in ctx.teachers]
    taken = set()
    for i in range(34):
        copy = copies[s.rng.randrange(len(copies))]
        if copy.id in taken:
            continue
        taken.add(copy.id)
        issued = s.today - timedelta(days=s.rng.randint(2, 28))
        due = issued + timedelta(days=14)
        returned = s.rng.random() < 0.35
        st = s.rng.choice(learners)
        s.add(Loan(
            school_id=s.sid, copy_id=copy.id, student_id=st.id, issued_by=librarian.id if librarian else None, issued_at=_at(issued, 10), due_date=due,
            returned_at=_at(min(s.today, due + timedelta(days=s.rng.randint(-3, 3))), 14) if returned else None, returned_to=librarian.id if (returned and librarian) else None,
            return_condition="good" if returned else None,
        ))
        if not returned:
            copy.status = "on_loan"
    # A class set lent to a teacher, then issued on to learners.
    cs = copies[0]
    if cs.id not in taken:
        teacher = teachers[0]
        s.add(Loan(school_id=s.sid, copy_id=cs.id, teacher_user_id=teacher.id, for_class_id=list(ctx.classes.values())[-1].id, issued_by=librarian.id if librarian else None,
                   issued_at=_at(s.today - timedelta(days=9), 9), due_date=s.today + timedelta(days=20), note="Class reader for the term"))
        cs.status = "on_loan"
    s.flush()


MENU = {
    "Breakfast": [("Tea with bread and margarine", "Porridge and boiled eggs", "Tea and mandazi", "Uji and sweet potatoes", "Tea with chapati")],
    "Morning tea": [("Tea and bread", "Porridge", "Uji", "Tea and mandazi", "Fruit and milk")],
    "Lunch": [("Ugali, sukuma wiki and beef stew", "Rice and beans", "Githeri with cabbage", "Chapati and green grams", "Ugali, fish and kachumbari")],
    "Supper": [("Rice and cabbage", "Ugali and omena", "Matoke and beef", "Pilau", "Ugali, managu and eggs")],
}


def seed_meals(s: Seeder, ctx: Ctx):
    times = [("Morning tea", time(10, 0), time(10, 30), "all"), ("Lunch", time(12, 30), time(13, 30), "all")]
    if ctx.boarding:
        times = [("Breakfast", time(6, 45), time(7, 30), "boarders")] + times + [("Supper", time(18, 30), time(19, 15), "boarders")]
    for i, (name, a, b, aud) in enumerate(times, start=1):
        mt = s.add(MealTime(school_id=s.sid, position=i, name=name, start_time=a, end_time=b, audience=aud))
        s.flush()
        for wd in range(5):
            s.add(WeeklyMenuItem(meal_time_id=mt.id, weekday=wd, description=MENU[name][0][wd]))
    # The dated menu parents and learners see for the coming days.
    for offset in range(0, 7):
        d = s.today + timedelta(days=offset)
        if d.weekday() > 4:
            continue
        s.add(MealMenu(school_id=s.sid, date=d, meal_type="snack", description=MENU["Morning tea"][0][d.weekday()]))
        s.add(MealMenu(school_id=s.sid, date=d, meal_type="lunch", description=MENU["Lunch"][0][d.weekday()]))
        if ctx.boarding:
            s.add(MealMenu(school_id=s.sid, date=d, meal_type="breakfast", description=MENU["Breakfast"][0][d.weekday()]))
    s.flush()


AREAS = [("Kapsoya", "Kapsoya Shopping Centre"), ("Langas", "Langas Market"), ("Huruma", "Huruma Estate"), ("Elgon View", "Elgon View Estate"), ("Kimumu", "Kimumu Junction"), ("Pioneer", "Pioneer Estate")]


def seed_transport(s: Seeder, ctx: Ctx, tag: str):
    attendants = ctx.staff.get(UserRole.TRANSPORT_ATTENDANT, [])
    learners = [st for sts in ctx.students.values() for st in sts]
    vehicles = []
    for i in range(2):
        driver = s.person(female=False)
        vehicles.append(s.add(Vehicle(
            school_id=s.sid, registration_number=f"K{s.rng.choice('ABCD')}{s.rng.choice('ABCDEFGHJKL')}{s.rng.choice('ABCDEFGHJKL')} {s.rng.randint(100, 999)}{s.rng.choice('ABCDEFGHJKLMNPRSTUVWXYZ')}",
            capacity=33 if i == 0 else 52, driver_name=driver["full"], driver_phone=s.phone(), vehicle_type="bus",
            make_model=["Isuzu NQR", "Toyota Coaster"][i], insurance_expiry=s.today + timedelta(days=s.rng.randint(25, 300)),
            inspection_expiry=s.today + timedelta(days=s.rng.randint(15, 200)), next_service_date=s.today + timedelta(days=s.rng.randint(5, 60)),
            attendant_user_id=attendants[i].id if i < len(attendants) else None,
        )))
    s.flush()
    routes = []
    for i, (area, stop) in enumerate(AREAS[:3]):
        r = s.add(TransportRoute(school_id=s.sid, vehicle_id=vehicles[i % 2].id, name=f"{area} route", description=f"Morning and afternoon run through {area} and neighbouring estates",
                                 school_arrival_time=time(7, 30), afternoon_departure_time=time(16, 0)))
        s.flush()
        stops = []
        for j, nm in enumerate([stop, f"{area} Primary", f"{area} Stage"], start=1):
            stops.append(s.add(RouteStop(route_id=r.id, name=nm, stop_order=j, pickup_time=time((400 + 12 * j) // 60, (400 + 12 * j) % 60))))
        s.flush()
        routes.append((r, stops))
    # About one learner in four rides the bus.
    riders = [st for idx, st in enumerate(learners) if idx % 4 == 0]
    for idx, st in enumerate(riders):
        r, stops = routes[idx % len(routes)]
        st.transport_route_id = r.id
        st.transport_stop_id = stops[idx % len(stops)].id
    s.flush()
    # The last five school days of runs, all completed except this afternoon's.
    for d in s.school_days_back(5):
        for r, stops in routes:
            mine = [st for st in riders if st.transport_route_id == r.id]
            for direction in ("morning", "afternoon"):
                today_pm = d == s.today and direction == "afternoon"
                attendant = attendants[0] if attendants else None
                run = s.add(TransportRun(
                    school_id=s.sid, route_id=r.id, vehicle_id=r.vehicle_id, run_date=d, direction=direction,
                    status="completed" if not today_pm else "in_progress", started_by=attendant.id if attendant else None,
                    started_at=_at(d, 6 if direction == "morning" else 16, 20), completed_at=_at(d, 7, 35) if direction == "morning" else (None if today_pm else _at(d, 17, 10)),
                ))
                s.flush()
                for st in mine:
                    absent = s.rng.random() < 0.05
                    s.add(TransportBoarding(
                        run_id=run.id, student_id=st.id, stop_id=st.transport_stop_id,
                        status="absent" if absent else ("pending" if today_pm else ("boarded" if direction == "morning" else "dropped")),
                        boarded_at=None if absent else _at(d, 6, 55), recorded_by=attendant.id if attendant else None,
                        handed_to=None if direction == "morning" or absent else st.guardian_name,
                    ))
    # A few gate drop-offs and pick-ups the parents can see.
    for st in s.rng.sample(learners, min(10, len(learners))):
        d = s.today - timedelta(days=s.rng.randint(0, 4))
        s.add(PickupDropoffLog(school_id=s.sid, student_id=st.id, event_type=PickupDropoffType.DROPOFF, person_name=st.guardian_name or "Guardian", occurred_at=_at(d, 7, 25), source="gate", at_school=True))
        s.add(PickupDropoffLog(school_id=s.sid, student_id=st.id, event_type=PickupDropoffType.PICKUP, person_name=st.guardian_name or "Guardian", occurred_at=_at(d, 16, 5), source="gate", at_school=True))
    s.flush()


def seed_boarding(s: Seeder, ctx: Ctx):
    if not ctx.boarding:
        return
    staff = _first(ctx, UserRole.BOARDING_STAFF)
    houses = {
        "male": s.add(BoardingHouse(school_id=s.sid, name="Simba House", gender="male", total_beds=40)),
        "female": s.add(BoardingHouse(school_id=s.sid, name="Twiga House", gender="female", total_beds=40)),
    }
    s.flush()
    beds = {"male": 0, "female": 0}
    boarders = []
    for g in ctx.grades:
        if g.sort_order < 6:   # boarding from Grade 4 upwards
            continue
        for idx, st in enumerate(ctx.students[ctx.classes[g.code].id]):
            if idx % 3 != 0:
                continue
            gender = st.gender or "male"
            beds[gender] += 1
            s.add(BoardingAssignment(school_id=s.sid, student_id=st.id, house_id=houses[gender].id, bed_number=f"B{beds[gender]:02d}"))
            boarders.append((st, gender))
    s.flush()
    by_house = {k: [st for st, g in boarders if g == k] for k in houses}
    for d in s.school_days_back(3):
        for gender, house in houses.items():
            for session in (RollSession.MORNING, RollSession.EVENING, RollSession.NIGHT):
                marks = {str(st.id): ("S" if s.rng.random() < 0.03 else "P") for st in by_house[gender]}
                s.add(BoardingRollCall(school_id=s.sid, house_id=house.id, date=d, session=session, marks=marks, recorded_by=staff.id if staff else None))
    if boarders:
        pool = [st for st, _ in boarders]
        for status, offset in ((ExeatStatus.PENDING, 1), (ExeatStatus.APPROVED, 3), (ExeatStatus.OUT, 0), (ExeatStatus.RETURNED, -4)):
            st = s.rng.choice(pool)
            s.add(Exeat(
                school_id=s.sid, student_id=st.id, from_date=s.today + timedelta(days=offset), to_date=s.today + timedelta(days=offset + 2), reason=s.rng.choice(["Family event", "Medical appointment", "Wedding", "Funeral"]),
                detail="Going home with a parent for the weekend", pickup_name=st.guardian_name or "Guardian", pickup_relation="Parent", pickup_phone=s.phone(), status=status,
                gate_pass=f"GP-{s.rng.randint(1000, 9999)}" if status != ExeatStatus.PENDING else None, approved_by=_hid(s) if status != ExeatStatus.PENDING else None,
                out_at=_at(s.today, 9) if status == ExeatStatus.OUT else None, back_at=_at(s.today - timedelta(days=1), 17) if status == ExeatStatus.RETURNED else None,
            ))
        for complaint, action in (("Headache", SickBayAction.REST_IN_SICK_BAY), ("Stomach ache", SickBayAction.FIRST_AID), ("Fever", SickBayAction.REFER_TO_CLINIC), ("Sprained ankle", SickBayAction.FIRST_AID), ("Cough and cold", SickBayAction.REST_IN_SICK_BAY)):
            st = s.rng.choice(pool)
            s.add(SickBayVisit(school_id=s.sid, student_id=st.id, complaint=complaint, temperature=round(s.rng.uniform(36.4, 38.6), 1), action=action,
                               status="Resting" if action == SickBayAction.REST_IN_SICK_BAY else "Treated", parent_notified=True, logged_by=staff.id if staff else None))
    for kind, desc, act, status in (("Lights out breach", "Learners found talking after lights out.", "Warned and reported to the house master.", IncidentStatus.CLOSED), ("Missing item", "A learner reported a missing water bottle.", "Search under way.", IncidentStatus.OPEN)):
        s.add(BoardingIncident(school_id=s.sid, house_id=houses["male"].id, type=kind, description=desc, action_taken=act, status=status, logged_by=staff.id if staff else None))
    s.flush()


def seed_security(s: Seeder, ctx: Ctx):
    guard = _first(ctx, UserRole.SECURITY)
    gid = guard.id if guard else None
    purposes = ["Meeting the head teacher", "Collecting a report card", "Delivering supplies", "Parent visit", "Repair work", "Admissions tour"]
    hosts = [t.full_name for t, _ in ctx.teachers[:6]]
    for i in range(14):
        p = s.person()
        d = s.today - timedelta(days=s.rng.choice([0, 0, 1, 1, 2, 3]))
        out = s.rng.random() < 0.75 or d != s.today
        s.add(VisitorLog(
            school_id=s.sid, badge=f"V-{100 + i}", name=p["full"], id_number_masked=f"****{s.rng.randint(1000, 9999)}", phone=s.phone(), purpose=s.rng.choice(purposes),
            host_name=s.rng.choice(hosts), vehicle_registration=(f"KC{s.rng.choice('ABCDE')} {s.rng.randint(100, 999)}X" if s.rng.random() < 0.3 else None),
            signed_in_at=_at(d, s.rng.randint(8, 14), s.rng.randint(0, 59)), signed_out_at=_at(d, 15, 10) if out else None,
        ))
    for i in range(8):
        d = s.today - timedelta(days=s.rng.randint(0, 3))
        s.add(VehicleLog(school_id=s.sid, registration=f"K{s.rng.choice('ABCD')}{s.rng.choice('ABC')}{s.rng.choice('ABC')} {s.rng.randint(100, 999)}Z", direction=VehicleDirection.IN if i % 2 == 0 else VehicleDirection.OUT,
                         driver_name=s.person(female=False)["full"], purpose=s.rng.choice(["Supplier delivery", "Staff vehicle", "Visitor", "Repair"]), logged_at=_at(d, s.rng.randint(8, 16))))
    head = _head(s)
    s.add(VehicleReleaseRequest(school_id=s.sid, registration="KDA 482M", driver_name=s.person(female=False)["full"], purpose="Take the sports team to the zonal meet", status=VehicleReleaseStatus.PENDING, requested_by=gid))
    s.add(VehicleReleaseRequest(school_id=s.sid, registration="KCB 117T", driver_name=s.person(female=False)["full"], purpose="Fetch food supplies", status=VehicleReleaseStatus.APPROVED, requested_by=gid, decided_by=head.id if head else None, decided_at=_at(s.today - timedelta(days=1), 10)))
    learners = [st for sts in ctx.students.values() for st in sts]
    for st in s.rng.sample(learners, min(4, len(learners))):
        s.add(EarlyPickup(school_id=s.sid, student_id=st.id, collected_by=st.guardian_name or "Guardian", relation="Parent", reason=s.rng.choice(["Clinic appointment", "Family emergency", "Travel"]), verified=True, logged_by=gid))
    for kind, loc, sev, desc, act, status in (
        ("Unauthorised entry attempt", "Main gate", IncidentSeverity.MEDIUM, "A man tried to enter without signing in.", "Turned away and logged.", SecurityIncidentStatus.CLOSED),
        ("Broken fence", "East boundary", IncidentSeverity.LOW, "A section of the fence is damaged.", "Reported to the maintenance team.", SecurityIncidentStatus.OPEN),
        ("Lost property", "Playground", IncidentSeverity.LOW, "A bag was found unattended.", "Taken to the office.", SecurityIncidentStatus.CLOSED),
    ):
        s.add(SecurityIncident(school_id=s.sid, type=kind, location=loc, severity=sev, description=desc, action_taken=act, status=status, logged_by=gid))
    s.add(SecurityAlert(school_id=s.sid, type="Drill", message="Fire evacuation drill completed in 3 minutes.", active=False, sms_parents=False, raised_by=gid))
    for i in range(10):
        s.add(PatrolLog(school_id=s.sid, post=s.rng.choice(["Main gate", "Dormitories", "Kitchen", "Classroom block", "Playground"]), ok=s.rng.random() < 0.9, note="All clear" if i % 5 else "Light out, reported", logged_by=gid))
    s.flush()


def seed_staff_attendance(s: Seeder, ctx: Ctx):
    people = [t for t, _ in ctx.teachers] + [u for users in ctx.staff.values() for u in users]
    for d in s.school_days_back(10):
        for u in people:
            roll = s.rng.random()
            if roll < 0.05:
                continue   # no scan: absent
            hour, minute = (6, s.rng.randint(35, 59)) if roll < 0.75 else (7, s.rng.randint(0, 40)) if roll < 0.93 else (8, s.rng.randint(5, 40))
            s.add(StaffAttendance(school_id=s.sid, user_id=u.id, date=d, clocked_in_at=_at(d, hour, minute), clocked_out_at=_at(d, 17, s.rng.randint(0, 40)) if d != s.today else None))
    for u in s.rng.sample(people, 3):
        s.add(StaffLeave(school_id=s.sid, user_id=u.id, start_date=s.today + timedelta(days=s.rng.randint(1, 5)), end_date=s.today + timedelta(days=s.rng.randint(6, 9)), leave_type=s.rng.choice(["annual", "sick", "study"]), note="Approved by the head", recorded_by=_hid(s)))
    for i, d in enumerate(s.school_days_back(5)):
        t = ctx.teachers[i % len(ctx.teachers)][0]
        s.add(DutyAssignment(school_id=s.sid, user_id=t.id, title="Teacher on duty", date=d, start_time=time(7, 0), end_time=time(8, 0), notes="Gate and assembly", assigned_by=_hid(s)))
    s.flush()
