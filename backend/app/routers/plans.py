from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.plan import Plan
from app.models.user import UserRole
from app.schemas.plan import PlanCreate, PlanOut, PlanUpdate

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("", response_model=list[PlanOut], dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))])
def list_plans(db: Session = Depends(get_db)):
    return db.query(Plan).all()


@router.post("", response_model=PlanOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))])
def create_plan(payload: PlanCreate, db: Session = Depends(get_db)):
    plan = Plan(**payload.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.patch("/{plan_id}", response_model=PlanOut, dependencies=[Depends(require_roles(UserRole.SUPER_ADMIN))])
def update_plan(plan_id: int, payload: PlanUpdate, db: Session = Depends(get_db)):
    plan = db.get(Plan, plan_id)
    if plan is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Plan not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(plan, field, value)

    db.commit()
    db.refresh(plan)
    return plan
