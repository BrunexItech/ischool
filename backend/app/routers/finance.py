from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.expense import Expense
from app.models.fees import FeePayment
from app.models.user import User, UserRole
from app.schemas.finance import CategoryTotal, ExpenseCreate, ExpenseOut, FinanceSummaryOut, MonthlyTotal

router = APIRouter(prefix="/schools/{school_id}/finance", tags=["finance"])

ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)


@router.get(
    "/expenses",
    response_model=list[ExpenseOut],
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("finance"))],
)
def list_expenses(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(current_user, school_id)
    return db.query(Expense).filter_by(school_id=school_id).order_by(Expense.date.desc()).all()


@router.post(
    "/expenses",
    response_model=ExpenseOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("finance"))],
)
def create_expense(
    school_id: int, payload: ExpenseCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(current_user, school_id)
    expense = Expense(school_id=school_id, recorded_by=current_user.id, **payload.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.delete(
    "/expenses/{expense_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("finance"))],
)
def delete_expense(school_id: int, expense_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(current_user, school_id)
    expense = db.query(Expense).filter_by(school_id=school_id, id=expense_id).first()
    if expense is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Expense not found")

    db.delete(expense)
    db.commit()


@router.get(
    "/summary",
    response_model=FinanceSummaryOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("finance"))],
)
def get_finance_summary(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(current_user, school_id)

    total_income = db.query(func.coalesce(func.sum(FeePayment.amount), 0)).filter_by(school_id=school_id).scalar()
    total_expenses = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter_by(school_id=school_id).scalar()

    category_rows = (
        db.query(Expense.category, func.sum(Expense.amount))
        .filter_by(school_id=school_id)
        .group_by(Expense.category)
        .all()
    )
    expenses_by_category = [CategoryTotal(category=cat, total=float(total)) for cat, total in category_rows]

    income_rows = (
        db.query(func.to_char(FeePayment.paid_at, "YYYY-MM"), func.sum(FeePayment.amount))
        .filter_by(school_id=school_id)
        .group_by(func.to_char(FeePayment.paid_at, "YYYY-MM"))
        .all()
    )
    income_by_month = {month: float(total) for month, total in income_rows}

    expense_rows = (
        db.query(func.to_char(Expense.date, "YYYY-MM"), func.sum(Expense.amount))
        .filter_by(school_id=school_id)
        .group_by(func.to_char(Expense.date, "YYYY-MM"))
        .all()
    )
    expense_by_month = {month: float(total) for month, total in expense_rows}

    all_months = sorted(set(income_by_month) | set(expense_by_month))
    monthly = [
        MonthlyTotal(month=m, income=income_by_month.get(m, 0.0), expenses=expense_by_month.get(m, 0.0)) for m in all_months
    ]

    return FinanceSummaryOut(
        total_income=float(total_income),
        total_expenses=float(total_expenses),
        net=float(total_income) - float(total_expenses),
        expenses_by_category=expenses_by_category,
        monthly=monthly,
    )
