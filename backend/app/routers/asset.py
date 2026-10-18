from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.asset import AssetStatus, DepreciationRun, FixedAsset
from app.models.ledger import Account, JournalEntry, JournalLine
from app.models.user import User, UserRole
from app.schemas.asset import DepreciationRunCreate, DepreciationRunOut, FixedAssetCreate, FixedAssetOut

router = APIRouter(prefix="/schools/{school_id}/assets", tags=["assets"])

ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)
DEPRECIATION_EXPENSE_CODE = "5200"
ACCUMULATED_DEPRECIATION_CODE = "1590"
ACCOUNTS_PAYABLE_CODE = "2010"


def _asset_out(asset: FixedAsset) -> dict:
    return {
        "id": asset.id,
        "code": asset.code,
        "name": asset.name,
        "account_id": asset.account_id,
        "acquisition_date": asset.acquisition_date,
        "cost": float(asset.cost),
        "residual_value": float(asset.residual_value),
        "useful_life_years": asset.useful_life_years,
        "accumulated_depreciation": float(asset.accumulated_depreciation),
        "net_book_value": float(asset.cost) - float(asset.accumulated_depreciation),
        "status": asset.status,
    }


@router.get(
    "",
    response_model=list[FixedAssetOut],
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def list_assets(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    assets = db.query(FixedAsset).filter_by(school_id=school_id).order_by(FixedAsset.code).all()
    return [_asset_out(a) for a in assets]


@router.post(
    "",
    response_model=FixedAssetOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def create_asset(
    school_id: int, payload: FixedAssetCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    account = db.query(Account).filter_by(school_id=school_id, id=payload.account_id).first()
    if account is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found")
    if payload.residual_value >= payload.cost:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Residual value must be less than cost")

    count = db.query(FixedAsset).filter_by(school_id=school_id).count()
    asset = FixedAsset(school_id=school_id, code=f"AST-{count + 1:04d}", **payload.model_dump())
    db.add(asset)
    db.flush()

    ap_account = db.query(Account).filter_by(school_id=school_id, code=ACCOUNTS_PAYABLE_CODE).first()
    entry = JournalEntry(
        school_id=school_id,
        entry_date=payload.acquisition_date,
        reference=asset.code,
        memo=f"Asset capitalised: {asset.name}",
        source="assets",
        posted_by=current_user.id,
    )
    db.add(entry)
    db.flush()
    db.add(JournalLine(entry_id=entry.id, account_id=account.id, debit=payload.cost, credit=0))
    db.add(JournalLine(entry_id=entry.id, account_id=ap_account.id, debit=0, credit=payload.cost))

    db.commit()
    db.refresh(asset)
    return _asset_out(asset)


@router.post(
    "/{asset_id}/dispose",
    response_model=FixedAssetOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def dispose_asset(school_id: int, asset_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    asset = db.query(FixedAsset).filter_by(school_id=school_id, id=asset_id).first()
    if asset is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asset not found")
    if asset.status != AssetStatus.ACTIVE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only an active asset can be disposed")
    asset.status = AssetStatus.DISPOSED
    db.commit()
    db.refresh(asset)
    return _asset_out(asset)


@router.get(
    "/depreciation-runs",
    response_model=list[DepreciationRunOut],
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def list_depreciation_runs(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return db.query(DepreciationRun).filter_by(school_id=school_id).order_by(DepreciationRun.period.desc()).all()


@router.post(
    "/depreciation-runs",
    response_model=DepreciationRunOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def run_depreciation(
    school_id: int, payload: DepreciationRunCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    if db.query(DepreciationRun).filter_by(school_id=school_id, period=payload.period).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Depreciation has already run for {payload.period}")

    assets = (
        db.query(FixedAsset)
        .filter(FixedAsset.school_id == school_id, FixedAsset.status == AssetStatus.ACTIVE)
        .all()
    )

    total = 0.0
    charged_assets = []
    for asset in assets:
        depreciable = float(asset.cost) - float(asset.residual_value)
        monthly = depreciable / (asset.useful_life_years * 12)
        remaining = depreciable - float(asset.accumulated_depreciation)
        amount = min(monthly, remaining)
        if amount <= 0:
            continue
        total += amount
        charged_assets.append((asset, amount))

    if total <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No depreciation due — all assets are either fully depreciated or there are none")

    expense_account = db.query(Account).filter_by(school_id=school_id, code=DEPRECIATION_EXPENSE_CODE).first()
    accum_account = db.query(Account).filter_by(school_id=school_id, code=ACCUMULATED_DEPRECIATION_CODE).first()

    entry = JournalEntry(
        school_id=school_id,
        entry_date=date.today(),
        reference=f"DEP-{payload.period}",
        memo=f"Depreciation for {payload.period}",
        source="assets",
        posted_by=current_user.id,
    )
    db.add(entry)
    db.flush()
    db.add(JournalLine(entry_id=entry.id, account_id=expense_account.id, debit=round(total, 2), credit=0))
    db.add(JournalLine(entry_id=entry.id, account_id=accum_account.id, debit=0, credit=round(total, 2)))

    for asset, amount in charged_assets:
        asset.accumulated_depreciation = float(asset.accumulated_depreciation) + amount

    run = DepreciationRun(school_id=school_id, period=payload.period, total_amount=round(total, 2), created_by=current_user.id, journal_entry_id=entry.id)
    db.add(run)
    db.commit()
    db.refresh(run)
    return run
