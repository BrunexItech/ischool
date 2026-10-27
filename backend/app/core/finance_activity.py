"""Everything the finance, procurement and stores staff did, for the head.

The head oversees these desks rather than doing their work, so this lists each
person's actions in a date range with the amounts they handled, and can be
narrowed to one person. It reads the records the desks already keep."""

from collections import defaultdict
from datetime import date

from sqlalchemy.orm import Session

from app.core.activity_feed import _bounds, _stamp
from app.core.dates import school_tz
from app.models.expense import Expense
from app.models.fees import FeePayment
from app.models.ledger import JournalEntry
from app.models.procurement import PurchaseOrder, PurchaseRequisition
from app.models.store import StockMovement, StoreRequest
from app.models.user import User
from app.schemas.oversight import FinanceActivity, FinanceEvent, FinancePerson

AUTOMATIC_JOURNALS = {"stores", "procurement", "payroll", "assets"}   # shown through the action that caused them


def finance_activity(db: Session, school_id: int, start: date, end: date, actor_id: int | None = None) -> FinanceActivity:
    tz = school_tz(db, school_id)
    lo, hi = _bounds(db, school_id, start, end)
    users = {u.id: u for u in db.query(User).filter_by(school_id=school_id)}
    events: list[tuple[int | None, FinanceEvent]] = []

    def add(actor: int | None, at, kind: str, title: str, detail: str = "", amount: float | None = None, href: str = "/dashboard/finance") -> None:
        when = _stamp(at, tz)
        if when is None:
            return
        u = users.get(actor) if actor else None
        events.append((actor, FinanceEvent(at=when, actor=u.full_name if u else None, role=u.role.value if u else None, kind=kind, title=title, detail=detail, amount=amount, href=href)))

    for p in db.query(FeePayment).filter(FeePayment.school_id == school_id, FeePayment.paid_at >= lo, FeePayment.paid_at < hi):
        add(p.recorded_by, p.paid_at, "payment", f"Fee payment received: KES {float(p.amount):,.0f}", f"{p.method}{' · ' + p.reference if p.reference else ''}", float(p.amount), "/dashboard/fees")
    for e in db.query(Expense).filter(Expense.school_id == school_id, Expense.created_at >= lo, Expense.created_at < hi):
        add(e.recorded_by, e.created_at, "expense", f"Expense recorded: {e.description}", f"{e.category} · {e.status.value.lower()}", float(e.amount), "/dashboard/finance")
    for e in db.query(Expense).filter(Expense.school_id == school_id, Expense.approved_at >= lo, Expense.approved_at < hi):
        add(e.approved_by, e.approved_at, "approval", f"Expense approved: {e.description}", e.category, float(e.amount), "/dashboard/finance")
    for j in db.query(JournalEntry).filter(JournalEntry.school_id == school_id, JournalEntry.created_at >= lo, JournalEntry.created_at < hi, JournalEntry.source.notin_(AUTOMATIC_JOURNALS)):
        add(j.posted_by, j.created_at, "journal", f"Journal entry {j.reference}", j.memo[:140], None, "/dashboard/ledger")
    for r in db.query(PurchaseRequisition).filter(PurchaseRequisition.school_id == school_id, PurchaseRequisition.created_at >= lo, PurchaseRequisition.created_at < hi):
        add(r.requested_by, r.created_at, "requisition", f"Purchase request {r.reference}: {r.description}", f"{r.department} · {r.status.value}", float(r.total), "/dashboard/procurement")
    for o in db.query(PurchaseOrder).filter(PurchaseOrder.school_id == school_id, PurchaseOrder.created_at >= lo, PurchaseOrder.created_at < hi):
        add(o.created_by, o.created_at, "order", f"Purchase order {o.reference} {o.status.value}", f"{o.supplier.name if o.supplier else ''} · delivery {o.delivery_date:%d %b}", float(o.total), "/dashboard/procurement")
    for m in db.query(StockMovement).filter(StockMovement.school_id == school_id, StockMovement.created_at >= lo, StockMovement.created_at < hi):
        verb = {"receipt": "Stock received", "issue": "Stock issued", "adjustment": "Stocktake correction"}[m.type.value]
        add(m.recorded_by, m.created_at, "stock", f"{verb}: {m.quantity} {m.item.unit} of {m.item.name}", (m.department or m.note or ""), float(m.item.unit_cost) * m.quantity, "/dashboard/stores")
    for s in db.query(StoreRequest).filter(StoreRequest.school_id == school_id, StoreRequest.decided_at >= lo, StoreRequest.decided_at < hi):
        add(s.decided_by, s.decided_at, "store_request", f"Store request {s.reference} {s.status}", s.department, None, "/dashboard/stores")

    if actor_id is not None:
        events = [(a, e) for a, e in events if a == actor_id]
    events.sort(key=lambda t: t[1].at, reverse=True)

    people: dict[int, FinancePerson] = {}
    totals: dict[str, float] = defaultdict(float)
    for actor, e in events:
        if e.kind in ("payment", "expense"):
            totals[e.kind] += e.amount or 0
        if actor is None or actor not in users:
            continue
        person = people.setdefault(actor, FinancePerson(user_id=actor, name=users[actor].full_name, role=users[actor].role.value, actions=0, amount=0.0, by_kind={}))
        person.actions += 1
        person.amount += e.amount or 0
        person.by_kind[e.kind] = person.by_kind.get(e.kind, 0) + 1
    return FinanceActivity(
        start=start,
        end=end,
        people=sorted(people.values(), key=lambda p: -p.actions),
        events=[e for _, e in events][:500],
        totals={k: round(v, 2) for k, v in totals.items()},
    )
