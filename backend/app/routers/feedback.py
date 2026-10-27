from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_roles
from app.core.notify import notify
from app.models.feedback import LeadershipFeedback
from app.models.user import User, UserRole
from app.schemas.feedback import FeedbackCreate, FeedbackOut, FeedbackReply

router = APIRouter(prefix="/schools/{school_id}/feedback", tags=["feedback"])

LEADERSHIP = (UserRole.SUPER_ADMIN, UserRole.HEAD_OF_INSTITUTION, UserRole.GROUP_PRINCIPAL)


def _out(f: LeadershipFeedback) -> FeedbackOut:
    return FeedbackOut(
        id=f.id,
        recipient_user_id=f.recipient_user_id,
        recipient_name=f.recipient.full_name,
        author_name=f.author.full_name if f.author else None,
        topic=f.topic,
        link=f.link,
        message=f.message,
        status=f.status,
        reply=f.reply,
        acknowledged_at=f.acknowledged_at,
        created_at=f.created_at,
    )


@router.post("", response_model=FeedbackOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_roles(*LEADERSHIP))])
def send_feedback(school_id: int, payload: FeedbackCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Leadership leaves a note for a teacher about their work. The teacher is
    notified and can acknowledge it."""
    ensure_school_access(db, current_user, school_id)
    message = payload.message.strip()
    if not message:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Write the feedback first")
    teacher = db.query(User).filter_by(school_id=school_id, id=payload.recipient_user_id).first()
    if teacher is None or teacher.role not in (UserRole.TEACHER, UserRole.STAFF):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That teacher was not found")
    row = LeadershipFeedback(
        school_id=school_id,
        recipient_user_id=teacher.id,
        author_user_id=current_user.id,
        topic=payload.topic.strip()[:100] or "Your work",
        link=payload.link,
        message=message,
    )
    db.add(row)
    notify(db, school_id=school_id, user_id=teacher.id, title=f"Feedback from {current_user.full_name}", body=f"{row.topic}: {message[:140]}", link=payload.link or "/dashboard")
    db.commit()
    db.refresh(row)
    return _out(row)


@router.get("", response_model=list[FeedbackOut], dependencies=[Depends(require_roles(*LEADERSHIP, UserRole.TEACHER, UserRole.STAFF))])
def list_feedback(school_id: int, recipient_user_id: int | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Leadership sees what was sent (optionally for one teacher); a teacher sees what was sent to them."""
    ensure_school_access(db, current_user, school_id)
    query = db.query(LeadershipFeedback).filter_by(school_id=school_id)
    if current_user.role in LEADERSHIP:
        if recipient_user_id is not None:
            query = query.filter_by(recipient_user_id=recipient_user_id)
    else:
        query = query.filter_by(recipient_user_id=current_user.id)
    return [_out(f) for f in query.order_by(LeadershipFeedback.created_at.desc()).limit(100).all()]


@router.post("/{feedback_id}/acknowledge", response_model=FeedbackOut, dependencies=[Depends(require_roles(UserRole.TEACHER, UserRole.STAFF))])
def acknowledge(school_id: int, feedback_id: int, payload: FeedbackReply, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    row = db.query(LeadershipFeedback).filter_by(school_id=school_id, id=feedback_id, recipient_user_id=current_user.id).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Feedback not found")
    row.status = "acknowledged"
    row.reply = (payload.reply or "").strip() or row.reply
    row.acknowledged_at = datetime.now(timezone.utc)
    if row.author_user_id:
        notify(db, school_id=school_id, user_id=row.author_user_id, title=f"{current_user.full_name} acknowledged your feedback", body=(row.reply or row.topic)[:140], link="/dashboard/teachers")
    db.commit()
    db.refresh(row)
    return _out(row)
