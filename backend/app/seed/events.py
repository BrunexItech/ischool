from datetime import date, timedelta

from app.models.calendar_event import CalendarEvent, CalendarEventType
from app.models.communication import Announcement, AnnouncementAudience
from app.models.user import User, UserRole
from app.seed.academics import Ctx
from app.seed.core import Seeder


def seed_calendar(s: Seeder, ctx: Ctx):
    head = s.db.query(User).filter_by(school_id=s.sid, role=UserRole.HEAD_OF_INSTITUTION).first()
    t = s.today
    y = t.year
    items = [
        ("Staff meeting", CalendarEventType.MEETING, t + timedelta(days=2), None, "Term review and preparations for closing day."),
        ("End-of-term examinations", CalendarEventType.EXAM, t - timedelta(days=2), t + timedelta(days=2), "All classes sit their end-of-term assessments."),
        ("Closing day and report cards", CalendarEventType.OTHER, t + timedelta(days=3), None, "Learners leave at noon. Parents collect report cards."),
        ("Parents' open day", CalendarEventType.MEETING, t + timedelta(days=9), None, "Meet your child's class teacher and review progress."),
        ("Inter-school athletics", CalendarEventType.SPORTS, t + timedelta(days=16), t + timedelta(days=17), "Our teams compete against neighbouring schools in Eldoret."),
        ("Science and talent show", CalendarEventType.OTHER, t + timedelta(days=24), None, "Learners showcase projects, music and drama."),
        ("Christmas holiday", CalendarEventType.HOLIDAY, date_or(t, y, 12, 5), date_or(t, y + 1, 1, 3), "School is closed for the long holiday."),
        (f"Term 1 {y + 1} opens", CalendarEventType.TERM, date_or(t, y + 1, 1, 4), None, "All learners report by 8:00 am."),
        ("Admissions open for next year", CalendarEventType.ADMISSIONS, t + timedelta(days=10), t + timedelta(days=40), "Tours of the campus on weekdays at 10:00 am."),
        ("Trip briefing: Nairobi National Museum", CalendarEventType.TRIP_BRIEFING, t + timedelta(days=6), None, "Parents of Grade 5 and 6 learners are invited."),
    ]
    for title, kind, start, end, desc in items:
        s.add(CalendarEvent(school_id=s.sid, title=title, event_type=kind, start_date=start, end_date=end, description=desc, created_by=head.id if head else None))
    s.flush()


def date_or(today, y, m, d):
    return date(y, m, d)


def seed_announcements(s: Seeder, ctx: Ctx):
    head = s.db.query(User).filter_by(school_id=s.sid, role=UserRole.HEAD_OF_INSTITUTION).first()
    t = s.today
    posts = [
        ("End-of-term examinations", "Dear parents and guardians, the end-of-term examinations are under way. Please ensure learners arrive on time and well rested. Report cards will be issued on closing day.", AnnouncementAudience.PARENTS, t + timedelta(days=3), "Main campus"),
        ("Fee balances reminder", "Kindly clear all outstanding fee balances before closing day. You can pay through M-Pesa using the school paybill, and the bursar's office will issue receipts.", AnnouncementAudience.PARENTS, None, None),
        ("Staff meeting", "All staff are asked to attend the term review meeting in the staff room. Please bring your records of work covered and mark books.", AnnouncementAudience.STAFF, t + timedelta(days=2), "Staff room"),
        ("Congratulations to our athletes", "We celebrate the learners who represented the school at the zonal athletics meet. Well done to all and to the coaches.", AnnouncementAudience.ALL, None, None),
        ("Reopening for the new year", f"Term 1 {t.year + 1} opens on Monday 4 January. Learners should report by 8:00 am in full uniform.", AnnouncementAudience.ALL, None, None),
    ]
    for title, body, audience, event, place in posts:
        s.add(Announcement(school_id=s.sid, title=title, body=body, audience=audience, event_date=event, location=place, created_by=head.id if head else None))
    s.flush()
