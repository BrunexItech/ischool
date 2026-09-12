from sqlalchemy.orm import Session

from app.models.notification import Notification


def notify(db: Session, *, school_id: int, user_id: int, title: str, body: str, link: str | None = None) -> None:
    """Adds a notification to the current session — caller commits as part
    of its own transaction."""
    db.add(Notification(school_id=school_id, user_id=user_id, title=title, body=body, link=link))
