from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.crypto import encrypt_secret
from app.core.database import get_db
from app.core.deps import ensure_school_access, get_current_user, require_feature, require_roles
from app.core.mailer import send_email
from app.core.mobilesasa import MobileSasaError, get_balance, send_bulk_sms
from app.core.notify import notify
from app.core.phone import normalize_kenyan_phone
from app.models.academics import Student
from app.models.communication import Announcement, AnnouncementAudience
from app.models.communication_config import SchoolCommunicationConfig
from app.models.user import User, UserRole
from app.schemas.communication import AnnouncementCreate, AnnouncementCreateResult, AnnouncementOut
from app.schemas.communication_config import CommunicationConfigOut, CommunicationConfigUpdate

router = APIRouter(prefix="/schools/{school_id}", tags=["communication"])

AUDIENCE_ROLES: dict[AnnouncementAudience, tuple[UserRole, ...]] = {
    AnnouncementAudience.TEACHERS: (UserRole.TEACHER,),
    AnnouncementAudience.STAFF: (UserRole.STAFF,),
    AnnouncementAudience.STUDENTS: (UserRole.STUDENT,),
    AnnouncementAudience.PARENTS: (UserRole.PARENT,),
}

VIEW_ROLES = (
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.SUPERVISOR,
    UserRole.TEACHER,
    UserRole.STAFF,
    UserRole.STUDENT,
    UserRole.PARENT,
)
POST_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SUPERVISOR, UserRole.TEACHER)
ADMIN_ROLES = (UserRole.SUPER_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.SUPERVISOR)


@router.get(
    "/announcements",
    response_model=list[AnnouncementOut],
    dependencies=[Depends(require_roles(*VIEW_ROLES)), Depends(require_feature("communication"))],
)
def list_announcements(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    return (
        db.query(Announcement)
        .filter_by(school_id=school_id)
        .order_by(Announcement.created_at.desc())
        .all()
    )


@router.post(
    "/announcements",
    response_model=AnnouncementCreateResult,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*POST_ROLES)), Depends(require_feature("communication"))],
)
def create_announcement(
    school_id: int,
    payload: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    if payload.class_id is not None:
        class_exists = db.query(Student.id).filter_by(school_id=school_id, class_id=payload.class_id).first()
        if class_exists is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That class has no students on file")

    fields = payload.model_dump(exclude={"send_sms", "send_email"})
    announcement = Announcement(school_id=school_id, created_by=current_user.id, **fields)
    db.add(announcement)
    db.flush()

    # A class only narrows STUDENTS/PARENTS audiences (a class has students,
    # not staff) — everything else ignores it and reaches the whole audience.
    class_scoped = payload.class_id is not None and payload.audience in (AnnouncementAudience.STUDENTS, AnnouncementAudience.PARENTS)

    recipients_query = db.query(User).filter_by(school_id=school_id, is_active=True)
    roles = AUDIENCE_ROLES.get(payload.audience)
    if roles is not None:
        recipients_query = recipients_query.filter(User.role.in_(roles))
    if class_scoped:
        link_column = Student.user_id if payload.audience == AnnouncementAudience.STUDENTS else Student.guardian_user_id
        linked_ids = {
            uid for (uid,) in db.query(link_column).filter(Student.school_id == school_id, Student.class_id == payload.class_id, link_column.isnot(None))
        }
        recipients_query = recipients_query.filter(User.id.in_(linked_ids))
    for recipient in recipients_query.all():
        if recipient.id == current_user.id:
            continue
        notify(
            db,
            school_id=school_id,
            user_id=recipient.id,
            title=f"New announcement: {announcement.title}",
            body=announcement.body,
        )

    def _guardian_contacts(column):
        query = db.query(column).filter(Student.school_id == school_id, column.isnot(None))
        if payload.class_id is not None:
            query = query.filter(Student.class_id == payload.class_id)
        return {v for (v,) in query.distinct()}

    sms_sent = 0
    sms_error = None
    if payload.send_sms and payload.audience in (AnnouncementAudience.ALL, AnnouncementAudience.PARENTS):
        config = db.query(SchoolCommunicationConfig).filter_by(school_id=school_id).first()
        if config is None or not config.sms_configured:
            sms_error = "SMS isn't set up for this school yet — the announcement was still posted."
        else:
            phones = set()
            for raw in _guardian_contacts(Student.guardian_phone):
                try:
                    phones.add(normalize_kenyan_phone(raw))
                except HTTPException:
                    continue  # a malformed number on file shouldn't block everyone else's SMS
            phones = list(phones)
            if phones:
                text = f"{announcement.title}: {announcement.body}"[:300]
                try:
                    send_bulk_sms(config, phones=phones, message=text)
                    sms_sent = len(phones)
                except MobileSasaError as exc:
                    sms_error = str(exc)

    email_sent = 0
    email_error = None
    if payload.send_email and payload.audience in (AnnouncementAudience.ALL, AnnouncementAudience.PARENTS):
        emails = list(_guardian_contacts(Student.guardian_email))
        if not emails:
            email_error = "No guardian email addresses on file for this audience."
        else:
            # CC the sender and every school_admin so the principal/owner sees
            # the thread, and reply-to the sender so a parent's reply lands
            # with a real person — the practical way to "see feedback" without
            # standing up inbound-email infrastructure.
            admin_emails = {
                e for (e,) in db.query(User.email).filter_by(school_id=school_id, role=UserRole.SCHOOL_ADMIN, is_active=True)
            }
            cc = sorted(admin_emails | {current_user.email})
            subject = announcement.title
            text_body = f"{announcement.body}\n\n— Sent via Milai Group of Schools on behalf of your school."
            html_body = (
                f'<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;color:#111827;line-height:1.6;">'
                f'<p>{announcement.body.replace(chr(10), "<br>")}</p>'
                f'<p style="color:#6B7280;font-size:12px;margin-top:24px;">Sent via Milai Group of Schools on behalf of your school.</p></div>'
            )
            sent_any = False
            for guardian_email in emails:
                if send_email(guardian_email, subject, text_body, html=html_body, cc=cc, reply_to=current_user.email):
                    sent_any = True
                    email_sent += 1
            if not sent_any:
                email_error = "Email isn't set up on this server yet — the announcement was still posted."
                email_sent = 0

    db.commit()
    db.refresh(announcement)
    return AnnouncementCreateResult(
        announcement=announcement, sms_sent=sms_sent, sms_error=sms_error, email_sent=email_sent, email_error=email_error
    )


def _config_out(config: SchoolCommunicationConfig | None, balance: int | None = None) -> CommunicationConfigOut:
    if config is None:
        return CommunicationConfigOut(sms_configured=False)
    return CommunicationConfigOut(sms_configured=config.sms_configured, mobilesasa_sender_id=config.mobilesasa_sender_id, balance=balance)


@router.get(
    "/communication-config",
    response_model=CommunicationConfigOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES))],
)
def get_communication_config(school_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_school_access(db, current_user, school_id)
    config = db.query(SchoolCommunicationConfig).filter_by(school_id=school_id).first()
    balance = None
    if config is not None and config.sms_configured:
        try:
            balance = get_balance(config)
        except MobileSasaError:
            balance = None
    return _config_out(config, balance)


@router.put(
    "/communication-config",
    response_model=CommunicationConfigOut,
    dependencies=[Depends(require_roles(*ADMIN_ROLES))],
)
def set_communication_config(
    school_id: int,
    payload: CommunicationConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_school_access(db, current_user, school_id)
    config = db.query(SchoolCommunicationConfig).filter_by(school_id=school_id).first()
    if config is None:
        config = SchoolCommunicationConfig(school_id=school_id)
        db.add(config)

    if payload.mobilesasa_api_token is not None:
        config.mobilesasa_api_token_encrypted = encrypt_secret(payload.mobilesasa_api_token)
    if payload.mobilesasa_sender_id is not None:
        config.mobilesasa_sender_id = payload.mobilesasa_sender_id

    balance = None
    if config.sms_configured:
        try:
            balance = get_balance(config)
        except MobileSasaError as exc:
            db.rollback()
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Failed to verify MobileSasa credentials: {exc}")

    db.commit()
    return _config_out(config, balance)
