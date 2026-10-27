"""Fees set once per grade for each term, billed to every learner in one step,
with the arrears picture and reminders to parents."""

from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.approvals import register, submit_or_apply
from app.core.audit import record_audit
from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.core.mailer import send_email
from app.core.mobilesasa import MobileSasaError, send_sms
from app.core.phone import normalize_kenyan_phone
from app.models.academic_term import AcademicTerm
from app.models.academics import SchoolClass, Student
from app.models.communication_config import SchoolCommunicationConfig
from app.models.fee_structure import FeeStructureLine
from app.models.fees import FeeInvoice
from app.models.grade_level import GradeLevel
from app.models.school import School
from app.models.user import User, UserRole
from app.schemas.fee_structure import (
    BalanceRow, BalancesOut, FeeLineOut, FeeSaveResult, FeeStructureIn, FeeStructureOut, GenerateIn, GenerateResult, RemindIn, RemindResult,
)

router = APIRouter(prefix="/schools/{school_id}/fees", tags=["fees"], dependencies=[Depends(require_feature("fees"))])

# The fee desk applies changes at once; the secretary prepares them for the head.
DESK = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.BURSAR, UserRole.ACCOUNTANT)
SET_ROLES = DESK + (UserRole.SECRETARY,)
READ_ROLES = DESK + (UserRole.STAFF, UserRole.SECRETARY)
CATEGORIES = ("tuition", "boarding", "transport", "meals", "activities", "uniform", "other")


def _term_or_400(db: Session, school_id: int, name: str) -> AcademicTerm:
    term = db.query(AcademicTerm).filter_by(school_id=school_id, name=name).first()
    if term is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Set up “{name}” under Academic Terms before setting its fees")
    return term


def _validate(db: Session, school_id: int, term: str, lines: list[dict]) -> None:
    _term_or_400(db, school_id, term)
    seen = set()
    grades = {r[0] for r in db.query(GradeLevel.id)}
    for l in lines:
        if l["grade_level_id"] not in grades:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "One of the grades does not exist")
        cat = l["category"].strip().lower()
        if (l["grade_level_id"], cat) in seen:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Each grade can have each fee only once")
        seen.add((l["grade_level_id"], cat))


def apply_structure(db: Session, school_id: int, term: str, lines: list[dict]) -> None:
    _validate(db, school_id, term, lines)
    db.query(FeeStructureLine).filter_by(school_id=school_id, term=term).delete()
    db.flush()
    for l in lines:
        if float(l["amount"]) > 0:
            db.add(FeeStructureLine(school_id=school_id, term=term, grade_level_id=l["grade_level_id"], category=l["category"].strip().lower(), amount=l["amount"]))


@register("fee_structure")
def _apply(db: Session, school_id: int, payload: dict, actor: User) -> None:
    apply_structure(db, school_id, payload["term"], payload["lines"])
    record_audit(db, school_id=school_id, actor_id=actor.id, action="fee_structure.set", entity_type="fee_structure", entity_id=0, after={"term": payload["term"], "lines": len(payload["lines"])})


@router.get("/structure", response_model=FeeStructureOut, dependencies=[Depends(require_roles(*READ_ROLES))])
def get_structure(school_id: int, term: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    lines = db.query(FeeStructureLine).filter_by(school_id=school_id, term=term).all()
    lines.sort(key=lambda l: (l.grade.sort_order, l.category))
    per_grade: dict[str, int] = defaultdict(int)
    for s, cls in db.query(Student, SchoolClass).join(SchoolClass, Student.class_id == SchoolClass.id).filter(Student.school_id == school_id, Student.is_active.is_(True)):
        if cls.grade_level_id:
            per_grade[str(cls.grade_level_id)] += 1
    return FeeStructureOut(
        term=term,
        lines=[FeeLineOut(id=l.id, grade_level_id=l.grade_level_id, category=l.category, amount=float(l.amount), grade_code=l.grade.code, grade_name=l.grade.display_name) for l in lines],
        learners_by_grade=dict(per_grade),
    )


@router.put("/structure", response_model=FeeSaveResult, dependencies=[Depends(require_roles(*SET_ROLES))])
def set_structure(school_id: int, payload: FeeStructureIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Set a term's fees for every grade. The bursar, accountant and head save
    at once; the secretary's change waits for the head to approve it."""
    ensure_school_access(db, current_user, school_id)
    body = [l.model_dump() for l in payload.lines]
    _validate(db, school_id, payload.term, body)
    total = sum(l["amount"] for l in body)
    req = submit_or_apply(
        db, school_id, current_user, kind="fee_structure", scope=payload.term,
        title=f"Fees for {payload.term}", summary=f"{len(body)} fee lines across {len({l['grade_level_id'] for l in body})} grades", payload={"term": payload.term, "lines": body}, direct_roles=DESK,
    )
    db.commit()
    if req is not None:
        return FeeSaveResult(applied=False, request_id=req.id, message="Sent to the head of institution for approval.")
    return FeeSaveResult(applied=True, message="The fees have been saved.")


@router.post("/structure/generate", response_model=GenerateResult, dependencies=[Depends(require_roles(*DESK))])
def generate_invoices(school_id: int, payload: GenerateIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Bill every active learner according to their grade's fees for the term.
    Running it again only fills in what is missing; nobody is billed twice."""
    ensure_school_access(db, current_user, school_id)
    _term_or_400(db, school_id, payload.term)
    lines = db.query(FeeStructureLine).filter_by(school_id=school_id, term=payload.term).all()
    if not lines:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No fees are set for this term yet")
    by_grade: dict[int, list[FeeStructureLine]] = defaultdict(list)
    for l in lines:
        by_grade[l.grade_level_id].append(l)
    existing = {(i.student_id, i.category) for i in db.query(FeeInvoice).filter_by(school_id=school_id, term=payload.term)}
    created = skipped = ungraded = 0
    billed = 0.0
    q = db.query(Student, SchoolClass).outerjoin(SchoolClass, Student.class_id == SchoolClass.id).filter(Student.school_id == school_id, Student.is_active.is_(True))
    for student, cls in q:
        grade = cls.grade_level_id if cls else None
        if grade is None:
            ungraded += 1
            continue
        for line in by_grade.get(grade, []):
            if (student.id, line.category) in existing:
                skipped += 1
                continue
            db.add(FeeInvoice(school_id=school_id, student_id=student.id, term=payload.term, category=line.category, amount_due=line.amount, due_date=payload.due_date))
            created += 1
            billed += float(line.amount)
    record_audit(db, school_id=school_id, actor_id=current_user.id, action="fee_invoices.generate", entity_type="fee_structure", entity_id=0, after={"term": payload.term, "created": created, "billed": billed})
    db.commit()
    return GenerateResult(created=created, skipped_existing=skipped, learners_without_grade=ungraded, total_billed=round(billed, 2))


def _balances(db: Session, school_id: int, term: str | None) -> list[BalanceRow]:
    per_student: dict[int, dict] = defaultdict(lambda: {"billed": 0.0, "paid": 0.0, "arrears": 0.0})
    for inv in db.query(FeeInvoice).filter_by(school_id=school_id):
        due, paid = float(inv.amount_due), float(inv.amount_paid)
        d = per_student[inv.student_id]
        if term is None or inv.term == term:
            d["billed"] += due
            d["paid"] += paid
        else:
            d["arrears"] += max(0.0, due - paid)
    rows = []
    for s, cls in db.query(Student, SchoolClass).outerjoin(SchoolClass, Student.class_id == SchoolClass.id).filter(Student.school_id == school_id, Student.is_active.is_(True)):
        d = per_student.get(s.id, {"billed": 0.0, "paid": 0.0, "arrears": 0.0})
        balance = max(0.0, d["billed"] - d["paid"])
        rows.append(BalanceRow(
            student_id=s.id, name=f"{s.first_name} {s.last_name}", admission_number=s.admission_number, class_name=cls.name if cls else None,
            guardian_name=s.guardian_name, guardian_phone=s.guardian_phone, guardian_email=s.guardian_email,
            billed=round(d["billed"], 2), paid=round(d["paid"], 2), balance=round(balance, 2), arrears=round(d["arrears"], 2), total_owed=round(balance + d["arrears"], 2),
        ))
    return rows


@router.get("/balances", response_model=BalancesOut, dependencies=[Depends(require_roles(*DESK, UserRole.STAFF))])
def list_balances(
    school_id: int,
    term: str | None = None,
    class_id: int | None = None,
    min_owed: float | None = Query(default=None, ge=0),
    max_owed: float | None = Query(default=None, ge=0),
    exact_owed: float | None = Query(default=None, ge=0),
    arrears_only: bool = False,
    owing_only: bool = True,
    q: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Every learner's fee position for a term, with what is still owed from
    earlier terms. Filter by class, by an amount owed (at least, at most, or
    exactly), or to those with arrears only."""
    ensure_school_access(db, current_user, school_id)
    rows = _balances(db, school_id, term)
    if class_id is not None:
        name = db.query(SchoolClass.name).filter_by(school_id=school_id, id=class_id).scalar()
        rows = [r for r in rows if r.class_name == name]
    if owing_only:
        rows = [r for r in rows if r.total_owed > 0]
    if arrears_only:
        rows = [r for r in rows if r.arrears > 0]
    if min_owed is not None:
        rows = [r for r in rows if r.total_owed >= min_owed]
    if max_owed is not None:
        rows = [r for r in rows if r.total_owed <= max_owed]
    if exact_owed is not None:
        rows = [r for r in rows if abs(r.total_owed - exact_owed) < 0.005]
    if q:
        needle = q.strip().lower()
        rows = [r for r in rows if needle in f"{r.name} {r.admission_number} {r.guardian_name or ''}".lower()]
    rows.sort(key=lambda r: -r.total_owed)
    totals = {"billed": round(sum(r.billed for r in rows), 2), "paid": round(sum(r.paid for r in rows), 2), "balance": round(sum(r.balance for r in rows), 2), "arrears": round(sum(r.arrears for r in rows), 2), "total_owed": round(sum(r.total_owed for r in rows), 2), "learners": float(len(rows))}
    return BalancesOut(term=term, rows=rows, totals=totals)


DEFAULT_MESSAGE = "Dear {guardian}, {student} has a fee balance of KES {owed} at {school}. Please clear it at your earliest convenience. Thank you."


def render(template: str, row: BalanceRow, school: str) -> str:
    return (
        template.replace("{guardian}", row.guardian_name or "Parent/Guardian")
        .replace("{student}", row.name)
        .replace("{owed}", f"{row.total_owed:,.0f}")
        .replace("{balance}", f"{row.balance:,.0f}")
        .replace("{arrears}", f"{row.arrears:,.0f}")
        .replace("{school}", school)
    )


@router.post("/balances/remind", response_model=RemindResult, dependencies=[Depends(require_roles(*DESK))])
def remind_parents(school_id: int, payload: RemindIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Send each selected learner's parent or guardian their own balance, by
    SMS and/or email. SMS uses the school's own credits."""
    ensure_school_access(db, current_user, school_id)
    school = db.get(School, school_id)
    wanted = set(payload.student_ids)
    rows = [r for r in _balances(db, school_id, payload.term) if r.student_id in wanted and r.total_owed > 0]
    template = (payload.message or DEFAULT_MESSAGE).strip()
    config = db.query(SchoolCommunicationConfig).filter_by(school_id=school_id).first()
    sms_ready = bool(config and config.sms_configured)
    result = RemindResult(sms_sent=0, email_sent=0, no_contact=[])
    if payload.sms and not sms_ready:
        result.sms_error = "SMS is not set up for this school yet. Add the SMS details under Communication Settings."
    for r in rows:
        reached = False
        text = render(template, r, school.name if school else "the school")
        if payload.sms and sms_ready and r.guardian_phone:
            try:
                send_sms(config, phone=normalize_kenyan_phone(r.guardian_phone), message=text)
                result.sms_sent += 1
                reached = True
            except (MobileSasaError, HTTPException) as exc:
                result.sms_error = str(exc.detail if isinstance(exc, HTTPException) else exc)
        if payload.email and r.guardian_email:
            if send_email(r.guardian_email, f"Fee balance for {r.name}", text, reply_to=current_user.email):
                result.email_sent += 1
                reached = True
        if not reached:
            result.no_contact.append(r.name)
    if payload.email and result.email_sent == 0 and rows:
        result.email_error = "Email is not set up on this server yet, or no parent email is on file."
    record_audit(db, school_id=school_id, actor_id=current_user.id, action="fee_reminder.send", entity_type="fee_structure", entity_id=0, after={"learners": len(rows), "sms": result.sms_sent, "email": result.email_sent})
    db.commit()
    return result
