from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def record_audit(
    db: Session,
    *,
    school_id: int,
    actor_id: int | None,
    action: str,
    entity_type: str,
    entity_id: int,
    before: dict | None = None,
    after: dict | None = None,
) -> None:
    """Adds an audit row to the current session — caller commits as part of
    its own transaction, so this never partially persists on its own.
    `before`/`after` must already be JSON-safe (floats/strings, not Decimal
    or date/datetime objects)."""
    db.add(
        AuditLog(
            school_id=school_id,
            actor_user_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            before=before,
            after=after,
        )
    )
