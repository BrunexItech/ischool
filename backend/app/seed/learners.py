from datetime import date

from app.models.academics import Student
from app.models.attendance import AttendanceRecord, AttendanceStatus
from app.models.results import Result
from app.models.user import UserRole
from app.seed.academics import Ctx
from app.seed.core import Seeder

PER_CLASS = 10
PARENT_LOGINS_PER_CLASS = 4
STUDENT_LOGINS_PER_CLASS = 2


def _grade_age(sort_order: int) -> int:
    return 3 + sort_order   # PP1 (1) is four, Grade 1 (3) is six, Grade 9 (11) is fourteen


def seed_learners(s: Seeder, ctx: Ctx, tag: str):
    year = s.today.year
    seq = 0
    for g in ctx.grades:
        c = ctx.classes[g.code]
        learners = []
        for i in range(PER_CLASS):
            seq += 1
            has_login = i < STUDENT_LOGINS_PER_CLASS
            child = s.person(unique_first=has_login)
            age = _grade_age(g.sort_order)
            dob = date(year - age - s.rng.choice([0, 0, 1]), s.rng.randint(1, 12), s.rng.randint(1, 27))
            adm = f"{tag}/{year}/{seq:03d}"

            parent_user = None
            parent = s.person(unique_first=(i < PARENT_LOGINS_PER_CLASS))
            parent["last"] = child["last"]
            parent["full"] = f"{parent['first']} {parent['middle']} {child['last']}"
            if i < PARENT_LOGINS_PER_CLASS:
                parent_user, _ = s.account(UserRole.PARENT, person=parent)
            student_user = None
            if has_login:
                student_user, _ = s.account(UserRole.STUDENT, person=child)

            st = s.add(Student(
                school_id=s.sid, class_id=c.id, admission_number=adm, first_name=child["first"], last_name=f"{child['middle']} {child['last']}",
                date_of_birth=dob, gender="female" if child["female"] else "male",
                upi_number="".join(s.rng.choice("ABCDEFGHJKLMNPQRSTUVWXYZ0123456789") for _ in range(9)),
                assessment_number=(f"{s.rng.randint(10_000_000, 99_999_999)}" if g.code in ("G6", "G9") else None),
                birth_certificate_number=f"{s.rng.randint(1_000_000, 9_999_999)}", nationality="Kenyan",
                guardian_name=parent["full"], guardian_phone=s.phone(),
                guardian_email=(parent_user.email if parent_user else None),
                user_id=student_user.id if student_user else None, guardian_user_id=parent_user.id if parent_user else None,
                is_demo=True,
            ))
            learners.append(st)
        s.flush()
        ctx.students[c.id] = learners


def seed_attendance(s: Seeder, ctx: Ctx, days: int = 14):
    reasons = {AttendanceStatus.ABSENT: ["Unwell", "Family matter", "Travelled upcountry", "Fever"], AttendanceStatus.EXCUSED: ["Clinic appointment", "Funeral", "Permission from the head"]}
    for day in s.school_days_back(days):
        for c_id, learners in ctx.students.items():
            teacher = ctx.homeroom[c_id]
            for st in learners:
                roll = s.rng.random()
                status = AttendanceStatus.PRESENT if roll < 0.92 else AttendanceStatus.LATE if roll < 0.95 else AttendanceStatus.ABSENT if roll < 0.98 else AttendanceStatus.EXCUSED
                s.add(AttendanceRecord(
                    school_id=s.sid, class_id=c_id, student_id=st.id, date=day, status=status,
                    reason=s.rng.choice(reasons[status]) if status in reasons else None, recorded_by=teacher.id,
                ))
    s.flush()


def _level(score: float) -> str:
    return "EE" if score >= 80 else "ME" if score >= 50 else "AE" if score >= 30 else "BE"


REMARKS = {"EE": ["Outstanding work", "Keep it up", "Exceptional understanding"], "ME": ["Good progress", "Steady effort", "Meeting the expected standard"],
           "AE": ["Needs more practice", "Can do better with revision"], "BE": ["Needs close support"]}


def seed_results(s: Seeder, ctx: Ctx):
    """Last term's end-of-term marks, and this term's opener and mid-term, for every learner and learning area."""
    y = s.today.year
    prev = ctx.terms[ctx.terms.index(ctx.term) - 1] if ctx.terms.index(ctx.term) > 0 else None
    sittings = [(ctx.term, "CAT 1"), (ctx.term, "Mid Term")]
    if prev:
        sittings.append((prev, "End Term"))
    for g in ctx.grades:
        c = ctx.classes[g.code]
        for st in ctx.students[c.id]:
            ability = s.rng.gauss(62, 13)
            for subject in ctx.class_subjects[c.id]:
                flavour = s.rng.gauss(0, 8)
                for term, kind in sittings:
                    score = max(12, min(99, round(ability + flavour + s.rng.gauss(0, 6))))
                    lvl = _level(score)
                    s.add(Result(
                        school_id=s.sid, student_id=st.id, subject_id=ctx.subjects[subject].id, term=term, exam_type=kind,
                        score=score, grade=lvl, remarks=s.rng.choice(REMARKS[lvl]) if kind == "End Term" else None,
                        recorded_by=ctx.subject_teacher[(c.id, subject)].id,
                    ))
    s.flush()
