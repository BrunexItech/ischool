from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.ledger import Account, AccountType, JournalEntry, JournalLine
from app.models.user import User, UserRole
from app.schemas.ledger import (
    AccountOut,
    BalanceSheetOut,
    IncomeStatementOut,
    JournalEntryCreate,
    JournalEntryOut,
    TrialBalanceRow,
)

router = APIRouter(prefix="/schools/{school_id}/ledger", tags=["ledger"])

ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SUPERVISOR, UserRole.BURSAR)

DEBIT_NORMAL = {AccountType.ASSET, AccountType.EXPENSE}


def _account_balances(db: Session, school_id: int) -> list[dict]:
    rows = (
        db.query(
            Account.id,
            Account.code,
            Account.name,
            Account.type,
            func.coalesce(func.sum(JournalLine.debit), 0),
            func.coalesce(func.sum(JournalLine.credit), 0),
        )
        .outerjoin(JournalLine, JournalLine.account_id == Account.id)
        .filter(Account.school_id == school_id)
        .group_by(Account.id, Account.code, Account.name, Account.type)
        .order_by(Account.code)
        .all()
    )
    out = []
    for account_id, code, name, type_, debit, credit in rows:
        debit, credit = float(debit), float(credit)
        balance = debit - credit if type_ in DEBIT_NORMAL else credit - debit
        out.append({"id": account_id, "code": code, "name": name, "type": type_, "debit": debit, "credit": credit, "balance": balance})
    return out


@router.get(
    "/accounts",
    response_model=list[AccountOut],
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def list_accounts(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return _account_balances(db, school_id)


@router.get(
    "/entries",
    response_model=list[JournalEntryOut],
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def list_entries(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    entries = db.query(JournalEntry).filter_by(school_id=school_id).order_by(JournalEntry.entry_date.desc(), JournalEntry.id.desc()).all()
    return [_entry_out(e) for e in entries]


def _entry_out(entry: JournalEntry) -> dict:
    return {
        "id": entry.id,
        "entry_date": entry.entry_date,
        "reference": entry.reference,
        "memo": entry.memo,
        "source": entry.source,
        "created_at": entry.created_at,
        "lines": [
            {
                "id": line.id,
                "account_id": line.account_id,
                "account_code": line.account.code,
                "account_name": line.account.name,
                "debit": float(line.debit),
                "credit": float(line.credit),
            }
            for line in entry.lines
        ],
    }


@router.post(
    "/entries",
    response_model=JournalEntryOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def create_entry(
    school_id: int, payload: JournalEntryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)

    account_ids = {line.account_id for line in payload.lines}
    found = db.query(Account.id).filter(Account.school_id == school_id, Account.id.in_(account_ids)).all()
    if len(found) != len(account_ids):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "One or more accounts were not found")

    entry = JournalEntry(
        school_id=school_id,
        entry_date=payload.entry_date,
        reference=payload.reference,
        memo=payload.memo,
        source="manual",
        posted_by=current_user.id,
    )
    db.add(entry)
    db.flush()
    for line in payload.lines:
        db.add(JournalLine(entry_id=entry.id, account_id=line.account_id, debit=line.debit, credit=line.credit))
    db.commit()
    db.refresh(entry)
    return _entry_out(entry)


@router.get(
    "/trial-balance",
    response_model=list[TrialBalanceRow],
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def trial_balance(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return [
        TrialBalanceRow(account_code=a["code"], account_name=a["name"], type=a["type"], debit=a["debit"], credit=a["credit"])
        for a in _account_balances(db, school_id)
    ]


@router.get(
    "/income-statement",
    response_model=IncomeStatementOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def income_statement(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    balances = _account_balances(db, school_id)
    income_lines = [a for a in balances if a["type"] == AccountType.INCOME]
    expense_lines = [a for a in balances if a["type"] == AccountType.EXPENSE]
    income_total = sum(a["balance"] for a in income_lines)
    expense_total = sum(a["balance"] for a in expense_lines)
    return IncomeStatementOut(
        income_total=income_total,
        expense_total=expense_total,
        surplus=income_total - expense_total,
        income_lines=[TrialBalanceRow(account_code=a["code"], account_name=a["name"], type=a["type"], debit=a["debit"], credit=a["credit"]) for a in income_lines],
        expense_lines=[TrialBalanceRow(account_code=a["code"], account_name=a["name"], type=a["type"], debit=a["debit"], credit=a["credit"]) for a in expense_lines],
    )


@router.get(
    "/balance-sheet",
    response_model=BalanceSheetOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def balance_sheet(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    balances = _account_balances(db, school_id)
    asset_lines = [a for a in balances if a["type"] == AccountType.ASSET]
    liability_lines = [a for a in balances if a["type"] == AccountType.LIABILITY]
    equity_lines = [a for a in balances if a["type"] == AccountType.EQUITY]
    income_total = sum(a["balance"] for a in balances if a["type"] == AccountType.INCOME)
    expense_total = sum(a["balance"] for a in balances if a["type"] == AccountType.EXPENSE)
    period_surplus = income_total - expense_total

    return BalanceSheetOut(
        assets_total=sum(a["balance"] for a in asset_lines),
        liabilities_total=sum(a["balance"] for a in liability_lines),
        equity_total=sum(a["balance"] for a in equity_lines) + period_surplus,
        period_surplus=period_surplus,
        asset_lines=[TrialBalanceRow(account_code=a["code"], account_name=a["name"], type=a["type"], debit=a["debit"], credit=a["credit"]) for a in asset_lines],
        liability_lines=[TrialBalanceRow(account_code=a["code"], account_name=a["name"], type=a["type"], debit=a["debit"], credit=a["credit"]) for a in liability_lines],
        equity_lines=[TrialBalanceRow(account_code=a["code"], account_name=a["name"], type=a["type"], debit=a["debit"], credit=a["credit"]) for a in equity_lines],
    )
