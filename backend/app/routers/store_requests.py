"""Teachers and departments ask the store for items; the store keeper fills the
request or declines it. Stocktakes correct the book figure to what is counted,
with a reason, so every difference is explained."""

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.core.notify import notify
from app.models.ledger import Account, JournalEntry, JournalLine
from app.models.store import StockItem, StockMovement, StockMovementType, StoreRequest, StoreRequestLine
from app.models.user import User, UserRole
from app.routers.store import INVENTORY_CODE, KEEPER_ROLES, STAFF_ROLES, VIEW_ROLES, issue_item
from app.schemas.store import StockCount, StockMovementOut, StoreDecline, StoreIssueRequest, StoreRequestCreate, StoreRequestLineOut, StoreRequestOut

router = APIRouter(prefix="/schools/{school_id}/stores", tags=["stores"], dependencies=[Depends(require_feature("erp_finance"))])

# Anyone employed at the school can ask the store for something they need.
REQUEST_ROLES = STAFF_ROLES + (UserRole.TEACHER, UserRole.SECURITY, UserRole.BOARDING_STAFF, UserRole.TRANSPORT_STAFF, UserRole.SECRETARY, UserRole.LIBRARIAN, UserRole.BURSAR, UserRole.ACCOUNTANT, UserRole.PROCUREMENT_OFFICER)
SEE_ALL = STAFF_ROLES + (UserRole.BURSAR, UserRole.ACCOUNTANT, UserRole.PROCUREMENT_OFFICER)


def _out(r: StoreRequest, db: Session) -> StoreRequestOut:
    decider = db.get(User, r.decided_by) if r.decided_by else None
    return StoreRequestOut(
        id=r.id,
        reference=r.reference,
        department=r.department,
        note=r.note,
        status=r.status,
        requested_by_name=r.requester.full_name if r.requester else None,
        requested_at=r.requested_at,
        decided_by_name=decider.full_name if decider else None,
        decided_at=r.decided_at,
        decision_note=r.decision_note,
        lines=[
            StoreRequestLineOut(id=l.id, item_id=l.item_id, item_name=l.item.name, unit=l.item.unit, in_stock=l.item.quantity, quantity_requested=l.quantity_requested, quantity_issued=l.quantity_issued)
            for l in r.lines
        ],
    )


def _get(db: Session, school_id: int, request_id: int) -> StoreRequest:
    r = db.query(StoreRequest).filter_by(school_id=school_id, id=request_id).first()
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Request not found")
    return r


@router.get("/requests", response_model=list[StoreRequestOut], dependencies=[Depends(require_roles(*REQUEST_ROLES))])
def list_requests(school_id: int, state: str | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """The store sees every request; everyone else sees their own."""
    ensure_school_access(db, current_user, school_id)
    q = db.query(StoreRequest).filter_by(school_id=school_id)
    if current_user.role not in SEE_ALL:
        q = q.filter_by(requested_by=current_user.id)
    if state:
        q = q.filter_by(status=state)
    return [_out(r, db) for r in q.order_by(StoreRequest.requested_at.desc()).limit(200)]


@router.post("/requests", response_model=StoreRequestOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles(*REQUEST_ROLES))])
def create_request(school_id: int, payload: StoreRequestCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    seen: set[int] = set()
    req = StoreRequest(school_id=school_id, reference="TMP", department=payload.department.strip(), note=payload.note, requested_by=current_user.id)
    for line in payload.lines:
        if line.item_id in seen:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Each item can only be listed once")
        seen.add(line.item_id)
        if not db.query(StockItem.id).filter_by(school_id=school_id, id=line.item_id).first():
            raise HTTPException(status.HTTP_404_NOT_FOUND, "One of the items is not in the store")
        req.lines.append(StoreRequestLine(item_id=line.item_id, quantity_requested=line.quantity))
    db.add(req)
    db.flush()
    req.reference = f"REQ-{req.id:05d}"
    for keeper in db.query(User).filter(User.school_id == school_id, User.role == UserRole.STORE_KEEPER, User.is_active.is_(True)):
        notify(db, school_id=school_id, user_id=keeper.id, title="New store request", body=f"{current_user.full_name} ({req.department}) asked for {len(req.lines)} item{'s' if len(req.lines) != 1 else ''}.", link="/dashboard/stores")
    db.commit()
    db.refresh(req)
    return _out(req, db)


@router.post("/requests/{request_id}/issue", response_model=StoreRequestOut, dependencies=[Depends(require_roles(*KEEPER_ROLES))])
def fill_request(school_id: int, request_id: int, payload: StoreIssueRequest | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Issue the items. Anything the store cannot cover in full is refused
    with the amount in stock, so the keeper can lower that line and try again."""
    ensure_school_access(db, current_user, school_id)
    req = _get(db, school_id, request_id)
    if req.status != "requested":
        raise HTTPException(status.HTTP_409_CONFLICT, f"This request has already been {req.status}")
    wanted = (payload.quantities if payload else {}) or {}
    issued_any = False
    for line in req.lines:
        qty = wanted.get(line.id, line.quantity_requested)
        if qty < 0 or qty > line.quantity_requested:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"{line.item.name}: issue between 0 and {line.quantity_requested}")
        if qty == 0:
            continue
        issue_item(db, school_id, line.item, qty, req.department, f"{req.reference}" + (f": {payload.note}" if payload and payload.note else ""), current_user)
        line.quantity_issued = qty
        issued_any = True
    if not issued_any:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Nothing to issue. Decline the request instead.")
    req.status, req.decided_by, req.decided_at = "issued", current_user.id, datetime.now(timezone.utc)
    if req.requested_by:
        short = [l for l in req.lines if l.quantity_issued < l.quantity_requested]
        notify(db, school_id=school_id, user_id=req.requested_by, title=f"Store request {req.reference} issued", body="Collect your items from the store." + (f" Short: {', '.join(l.item.name for l in short)}." if short else ""), link="/dashboard/stores")
    db.commit()
    db.refresh(req)
    return _out(req, db)


@router.post("/requests/{request_id}/decline", response_model=StoreRequestOut, dependencies=[Depends(require_roles(*KEEPER_ROLES))])
def decline_request(school_id: int, request_id: int, payload: StoreDecline, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    req = _get(db, school_id, request_id)
    if req.status != "requested":
        raise HTTPException(status.HTTP_409_CONFLICT, f"This request has already been {req.status}")
    req.status, req.decided_by, req.decided_at, req.decision_note = "declined", current_user.id, datetime.now(timezone.utc), payload.note
    if req.requested_by:
        notify(db, school_id=school_id, user_id=req.requested_by, title=f"Store request {req.reference} declined", body=payload.note, link="/dashboard/stores")
    db.commit()
    db.refresh(req)
    return _out(req, db)


@router.post("/counts", response_model=StockMovementOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles(*KEEPER_ROLES))])
def record_count(school_id: int, payload: StockCount, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Correct an item to the quantity actually counted. The difference is
    written off to, or brought back from, the item's expense account, and the
    reason is kept with the movement."""
    ensure_school_access(db, current_user, school_id)
    item = db.query(StockItem).filter_by(school_id=school_id, id=payload.item_id).first()
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stock item not found")
    diff = payload.counted_quantity - item.quantity
    if diff == 0:
        raise HTTPException(status.HTTP_409_CONFLICT, "The count matches the book figure. Nothing to correct.")
    inventory = db.query(Account).filter_by(school_id=school_id, code=INVENTORY_CODE).first()
    value = abs(diff) * float(item.unit_cost)
    entry = JournalEntry(school_id=school_id, entry_date=date.today(), reference=f"CNT-{item.code}", memo=f"Stocktake: {item.name} counted {payload.counted_quantity}, book {item.quantity}. {payload.reason}", source="stores", posted_by=current_user.id)
    db.add(entry)
    db.flush()
    if diff < 0:   # shortage: expense it
        db.add(JournalLine(entry_id=entry.id, account_id=item.account_id, debit=value, credit=0))
        db.add(JournalLine(entry_id=entry.id, account_id=inventory.id, debit=0, credit=value))
    else:          # surplus: bring it back
        db.add(JournalLine(entry_id=entry.id, account_id=inventory.id, debit=value, credit=0))
        db.add(JournalLine(entry_id=entry.id, account_id=item.account_id, debit=0, credit=value))
    note = f"Counted {payload.counted_quantity}, book {item.quantity} ({'+' if diff > 0 else ''}{diff}): {payload.reason}"
    item.quantity = payload.counted_quantity
    movement = StockMovement(school_id=school_id, item_id=item.id, type=StockMovementType.ADJUSTMENT, quantity=abs(diff), note=note[:255], recorded_by=current_user.id, journal_entry_id=entry.id)
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement
