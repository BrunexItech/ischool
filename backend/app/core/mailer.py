import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger("ischool.mailer")


def send_email(
    to: str,
    subject: str,
    body: str,
    html: str | None = None,
    cc: list[str] | None = None,
    reply_to: str | None = None,
) -> bool:
    """Sends an email if SMTP is configured; otherwise logs it so nothing is
    silently lost during local dev. Never raises — a mail failure must not
    break the request that triggered it (e.g. a password reset should still
    report success generically either way, to avoid leaking account existence).
    `html`, when given, is attached as the multipart/alternative rich body —
    `body` is always sent too, as the plain-text fallback. `cc` is sent to
    every recipient alongside `to` (e.g. so a principal sees every outgoing
    bulk message); `reply_to` routes a reply somewhere a real person reads it."""
    if not settings.email_enabled:
        logger.warning("SMTP not configured — email not sent. To=%s Subject=%s\n%s", to, subject, body)
        return False

    message = EmailMessage()
    message["From"] = settings.smtp_from
    message["To"] = to
    if cc:
        message["Cc"] = ", ".join(cc)
    if reply_to:
        message["Reply-To"] = reply_to
    message["Subject"] = subject
    message.set_content(body)
    if html:
        message.add_alternative(html, subtype="html")

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
            smtp.starttls()
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)  # recipients are derived from the To/Cc headers set above
        return True
    except Exception:
        logger.exception("Failed to send email to %s", to)
        return False
