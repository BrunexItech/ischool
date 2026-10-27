from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.supplier import Supplier
from app.models.user import User, UserRole
from app.schemas.supplier import SupplierCreate, SupplierOut, SupplierUpdate

router = APIRouter(prefix="/schools/{school_id}/suppliers", tags=["suppliers"])

ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.PROCUREMENT_OFFICER)


@router.get(
    "",
    response_model=list[SupplierOut],
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def list_suppliers(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return db.query(Supplier).filter_by(school_id=school_id).order_by(Supplier.name).all()


@router.post(
    "",
    response_model=SupplierOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def create_supplier(
    school_id: int, payload: SupplierCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    if db.query(Supplier).filter_by(school_id=school_id, kra_pin=payload.kra_pin).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A supplier with this PIN is already registered")
    supplier = Supplier(school_id=school_id, **payload.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.patch(
    "/{supplier_id}",
    response_model=SupplierOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def update_supplier(
    school_id: int,
    supplier_id: int,
    payload: SupplierUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    supplier = db.query(Supplier).filter_by(school_id=school_id, id=supplier_id).first()
    if supplier is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Supplier not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(supplier, field, value)
    db.commit()
    db.refresh(supplier)
    return supplier
