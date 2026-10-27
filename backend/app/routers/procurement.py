from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.ledger import Account, JournalEntry, JournalLine
from app.models.procurement import PurchaseOrder, PurchaseOrderStatus, PurchaseRequisition, RequisitionStatus
from app.models.supplier import Supplier
from app.models.user import User, UserRole
from app.schemas.procurement import PurchaseOrderCreate, PurchaseOrderOut, RequisitionCreate, RequisitionOut

router = APIRouter(prefix="/schools/{school_id}", tags=["procurement"])

# Raising and following up orders is the procurement officer's work; the bursar
# and accountant can see them. Approving stays with the head (ADMIN_ROLES).
STAFF_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.STAFF, UserRole.PROCUREMENT_OFFICER, UserRole.BURSAR, UserRole.ACCOUNTANT)
ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL)
# Turning an approved request into an order, and booking the delivery in, is the procurement officer's job.
ORDER_ROLES = ADMIN_ROLES + (UserRole.PROCUREMENT_OFFICER,)

ACCOUNTS_PAYABLE_CODE = "2010"


def _requisition_or_404(db: Session, school_id: int, requisition_id: int) -> PurchaseRequisition:
    r = db.query(PurchaseRequisition).filter_by(school_id=school_id, id=requisition_id).first()
    if r is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Requisition not found")
    return r


# --- Requisitions ---


@router.get(
    "/requisitions",
    response_model=list[RequisitionOut],
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("erp_finance"))],
)
def list_requisitions(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return db.query(PurchaseRequisition).filter_by(school_id=school_id).order_by(PurchaseRequisition.created_at.desc()).all()


@router.post(
    "/requisitions",
    response_model=RequisitionOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("erp_finance"))],
)
def create_requisition(
    school_id: int, payload: RequisitionCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    account = db.query(Account).filter_by(school_id=school_id, id=payload.account_id).first()
    if account is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Budget line (account) not found")

    count = db.query(PurchaseRequisition).filter_by(school_id=school_id).count()
    requisition = PurchaseRequisition(
        school_id=school_id,
        reference=f"REQ-{count + 1:05d}",
        requested_by=current_user.id,
        total=payload.quantity * payload.unit_cost,
        **payload.model_dump(),
    )
    db.add(requisition)
    db.commit()
    db.refresh(requisition)
    return requisition


@router.post(
    "/requisitions/{requisition_id}/approve",
    response_model=RequisitionOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def approve_requisition(
    school_id: int, requisition_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    requisition = _requisition_or_404(db, school_id, requisition_id)
    if requisition.status != RequisitionStatus.SUBMITTED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only a submitted requisition can be approved")
    requisition.status = RequisitionStatus.APPROVED
    requisition.approved_by = current_user.id
    db.commit()
    db.refresh(requisition)
    return requisition


@router.post(
    "/requisitions/{requisition_id}/decline",
    response_model=RequisitionOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("erp_finance"))],
)
def decline_requisition(
    school_id: int, requisition_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    requisition = _requisition_or_404(db, school_id, requisition_id)
    if requisition.status != RequisitionStatus.SUBMITTED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only a submitted requisition can be declined")
    requisition.status = RequisitionStatus.DECLINED
    requisition.approved_by = current_user.id
    db.commit()
    db.refresh(requisition)
    return requisition


# --- Purchase orders (LPOs) ---


@router.get(
    "/purchase-orders",
    response_model=list[PurchaseOrderOut],
    dependencies=[Depends(require_roles(*STAFF_ROLES)), Depends(require_feature("erp_finance"))],
)
def list_purchase_orders(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return db.query(PurchaseOrder).filter_by(school_id=school_id).order_by(PurchaseOrder.created_at.desc()).all()


@router.post(
    "/purchase-orders",
    response_model=PurchaseOrderOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*ORDER_ROLES)), Depends(require_feature("erp_finance"))],
)
def issue_purchase_order(
    school_id: int, payload: PurchaseOrderCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    requisition = _requisition_or_404(db, school_id, payload.requisition_id)
    if requisition.status != RequisitionStatus.APPROVED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only an approved requisition can be issued an LPO")
    if requisition.purchase_order is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This requisition already has a purchase order")

    supplier = db.query(Supplier).filter_by(school_id=school_id, id=payload.supplier_id, is_active=True).first()
    if supplier is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Active supplier not found")

    count = db.query(PurchaseOrder).filter_by(school_id=school_id).count()
    po = PurchaseOrder(
        school_id=school_id,
        requisition_id=requisition.id,
        supplier_id=supplier.id,
        reference=f"LPO-{count + 1:05d}",
        delivery_date=payload.delivery_date,
        total=requisition.total,
        created_by=current_user.id,
    )
    db.add(po)
    db.commit()
    db.refresh(po)
    return po


@router.post(
    "/purchase-orders/{po_id}/receive",
    response_model=PurchaseOrderOut,
    dependencies=[Depends(require_roles(*ORDER_ROLES)), Depends(require_feature("erp_finance"))],
)
def receive_purchase_order(
    school_id: int, po_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(db, current_user, school_id)
    po = db.query(PurchaseOrder).filter_by(school_id=school_id, id=po_id).first()
    if po is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase order not found")
    if po.status != PurchaseOrderStatus.ISSUED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only an issued purchase order can be received")

    ap_account = db.query(Account).filter_by(school_id=school_id, code=ACCOUNTS_PAYABLE_CODE).first()
    entry = JournalEntry(
        school_id=school_id,
        entry_date=po.delivery_date,
        reference=po.reference,
        memo=f"Goods received: {po.reference} from {po.supplier.name}",
        source="procurement",
        posted_by=current_user.id,
    )
    db.add(entry)
    db.flush()
    db.add(JournalLine(entry_id=entry.id, account_id=po.requisition.account_id, debit=po.total, credit=0))
    db.add(JournalLine(entry_id=entry.id, account_id=ap_account.id, debit=0, credit=po.total))

    po.status = PurchaseOrderStatus.RECEIVED
    po.journal_entry_id = entry.id
    db.commit()
    db.refresh(po)
    return po


@router.post(
    "/purchase-orders/{po_id}/cancel",
    response_model=PurchaseOrderOut,
    dependencies=[Depends(require_roles(*ORDER_ROLES)), Depends(require_feature("erp_finance"))],
)
def cancel_purchase_order(school_id: int, po_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    po = db.query(PurchaseOrder).filter_by(school_id=school_id, id=po_id).first()
    if po is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Purchase order not found")
    if po.status != PurchaseOrderStatus.ISSUED:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only an issued purchase order can be cancelled")
    po.status = PurchaseOrderStatus.CANCELLED
    db.commit()
    db.refresh(po)
    return po
