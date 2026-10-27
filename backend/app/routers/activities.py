from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.awards import create_award, deny, is_admin, teacher_class_ids
from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.models.academics import SchoolClass, Student
from app.models.activity import Activity, ActivityParticipant
from app.models.award import Award
from app.models.user import User, UserRole
from app.schemas.activity import (
    ActivityAwardsCreate,
    ActivityCreate,
    ActivityDetailOut,
    ActivityOut,
    ParticipantAdd,
    ParticipantOut,
)
from app.schemas.award import AwardOut

router = APIRouter(prefix="/schools/{school_id}/activities", tags=["activities"])

VIEW_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.TEACHER, UserRole.STAFF, UserRole.GROUP_PRINCIPAL, UserRole.SECRETARY)
ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL, UserRole.SECRETARY)


def _get_activity(db: Session, school_id: int, activity_id: int) -> Activity:
    activity = db.query(Activity).filter_by(school_id=school_id, id=activity_id).first()
    if activity is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Activity not found")
    return activity


def _ensure_owner(user: User, activity: Activity) -> None:
    if not is_admin(user) and activity.created_by != user.id:
        deny("Only the person who runs this activity, or the head of institution, can change it")


@router.get(
    "",
    response_model=list[ActivityOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("activities"))],
)
def list_activities(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return db.query(Activity).filter_by(school_id=school_id).order_by(Activity.date.desc()).all()


@router.post(
    "",
    response_model=ActivityOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("activities"))],
)
def create_activity(
    school_id: int, payload: ActivityCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """A whole-school activity is run by leadership or staff; a class activity
    by that class's teacher; an invited-learners activity by anyone."""
    ensure_school_access(db, current_user, school_id)
    admin = is_admin(current_user)
    if payload.scope == "class":
        cls = db.query(SchoolClass).filter_by(school_id=school_id, id=payload.class_id).first() if payload.class_id else None
        if cls is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose the class this activity is for")
        if current_user.role == UserRole.TEACHER and cls.id not in teacher_class_ids(db, school_id, current_user):
            deny("You can only run a class activity for a class you teach")
    elif payload.class_id is not None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only a class activity has a class")
    if payload.scope == "school" and current_user.role == UserRole.TEACHER:
        deny("A whole-school activity is set up by the head of institution or school staff. Use a class or invited-learners activity.")
    activity = Activity(school_id=school_id, created_by=current_user.id, **payload.model_dump())
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


@router.get(
    "/{activity_id}",
    response_model=ActivityDetailOut,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("activities"))],
)
def get_activity(school_id: int, activity_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    activity = _get_activity(db, school_id, activity_id)
    return ActivityDetailOut(
        **ActivityOut.model_validate(activity).model_dump(),
        participants=[ParticipantOut.model_validate(p) for p in activity.participants],
    )


@router.post(
    "/{activity_id}/participants",
    response_model=ParticipantOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("activities"))],
)
def add_participant(
    school_id: int,
    activity_id: int,
    payload: ParticipantAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    activity = _get_activity(db, school_id, activity_id)
    _ensure_owner(current_user, activity)

    student = db.query(Student).filter_by(school_id=school_id, id=payload.student_id).first()
    if student is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That student does not belong to this school")
    if activity.scope == "class" and student.class_id != activity.class_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"This is a {activity.class_name} activity; that learner is in another class")
    if current_user.role == UserRole.TEACHER and student.class_id not in teacher_class_ids(db, school_id, current_user):
        deny("You can only add learners from classes you teach")

    if db.query(ActivityParticipant).filter_by(activity_id=activity_id, student_id=payload.student_id).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This student is already recorded for this activity")

    participant = ActivityParticipant(activity_id=activity_id, student_id=payload.student_id, role=payload.role)
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return participant


@router.delete(
    "/{activity_id}/participants/{student_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("activities"))],
)
def remove_participant(
    school_id: int,
    activity_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    activity = _get_activity(db, school_id, activity_id)
    _ensure_owner(current_user, activity)
    participant = db.query(ActivityParticipant).filter_by(activity_id=activity_id, student_id=student_id).first()
    if participant is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Participant record not found")

    db.delete(participant)
    db.commit()


@router.post(
    "/{activity_id}/awards",
    response_model=list[AwardOut],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("activities")), Depends(require_feature("awards"))],
)
def award_from_results(
    school_id: int,
    activity_id: int,
    payload: ActivityAwardsCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Turns an activity's results into awards in one go — for example
    "1st place, 100m" for learners from several classes. Only learners who
    took part can be awarded, and only by whoever runs the activity."""
    ensure_school_access(db, current_user, school_id)
    activity = _get_activity(db, school_id, activity_id)
    _ensure_owner(current_user, activity)
    if not payload.awards:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Add at least one award")
    participants = {p.student_id: p.student for p in activity.participants}
    created: list[Award] = []
    for item in payload.awards:
        student = participants.get(item.student_id)
        if student is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Awards can only go to learners who took part in this activity")
        if not item.title.strip():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Every award needs a title")
        created.append(
            create_award(
                db,
                school_id=school_id,
                giver=current_user,
                scope="student",
                title=item.title,
                description=item.description,
                category=item.category or activity.category,
                date_awarded=activity.date,
                student=student,
                activity_id=activity.id,
                notify_guardian=payload.notify_guardian,
            )
        )
    db.commit()
    for a in created:
        db.refresh(a)
    return created


@router.delete(
    "/{activity_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("activities"))],
)
def delete_activity(school_id: int, activity_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    activity = _get_activity(db, school_id, activity_id)
    _ensure_owner(current_user, activity)
    db.delete(activity)
    db.commit()
