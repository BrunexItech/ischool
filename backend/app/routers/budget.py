from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.budget import Budget
from app.models.ledger import Account, AccountType, JournalEntry, JournalLine
from app.models.procurement import PurchaseOrder, PurchaseOrderStatus, PurchaseRequisition, RequisitionStatus
from app.models.user import User, UserRole
from app.schemas.budget import BudgetLineOut, BudgetSet

router = APIRouter(prefix="/schools/{school_id}/budgets", tags=["budgets"])

ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SUPERVISOR)


def _actual(db: Session, school_id: int, account_id: int, year: int) -> float:
    row = (
        db.query(func.coalesce(func.sum(JournalLine.debit), 0), func.coalesce(func.sum(JournalLine.credit), 0))
        .join(JournalEntry, JournalEntry.id == JournalLine.entry_id)
        .filter(
            JournalEntry.school_id == school_id,
            JournalLine.account_id == account_id,
            JournalEntry.entry_date >= date(year, 1, 1),
            JournalEntry.entry_date <= date(year, 12, 31),
        )
        .first()
    )
    debit, credit = float(row[0]), float(row[1])
    return debit - credit


def _committed(db: Session, school_id: int, account_id: int) -> float:
    req_total = (
        db.query(func.coalesce(func.sum(PurchaseRequisition.total), 0))
        .outerjoin(PurchaseOrder, PurchaseOrder.requisition_id == PurchaseRequisition.id)
        .filter(
            PurchaseRequisition.school_id == school_id,
            PurchaseRequisition.account_id == account_id,
            PurchaseRequisition.status == RequisitionStatus.APPROVED,
            PurchaseOrder.id.is_(None),
        )
        .scalar()
    )
    po_total = (
        db.query(func.coalesce(func.sum(PurchaseOrder.total), 0))
        .join(PurchaseRequisition, PurchaseRequisition.id == PurchaseOrder.requisition_id)
        .filter(
            PurchaseOrder.school_id == school_id,
            PurchaseRequisition.account_id == account_id,
            PurchaseOrder.status == PurchaseOrderStatus.ISSUED,
        )
        .scalar()
    )
    return float(req_total) + float(po_total)


@router.get(
    "",
    response_model=list[BudgetLineOut],
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def list_budgets(school_id: int, year: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    accounts = db.query(Account).filter_by(school_id=school_id, type=AccountType.EXPENSE).order_by(Account.code).all()
    budgets = {b.account_id: b for b in db.query(Budget).filter_by(school_id=school_id, year=year).all()}

    rows = []
    for account in accounts:
        budget_amount = float(budgets[account.id].amount) if account.id in budgets else 0.0
        actual = _actual(db, school_id, account.id, year)
        committed = _committed(db, school_id, account.id)
        rows.append(
            BudgetLineOut(
                account_id=account.id,
                account_code=account.code,
                account_name=account.name,
                year=year,
                budget=budget_amount,
                actual=actual,
                committed=committed,
                available=budget_amount - actual - committed,
            )
        )
    return rows


@router.put(
    "",
    response_model=BudgetLineOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def set_budget(school_id: int, payload: BudgetSet, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    account = db.query(Account).filter_by(school_id=school_id, id=payload.account_id).first()
    if account is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")

    existing = db.query(Budget).filter_by(school_id=school_id, account_id=payload.account_id, year=payload.year).first()
    if existing:
        existing.amount = payload.amount
    else:
        existing = Budget(school_id=school_id, account_id=payload.account_id, year=payload.year, amount=payload.amount)
        db.add(existing)
    db.commit()

    actual = _actual(db, school_id, account.id, payload.year)
    committed = _committed(db, school_id, account.id)
    return BudgetLineOut(
        account_id=account.id,
        account_code=account.code,
        account_name=account.name,
        year=payload.year,
        budget=payload.amount,
        actual=actual,
        committed=committed,
        available=payload.amount - actual - committed,
    )
