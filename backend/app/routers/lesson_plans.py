from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.core.teaching import ensure_can_grade
from app.models.lesson_plan import LessonPlan, LessonPlanEntry
from app.models.user import User, UserRole
from app.schemas.lesson_plan import (
    LessonPlanCreate,
    LessonPlanDetailOut,
    LessonPlanEntryCreate,
    LessonPlanEntryOut,
    LessonPlanEntryUpdate,
    LessonPlanOut,
)

router = APIRouter(prefix="/schools/{school_id}/lesson-plans", tags=["lesson-plans"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.TEACHER, UserRole.STAFF)
ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN)


def _get_plan(db: Session, school_id: int, plan_id: int) -> LessonPlan:
    plan = db.query(LessonPlan).filter_by(school_id=school_id, id=plan_id).first()
    if plan is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lesson plan not found")
    return plan


@router.get(
    "",
    response_model=list[LessonPlanOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("lesson_plans"))],
)
def list_lesson_plans(
    school_id: int,
    class_id: int | None = None,
    subject_id: int | None = None,
    term: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)
    query = db.query(LessonPlan).filter_by(school_id=school_id)
    if class_id is not None:
        query = query.filter_by(class_id=class_id)
    if subject_id is not None:
        query = query.filter_by(subject_id=subject_id)
    if term is not None:
        query = query.filter_by(term=term)
    return query.order_by(LessonPlan.updated_at.desc()).all()


@router.post(
    "",
    response_model=LessonPlanDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("lesson_plans"))],
)
def create_lesson_plan(
    school_id: int, payload: LessonPlanCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(current_user, school_id)
    ensure_can_grade(db, current_user, payload.class_id, payload.subject_id)

    if db.query(LessonPlan).filter_by(school_id=school_id, class_id=payload.class_id, subject_id=payload.subject_id, term=payload.term).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A lesson plan already exists for this class, subject, and term")

    plan = LessonPlan(school_id=school_id, created_by=current_user.id, **payload.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.get(
    "/{plan_id}",
    response_model=LessonPlanDetailOut,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("lesson_plans"))],
)
def get_lesson_plan(school_id: int, plan_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(current_user, school_id)
    return _get_plan(db, school_id, plan_id)


@router.delete(
    "/{plan_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*ADMIN_ROLES)), Depends(require_feature("lesson_plans"))],
)
def delete_lesson_plan(school_id: int, plan_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(current_user, school_id)
    plan = _get_plan(db, school_id, plan_id)
    db.delete(plan)
    db.commit()


@router.post(
    "/{plan_id}/entries",
    response_model=LessonPlanEntryOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("lesson_plans"))],
)
def add_entry(
    school_id: int,
    plan_id: int,
    payload: LessonPlanEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Adds one entry — the "fill it in as the term goes" path."""
    ensure_school_access(current_user, school_id)
    plan = _get_plan(db, school_id, plan_id)
    ensure_can_grade(db, current_user, plan.class_id, plan.subject_id)

    entry = LessonPlanEntry(lesson_plan_id=plan.id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.put(
    "/{plan_id}/entries",
    response_model=LessonPlanDetailOut,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("lesson_plans"))],
)
def replace_entries(
    school_id: int,
    plan_id: int,
    payload: list[LessonPlanEntryCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Replaces the whole set of entries in one call — the "set the entire
    term's plan right now" path, as opposed to adding entries one at a
    time. Either path works on the same plan; nothing forces one over
    the other."""
    ensure_school_access(current_user, school_id)
    plan = _get_plan(db, school_id, plan_id)
    ensure_can_grade(db, current_user, plan.class_id, plan.subject_id)

    db.query(LessonPlanEntry).filter_by(lesson_plan_id=plan.id).delete()
    for entry_payload in payload:
        db.add(LessonPlanEntry(lesson_plan_id=plan.id, **entry_payload.model_dump()))

    db.commit()
    db.refresh(plan)
    return plan


@router.patch(
    "/{plan_id}/entries/{entry_id}",
    response_model=LessonPlanEntryOut,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("lesson_plans"))],
)
def update_entry(
    school_id: int,
    plan_id: int,
    entry_id: int,
    payload: LessonPlanEntryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(current_user, school_id)
    plan = _get_plan(db, school_id, plan_id)
    ensure_can_grade(db, current_user, plan.class_id, plan.subject_id)

    entry = db.query(LessonPlanEntry).filter_by(id=entry_id, lesson_plan_id=plan.id).first()
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)

    db.commit()
    db.refresh(entry)
    return entry


@router.delete(
    "/{plan_id}/entries/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("lesson_plans"))],
)
def delete_entry(
    school_id: int, plan_id: int, entry_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    ensure_school_access(current_user, school_id)
    plan = _get_plan(db, school_id, plan_id)
    ensure_can_grade(db, current_user, plan.class_id, plan.subject_id)

    entry = db.query(LessonPlanEntry).filter_by(id=entry_id, lesson_plan_id=plan.id).first()
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Entry not found")

    db.delete(entry)
    db.commit()
