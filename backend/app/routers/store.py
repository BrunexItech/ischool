from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.ledger import Account, JournalEntry, JournalLine
from app.models.store import StockItem, StockMovement, StockMovementType
from app.models.user import User, UserRole
from app.schemas.store import StockIssueCreate, StockItemCreate, StockItemOut, StockMovementOut, StockReceiptCreate

router = APIRouter(prefix="/schools/{school_id}/stores", tags=["stores"])

KEEPER_ROLES = (UserRole.SUPER_ADMIN, UserRole.STORE_KEEPER, UserRole.STAFF)
# The head can see and, when needed, record stock movements too.
STAFF_ROLES = KEEPER_ROLES + (UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL)
VIEW_ROLES = STAFF_ROLES + (UserRole.PROCUREMENT_OFFICER, UserRole.BURSAR, UserRole.ACCOUNTANT)
INVENTORY_CODE = "1200"
ACCOUNTS_PAYABLE_CODE = "2010"


def _item_or_404(db: Session, school_id: int, item_id: int) -> StockItem:
    item = db.query(StockItem).filter_by(school_id=school_id, id=item_id).first()
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Stock item not found")
    return item


@router.get(
    "/items",
    response_model=list[StockItemOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("erp_finance"))],
)
def list_items(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return db.query(StockItem).filter_by(school_id=school_id).order_by(StockItem.code).all()


@router.post(
    "/items",
    response_model=StockItemOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("erp_finance"))],
)
def create_item(
    school_id: int, payload: StockItemCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    if db.query(StockItem).filter_by(school_id=school_id).filter(StockItem.name.ilike(payload.name)).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This item already exists")
    account = db.query(Account).filter_by(school_id=school_id, id=payload.account_id).first()
    if account is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")

    prefix = "".join(w[0] for w in payload.category.split()[:2]).upper() or "IT"
    count = db.query(StockItem).filter_by(school_id=school_id).filter(StockItem.code.like(f"{prefix}-%")).count()
    code = f"{prefix}-{count + 1:03d}"

    item = StockItem(school_id=school_id, code=code, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get(
    "/movements",
    response_model=list[StockMovementOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("erp_finance"))],
)
def list_movements(school_id: int, item_id: int | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    query = db.query(StockMovement).filter_by(school_id=school_id)
    if item_id is not None:
        query = query.filter_by(item_id=item_id)
    return query.order_by(StockMovement.created_at.desc()).all()


@router.post(
    "/receipts",
    response_model=StockMovementOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("erp_finance"))],
)
def receive_stock(
    school_id: int, payload: StockReceiptCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    item = _item_or_404(db, school_id, payload.item_id)
    unit_cost = payload.unit_cost or item.unit_cost
    total = unit_cost * payload.quantity

    inventory_account = db.query(Account).filter_by(school_id=school_id, code=INVENTORY_CODE).first()
    ap_account = db.query(Account).filter_by(school_id=school_id, code=ACCOUNTS_PAYABLE_CODE).first()
    entry = JournalEntry(
        school_id=school_id,
        entry_date=date.today(),
        reference=f"GRN-{item.code}",
        memo=f"Stock received: {payload.quantity} {item.unit} of {item.name}",
        source="stores",
        posted_by=current_user.id,
    )
    db.add(entry)
    db.flush()
    db.add(JournalLine(entry_id=entry.id, account_id=inventory_account.id, debit=total, credit=0))
    db.add(JournalLine(entry_id=entry.id, account_id=ap_account.id, debit=0, credit=total))

    item.quantity += payload.quantity
    if payload.unit_cost:
        item.unit_cost = payload.unit_cost

    movement = StockMovement(
        school_id=school_id,
        item_id=item.id,
        type=StockMovementType.RECEIPT,
        quantity=payload.quantity,
        note=payload.note,
        recorded_by=current_user.id,
        journal_entry_id=entry.id,
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement


def issue_item(db: Session, school_id: int, item: StockItem, quantity: int, department: str, note: str | None, user: User) -> StockMovement:
    """Move stock out of the store and book the cost to the item's expense
    account. Shared by direct issues and by filling a request. The caller commits."""
    if item.quantity < quantity:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Only {item.quantity} {item.unit} of {item.name} in stock")
    total = item.unit_cost * quantity
    inventory_account = db.query(Account).filter_by(school_id=school_id, code=INVENTORY_CODE).first()
    entry = JournalEntry(
        school_id=school_id,
        entry_date=date.today(),
        reference=f"ISS-{item.code}",
        memo=f"Stock issued: {quantity} {item.unit} of {item.name} to {department}",
        source="stores",
        posted_by=user.id,
    )
    db.add(entry)
    db.flush()
    db.add(JournalLine(entry_id=entry.id, account_id=item.account_id, debit=total, credit=0))
    db.add(JournalLine(entry_id=entry.id, account_id=inventory_account.id, debit=0, credit=total))
    item.quantity -= quantity
    movement = StockMovement(school_id=school_id, item_id=item.id, type=StockMovementType.ISSUE, quantity=quantity, department=department, note=note, recorded_by=user.id, journal_entry_id=entry.id)
    db.add(movement)
    return movement


@router.post(
    "/issues",
    response_model=StockMovementOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("erp_finance"))],
)
def issue_stock(
    school_id: int, payload: StockIssueCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    item = _item_or_404(db, school_id, payload.item_id)
    movement = issue_item(db, school_id, item, payload.quantity, payload.department, payload.note, current_user)
    db.commit()
    db.refresh(movement)
    return movement
