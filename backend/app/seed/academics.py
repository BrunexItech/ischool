from dataclasses import dataclass, field
from datetime import date, time, timedelta

from app.core.day_structure import default_day, validate_day
from app.core.grading import DEFAULT_BANDS
from app.models.academic_term import AcademicTerm
from app.models.academics import SchoolClass, StaffProfile, Student
from app.models.grade_level import GradeLevel, SchoolEnabledGrade
from app.models.grading_band import GradingBand
from app.models.module import SchoolModule
from app.models.results import Subject, SubjectLevel
from app.models.school_period import SchoolPeriod
from app.models.teacher_assignment import TeacherAssignment
from app.models.timetable import TimetableSlot
from app.models.user import UserRole
from app.seed import cbc
from app.seed.classes import classes_for
from app.seed.core import Seeder

TEACHABLE = ("lesson",)


@dataclass
class Ctx:
    grades: list = field(default_factory=list)          # enabled GradeLevel rows, in order
    classes: dict = field(default_factory=dict)         # grade code -> the first SchoolClass of that grade
    class_list: list = field(default_factory=list)      # [(GradeLevel, SchoolClass)] for every class, in grade order
    subjects: dict = field(default_factory=dict)        # subject name -> Subject
    class_subjects: dict = field(default_factory=dict)  # class id -> list of subject names
    periods: dict = field(default_factory=dict)         # level group -> [SchoolPeriod]
    teachers: list = field(default_factory=list)        # [(User, person)]
    homeroom: dict = field(default_factory=dict)        # class id -> User
    subject_teacher: dict = field(default_factory=dict) # (class id, subject name) -> User
    students: dict = field(default_factory=dict)        # class id -> [Student]
    term: str = ""
    terms: list = field(default_factory=list)           # [AcademicTerm]
    boarding: bool = False
    slots: list = field(default_factory=list)
    staff: dict = field(default_factory=dict)           # role -> [User] for the non-teaching staff
    ledger: dict = field(default_factory=dict)          # account code -> Account


def _group(grade: GradeLevel) -> str:
    return grade.level_group.value


def seed_terms(s: Seeder, ctx: Ctx):
    y = s.today.year
    spans = [
        (f"Term 1 {y}", date(y, 1, 5), date(y, 4, 3)),
        (f"Term 2 {y}", date(y, 4, 27), date(y, 7, 31)),
        (f"Term 3 {y}", date(y, 8, 24), date(y, 10, 30)),
        (f"Term 1 {y + 1}", date(y + 1, 1, 4), date(y + 1, 4, 2)),
    ]
    current = next((n for n, a, b in spans if a <= s.today <= b), None)
    if current is None:   # in the holidays: the next term to open is the current one
        current = next((n for n, a, b in spans if a > s.today), spans[-1][0])
    for name, a, b in spans:
        s.add(AcademicTerm(school_id=s.sid, name=name, start_date=a, end_date=b, is_current=(name == current)))
    s.flush()
    ctx.term = current
    ctx.terms = [n for n, _, _ in spans]


def seed_bands(s: Seeder):
    if s.db.query(GradingBand.id).filter_by(school_id=s.sid).first() is None:
        for b in DEFAULT_BANDS:
            s.add(GradingBand(school_id=s.sid, **b))
        s.flush()


def seed_periods(s: Seeder, ctx: Ctx):
    groups = []
    for g in ctx.grades:
        if _group(g) not in groups:
            groups.append(_group(g))
    for gname in groups:
        with_prep = ctx.boarding and gname in ("junior_school", "senior_school")
        rows = validate_day(default_day(gname, with_prep))
        made = []
        for i, p in enumerate(rows, start=1):
            made.append(s.add(SchoolPeriod(school_id=s.sid, level_group=gname, position=i, **p)))
        s.flush()
        ctx.periods[gname] = made


def seed_subjects(s: Seeder, ctx: Ctx):
    wanted: dict[str, list[int]] = {}
    for g in ctx.grades:
        for name in cbc.BY_GRADE[g.code]:
            wanted.setdefault(name, []).append(g.id)
    for name, grade_ids in wanted.items():
        subj = s.add(Subject(school_id=s.sid, name=name))
        s.flush()
        for gid in grade_ids:
            s.add(SubjectLevel(subject_id=subj.id, grade_level_id=gid))
        ctx.subjects[name] = subj
    s.flush()


def _staff(s: Seeder, ctx: Ctx, tag: str, number: int, department: str, female: bool | None = None):
    user, person = s.account(UserRole.TEACHER, female=female)
    s.add(StaffProfile(
        school_id=s.sid, user_id=user.id, staff_number=f"{tag}-T{number:03d}", department=department,
        phone=s.phone(), tsc_number=f"TSC/{s.rng.randint(100000, 999999)}", is_demo=True,
    ))
    ctx.teachers.append((user, person))
    return user


def seed_teachers_and_classes(s: Seeder, ctx: Ctx, tag: str):
    n = 0
    specialists: dict[str, object] = {}
    primary = [g for g in ctx.grades if _group(g) in ("pre_primary", "primary")]
    secondary = [g for g in ctx.grades if _group(g) in ("junior_school", "senior_school")]

    # One class per enabled grade.
    for g in ctx.grades:
        for name in classes_for(s.school.slug, g.code, g.display_name):
            c = s.add(SchoolClass(school_id=s.sid, name=name, grade_level=g.display_name, grade_level_id=g.id, is_demo=True))
            s.flush()
            ctx.classes.setdefault(g.code, c)
            ctx.class_list.append((g, c))
            ctx.class_subjects[c.id] = list(cbc.BY_GRADE[g.code])

    # Specialists first, so class teachers can come from them in junior and senior school.
    wanted = []
    if primary:
        wanted += [("arts", "Creative Arts and Music"), ("pe", "Physical and Health Education"), ("kiswahili", "Kiswahili")]
    if any(_group(g) == "junior_school" for g in secondary):
        wanted += [("j_languages", "Languages"), ("j_mathematics", "Mathematics and Computing"), ("j_sciences", "Sciences"), ("j_humanities", "Humanities"), ("j_technical", "Pre-Technical Studies")]
    if any(_group(g) == "senior_school" for g in secondary):
        wanted += [("s_languages", "Languages"), ("s_mathematics", "Mathematics and Computing"), ("s_sciences", "Sciences"), ("s_humanities", "Humanities and Business")]
    for key, dept in wanted:
        n += 1
        specialists[key] = _staff(s, ctx, tag, n, dept)

    # A class teacher for every class: from the specialists above in junior and senior school, a dedicated one below.
    junior_cycle = [specialists[k] for k in ("j_languages", "j_mathematics", "j_sciences", "j_humanities") if k in specialists]
    senior_cycle = [specialists[k] for k in ("s_languages", "s_mathematics", "s_sciences", "s_humanities") if k in specialists]
    ji = si = 0
    for g, c in ctx.class_list:
        grp = _group(g)
        if grp == "junior_school" and junior_cycle:
            teacher = junior_cycle[ji % len(junior_cycle)]
            ji += 1
        elif grp == "senior_school" and senior_cycle:
            teacher = senior_cycle[si % len(senior_cycle)]
            si += 1
        else:
            n += 1
            teacher = _staff(s, ctx, tag, n, "Early Years" if grp == "pre_primary" else "Primary")
        c.homeroom_teacher_id = teacher.id
        ctx.homeroom[c.id] = teacher
    s.flush()

    # Never fewer than ten teachers on a campus: a small campus gets support teachers.
    while len(ctx.teachers) < 10:
        n += 1
        _staff(s, ctx, tag, n, "Support teacher")

    # Who teaches each learning area in each class.
    for g, c in ctx.class_list:
        grp = _group(g)
        for subject in ctx.class_subjects[c.id]:
            teacher = ctx.homeroom[c.id]
            if grp in ("pre_primary", "primary"):
                kind = cbc.PRIMARY_SPECIALISTS.get(subject)
                if kind and kind in specialists and not (kind == "kiswahili" and grp == "pre_primary"):
                    teacher = specialists[kind]
            else:
                prefix = "j_" if grp == "junior_school" else "s_"
                for group_name, members in cbc.SECONDARY_GROUPS.items():
                    if subject in members:
                        teacher = specialists.get(prefix + group_name) or specialists.get(prefix + "humanities") or teacher
                        if group_name in ("arts", "pe"):
                            teacher = specialists.get("arts" if group_name == "arts" else "pe", teacher)
                        break
            ctx.subject_teacher[(c.id, subject)] = teacher
            s.add(TeacherAssignment(school_id=s.sid, teacher_user_id=teacher.id, class_id=c.id, subject_id=ctx.subjects[subject].id))
        # The class teacher also holds the class's register.
        s.add(TeacherAssignment(school_id=s.sid, teacher_user_id=ctx.homeroom[c.id].id, class_id=c.id, subject_id=None))
    s.flush()


def seed_timetable(s: Seeder, ctx: Ctx):
    busy: set = set()   # (teacher id, day, start time)
    for g, c in ctx.class_list:
        grp = _group(g)
        lessons = [p for p in ctx.periods[grp] if p.kind in TEACHABLE]
        quota = dict(cbc.BY_GRADE[g.code])
        pool = [name for name, k in quota.items() for _ in range(k)]
        s.rng.shuffle(pool)
        remaining = list(pool)
        for day in range(5):
            used_today: set = set()
            for p in lessons:
                if day not in p.days:
                    continue
                pick = None
                for name in list(remaining):
                    teacher = ctx.subject_teacher[(c.id, name)]
                    if (teacher.id, day, p.start_time) in busy:
                        continue
                    if name in used_today and quota[name] <= 5:
                        continue   # spread a learning area across the days where possible
                    pick = name
                    break
                if pick is None:
                    pick = next((n for n in remaining if (ctx.subject_teacher[(c.id, n)].id, day, p.start_time) not in busy), None)
                if pick is None:
                    continue   # nobody free: leave the slot empty rather than double-book a teacher
                remaining.remove(pick)
                used_today.add(pick)
                teacher = ctx.subject_teacher[(c.id, pick)]
                busy.add((teacher.id, day, p.start_time))
                slot = s.add(TimetableSlot(
                    school_id=s.sid, class_id=c.id, subject_id=ctx.subjects[pick].id, teacher_user_id=teacher.id,
                    day_of_week=day, start_time=p.start_time, end_time=p.end_time, room=c.name, period_id=p.id,
                ))
                ctx.slots.append((slot, c, pick))
    s.flush()
