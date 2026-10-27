"""The principal's picture of all their schools at once: a card per school,
what needs attention anywhere, the few decisions that are theirs, and a
sentence or two on who stands out. Read-only."""

from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.core.activity_feed import build_activity
from app.core.dates import school_today
from app.core.deps import principal_school_ids
from app.core.group_metrics import compare_module, m_fees
from app.core.module_pulse import weekly_report
from app.core.oversight import attendance_oversight
from app.models.expense import Expense, ExpenseStatus
from app.models.school import School
from app.models.user import User, UserRole
from app.schemas.group import GroupAttentionSummary, GroupActivity, GroupActivityEvent, GroupAttention, GroupDecision, GroupOverview, GroupReportSection, GroupSchoolCard, GroupWeeklyReport

REPORT_MODULES = ["attendance", "staff", "lessons", "homework", "results", "conduct", "fees", "finance"]


def schools_of(db: Session, user: User) -> list[School]:
    ids = principal_school_ids(db, user)
    return db.query(School).filter(School.id.in_(ids or [-1])).order_by(School.name).all() if ids else []


def _cards_and_attention(db: Session, schools: list[School]) -> tuple[list[GroupSchoolCard], list[GroupAttention]]:
    cards: list[GroupSchoolCard] = []
    attention: list[GroupAttention] = []
    for s in schools:
        today = school_today(db, s.id)
        att = attendance_oversight(db, s.id, today)
        fees = m_fees(db, s.id, today)
        wr = weekly_report(db, s)
        items = [(a, sec) for sec in wr.sections for a in sec.attention]
        urgent = sum(1 for a, _ in items if a.tone == "bad")
        items.sort(key=lambda t: 0 if t[0].tone == "bad" else 1)
        attention += [GroupAttention(school_id=s.id, school_name=s.name, text=a.text, tone=a.tone, href=a.href or sec.href) for a, sec in items[:4]]
        learners = sum(r.learners for r in att.rows)
        teachers = db.query(User).filter(User.school_id == s.id, User.role == UserRole.TEACHER, User.is_active.is_(True)).count()
        cards.append(GroupSchoolCard(
            school_id=s.id, name=s.name, learners=learners, teachers=teachers,
            attendance_today=att.school_rate if att.school_day else None,
            registers_taken=att.classes_taken if att.school_day else None,
            registers_total=att.classes_total if att.school_day else None,
            fee_rate=fees["rate"], outstanding=fees["outstanding"], attention=wr.attention_count, urgent=urgent,
        ))
    attention.sort(key=lambda a: (0 if a.tone == "bad" else 1, a.school_name))
    return cards, attention


def _decisions(db: Session, schools: list[School]) -> list[GroupDecision]:
    out: list[GroupDecision] = []
    names = {s.id: s.name for s in schools}
    for e in db.query(Expense).filter(Expense.school_id.in_(names or [-1]), Expense.status == ExpenseStatus.PENDING).order_by(Expense.date):
        today = school_today(db, e.school_id)
        out.append(GroupDecision(school_id=e.school_id, school_name=names[e.school_id], kind="expense", title=f"Expense awaiting approval: {e.description}", detail=f"KES {float(e.amount):,.0f} · {e.category}", age_days=max(0, (today - e.date).days)))
    out.sort(key=lambda d: -d.age_days)
    return out[:15]


def _spotlight(cards: list[GroupSchoolCard]) -> list[str]:
    if len(cards) < 2:
        return []
    out: list[str] = []
    att = [c for c in cards if c.attendance_today is not None]
    if len(att) >= 2:
        lo = min(att, key=lambda c: c.attendance_today)
        hi = max(att, key=lambda c: c.attendance_today)
        if lo.attendance_today != hi.attendance_today:
            out.append(f"Attendance today is highest at {hi.name} ({hi.attendance_today}%) and lowest at {lo.name} ({lo.attendance_today}%).")
    fee = [c for c in cards if c.fee_rate is not None]
    if len(fee) >= 2:
        lo = min(fee, key=lambda c: c.fee_rate)
        if lo.outstanding > 0:
            out.append(f"{lo.name} has collected the least of what it billed ({lo.fee_rate}%), with KES {lo.outstanding:,.0f} still owed.")
    busiest = max(cards, key=lambda c: (c.urgent, c.attention))
    if busiest.attention:
        out.append(f"{busiest.name} has the most to look at: {busiest.attention} item{'s' if busiest.attention != 1 else ''}{f', {busiest.urgent} urgent' if busiest.urgent else ''}.")
    return out


def group_overview(db: Session, user: User) -> GroupOverview:
    schools = schools_of(db, user)
    cards, attention = _cards_and_attention(db, schools)
    billed_paid = [m_fees(db, s.id, school_today(db, s.id)) for s in schools]
    billed = sum(f["billed"] for f in billed_paid)
    paid = sum(f["collected"] for f in billed_paid)
    marked = sum((c.attendance_today or 0) * c.learners for c in cards if c.attendance_today is not None)
    base = sum(c.learners for c in cards if c.attendance_today is not None)
    return GroupOverview(
        principal=user.full_name,
        schools=cards,
        learners=sum(c.learners for c in cards),
        teachers=sum(c.teachers for c in cards),
        attendance_today=round(marked / base, 1) if base else None,
        fee_rate=round(100 * paid / billed, 1) if billed else None,
        outstanding=round(max(0.0, billed - paid), 2),
        attention_total=sum(c.attention for c in cards),
        attention=attention[:14],
        decisions=_decisions(db, schools),
        spotlight=_spotlight(cards),
    )


def group_activity(db: Session, user: User, start: date, end: date, kinds: set[str] | None) -> GroupActivity:
    schools = schools_of(db, user)
    events: list[GroupActivityEvent] = []
    by_school: dict[str, int] = {}
    counts: dict[str, int] = {}
    for s in schools:
        evs = build_activity(db, s.id, start, end, kinds, limit=150)
        by_school[str(s.id)] = len(evs)
        for e in evs:
            counts[e.kind] = counts.get(e.kind, 0) + 1
            events.append(GroupActivityEvent(**e.model_dump(), school_id=s.id, school_name=s.name))
    events.sort(key=lambda e: e.at, reverse=True)
    return GroupActivity(start=start, end=end, total=len(events), counts=counts, by_school=by_school, events=events[:500])


def group_report(db: Session, user: User) -> GroupWeeklyReport:
    schools = schools_of(db, user)
    cards, attention = _cards_and_attention(db, schools)
    total = sum(c.attention for c in cards)
    urgent = sum(c.urgent for c in cards)
    today = max((school_today(db, s.id) for s in schools), default=date.today())
    sections = []
    for key in REPORT_MODULES:
        cmp = compare_module(db, schools, key)
        if cmp:
            sections.append(GroupReportSection(key=cmp["key"], title=cmp["title"], href=cmp["href"], columns=cmp["columns"], rows=cmp["rows"], group=cmp["group"]))
    headline = (
        f"A quiet week across your {len(schools)} school{'s' if len(schools) != 1 else ''}: nothing needs your attention."
        if total == 0
        else f"{total} thing{'s' if total != 1 else ''} need{'s' if total == 1 else ''} attention across your {len(schools)} school{'s' if len(schools) != 1 else ''}" + (f", {urgent} of them urgent." if urgent else ".")
    )
    return GroupWeeklyReport(principal=user.full_name, week_start=today - timedelta(days=today.weekday()), week_end=today, headline=headline, schools=cards, attention=attention, decisions=_decisions(db, schools), spotlight=_spotlight(cards), sections=sections)



# --- The same overview in two halves, so the page can open at once ---


def cards_fast(db: Session, schools: list[School]) -> list[GroupSchoolCard]:
    """Learners, teachers, attendance and fees for each school: quick to work out.
    What needs attention (which means building each school's weekly report) comes separately."""
    cards = []
    for s in schools:
        today = school_today(db, s.id)
        att = attendance_oversight(db, s.id, today)
        fees = m_fees(db, s.id, today)
        teachers = db.query(User).filter(User.school_id == s.id, User.role == UserRole.TEACHER, User.is_active.is_(True)).count()
        cards.append(GroupSchoolCard(
            school_id=s.id, name=s.name, learners=sum(r.learners for r in att.rows), teachers=teachers,
            attendance_today=att.school_rate if att.school_day else None,
            registers_taken=att.classes_taken if att.school_day else None, registers_total=att.classes_total if att.school_day else None,
            fee_rate=fees["rate"], outstanding=fees["outstanding"], attention=0, urgent=0,
        ))
    return cards


def overview_fast(db: Session, user: User) -> GroupOverview:
    schools = schools_of(db, user)
    cards = cards_fast(db, schools)
    fees = [m_fees(db, s.id, school_today(db, s.id)) for s in schools]
    billed = sum(f["billed"] for f in fees)
    paid = sum(f["collected"] for f in fees)
    marked = sum((c.attendance_today or 0) * c.learners for c in cards if c.attendance_today is not None)
    base = sum(c.learners for c in cards if c.attendance_today is not None)
    today = max((school_today(db, s.id) for s in schools), default=date.today())
    return GroupOverview(
        week_start=today - timedelta(days=today.weekday()), week_end=today, principal=user.full_name, schools=cards,
        learners=sum(c.learners for c in cards), teachers=sum(c.teachers for c in cards),
        attendance_today=round(marked / base, 1) if base else None, fee_rate=round(100 * paid / billed, 1) if billed else None,
        outstanding=round(max(0.0, billed - paid), 2), attention_total=0, attention=[], decisions=_decisions(db, schools), spotlight=[],
    )


def attention_summary(db: Session, user: User) -> GroupAttentionSummary:
    schools = schools_of(db, user)
    cards, items = _cards_and_attention(db, schools)
    return GroupAttentionSummary(
        per_school={str(c.school_id): {"attention": c.attention, "urgent": c.urgent} for c in cards},
        total=sum(c.attention for c in cards), urgent=sum(c.urgent for c in cards), items=items[:14], spotlight=_spotlight(cards),
    )
