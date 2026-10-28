from datetime import datetime, time, timedelta, timezone

from app.models.activity import Activity, ActivityParticipant
from app.models.award import Award
from app.models.competency_assessment import CompetencyAssessment, PerformanceLevel
from app.models.complaint import Complaint, ComplaintAudience, ComplaintStatus
from app.models.conduct_report import ConductCategory, ConductReport, ConductStatus
from app.models.feedback import LeadershipFeedback
from app.models.lead import Lead, LeadStage
from app.models.live_classes import LiveClass, LiveClassStatus
from app.models.meeting import StaffMeeting
from app.models.observation_note import ObservationNote
from app.models.report_card_remark import ReportCardRemark
from app.models.trip import Trip, TripStatus
from app.models.user import User, UserRole
from app.models.transport import Vehicle
from app.seed.academics import Ctx
from app.seed.core import Seeder


def _at(d, h=10):
    return datetime(d.year, d.month, d.day, h, 0, tzinfo=timezone.utc)


def _head(s: Seeder):
    return s.db.query(User).filter_by(school_id=s.sid, role=UserRole.HEAD_OF_INSTITUTION).first()


def seed_activities_and_awards(s: Seeder, ctx: Ctx):
    head = _head(s)
    pe = ctx.teachers[1][0] if len(ctx.teachers) > 1 else ctx.teachers[0][0]
    all_students = [st for sts in ctx.students.values() for st in sts]
    acts = []
    for name, desc, days in (("Inter-house athletics", "Track and field events for all learners.", -20), ("Drama and music festival", "Zonal festival performance.", -12), ("Science congress", "Projects presented to judges.", -5),
                              ("Football league: junior team", "Friendly matches against nearby schools.", 6)):
        a = s.add(Activity(school_id=s.sid, name=name, date=s.today + timedelta(days=days), description=desc, created_by=pe.id, scope="school"))
        s.flush()
        for st in s.rng.sample(all_students, min(10, len(all_students))):
            s.add(ActivityParticipant(activity_id=a.id, student_id=st.id, role=s.rng.choice(["Participant", "Participant", "Team Captain", "1st Place", "2nd Place"])))
        acts.append(a)
    s.flush()
    learners = s.rng.sample(all_students, min(8, len(all_students)))
    titles = [("Top in Mathematics", "academic"), ("Most improved learner", "academic"), ("Best in athletics", "sports"), ("Leadership award", "leadership"),
              ("Perfect attendance", "attendance"), ("Best in Kiswahili", "academic"), ("Creativity award", "arts"), ("Good conduct", "character")]
    for st, (title, cat) in zip(learners, titles):
        s.add(Award(school_id=s.sid, scope="student", student_id=st.id, title=title, description=f"Awarded to {st.first_name} for outstanding performance this term.", category=cat,
                    date_awarded=s.today - timedelta(days=s.rng.randint(2, 40)), term=ctx.term, awarded_by=pe.id))
    c = list(ctx.classes.values())[-1]
    s.add(Award(school_id=s.sid, scope="class", class_id=c.id, title="Cleanest class of the term", category="character", date_awarded=s.today - timedelta(days=6), term=ctx.term, awarded_by=head.id if head else None))
    s.add(Award(school_id=s.sid, scope="staff", staff_user_id=ctx.teachers[0][0].id, title="Teacher of the term", category="staff", date_awarded=s.today - timedelta(days=3), term=ctx.term, awarded_by=head.id if head else None))
    s.add(Award(school_id=s.sid, scope="school", title="Best overall performance in the zone", category="school", date_awarded=s.today - timedelta(days=15), term=ctx.term, awarded_by=head.id if head else None))
    s.flush()


def seed_conduct_and_complaints(s: Seeder, ctx: Ctx):
    head = _head(s)
    classes = list(ctx.classes.values())
    for i, (cat, desc, action, status) in enumerate([
        (ConductCategory.DISRUPTION, "Talking continuously during the lesson after repeated warnings.", "Spoken to and moved to the front.", ConductStatus.REVIEWED),
        (ConductCategory.DRESS_CODE, "Came to school without the school sweater on three days.", "Parent informed by phone.", ConductStatus.OPEN),
        (ConductCategory.DISHONESTY, "Copied answers during a class test.", "Mark withheld; counselling arranged.", ConductStatus.OPEN),
        (ConductCategory.DISRESPECT, "Answered the teacher rudely at the gate.", "Apologised in front of the class.", ConductStatus.REVIEWED),
    ]):
        c = classes[(i * 3) % len(classes)]
        st = ctx.students[c.id][i % len(ctx.students[c.id])]
        teacher = ctx.homeroom[c.id]
        reviewed = status == ConductStatus.REVIEWED
        s.add(ConductReport(school_id=s.sid, student_id=st.id, class_id=c.id, reported_by=teacher.id, reported_by_name=teacher.full_name, category=cat, description=desc, action_taken=action,
                            incident_date=s.today - timedelta(days=2 + i * 3), status=status, response="Noted. Please keep me updated on progress." if reviewed else None,
                            responded_by=head.id if (reviewed and head) else None, responded_at=_at(s.today - timedelta(days=1)) if reviewed else None))
    parents = [(st, st.guardian_user_id) for sts in ctx.students.values() for st in sts if st.guardian_user_id]
    if parents:
        for i, (subject, msg, resp) in enumerate([
            ("Lunch box left on the bus", "Please check whether a blue lunch box was left on the bus on Monday.", "We found it at the front desk. It is ready for collection."),
            ("Homework load", "My child has a lot of homework on Fridays. Could the teachers spread it across the week?", None),
            ("School bus timing", "The morning bus has been arriving late. Please look into this.", None),
        ]):
            st, uid = parents[i % len(parents)]
            reply = resp is not None
            s.add(Complaint(school_id=s.sid, raised_by=uid, raised_by_name=st.guardian_name or "Parent", raised_by_role="parent",
                            audience=ComplaintAudience.CLASS_TEACHER if i == 0 else ComplaintAudience.PRINCIPAL, class_id=st.class_id, subject=subject, message=msg,
                            status=ComplaintStatus.RESOLVED if reply else ComplaintStatus.OPEN, response=resp, responded_by=ctx.homeroom[st.class_id].id if reply else None,
                            responded_at=_at(s.today - timedelta(days=1)) if reply else None))
    s.flush()


def seed_trips(s: Seeder, ctx: Ctx):
    head = _head(s)
    teacher = ctx.teachers[0][0]
    vehicle = s.db.query(Vehicle).filter_by(school_id=s.sid).first()
    classes = list(ctx.classes.values())
    for i, (title, dest, status, start, ttype, cost) in enumerate([
        ("Nairobi National Museum", "Nairobi", TripStatus.APPROVED, s.today + timedelta(days=6), "educational", 85000),
        ("Kaptagat Forest nature walk", "Kaptagat", TripStatus.REQUESTED, s.today + timedelta(days=12), "educational", 24000),
        ("Zonal athletics meeting", "Eldoret Sports Club", TripStatus.COMPLETED, s.today - timedelta(days=9), "sports", 18000),
    ]):
        group = classes[-(i + 1):][:2] if i < len(classes) else classes[:1]
        students = [st.id for c in group for st in ctx.students[c.id]]
        s.add(Trip(school_id=s.sid, reference=f"TRP-{s.sid}-{i + 1:03d}", title=title, trip_type=ttype, purpose="Learners connect classroom topics with real places and experiences.", destination=dest,
                   start_date=start, end_date=start, departure_time=time(7, 0), return_time=time(17, 0), class_ids=[c.id for c in group], student_ids=students, staff_count=3,
                   distance_km=[320, 25, 8][i], estimated_cost=cost, vehicle_id=vehicle.id if vehicle else None, status=status, requested_by=teacher.id))
    s.flush()


STRANDS = {
    "Mathematics": ("Numbers", "Whole numbers", "Reads, writes and orders whole numbers correctly"), "Mathematical Activities": ("Numbers", "Counting", "Counts objects up to 20 with understanding"),
    "English": ("Reading", "Comprehension", "Answers questions about a short passage"), "English Language Activities": ("Listening and speaking", "Sounds", "Pronounces letter sounds clearly"),
    "Language Activities": ("Listening and speaking", "Songs and rhymes", "Joins in rhymes and repeats simple sentences"),
    "Environmental Activities": ("Our environment", "Plants", "Names parts of a plant"),
}


def seed_competency(s: Seeder, ctx: Ctx):
    levels = [PerformanceLevel.EXCEEDING_EXPECTATION, PerformanceLevel.MEETING_EXPECTATION, PerformanceLevel.MEETING_EXPECTATION, PerformanceLevel.APPROACHING_EXPECTATION, PerformanceLevel.BELOW_EXPECTATION]
    notes = ["Participates eagerly and helps classmates.", "Needs encouragement to speak in class.", "Shows real curiosity during practical work.", "Works well in groups and finishes tasks on time."]
    for g in ctx.grades[:5]:   # the early years, where competency assessment is the main record
        c = ctx.classes[g.code]
        subjects = [n for n in ctx.class_subjects[c.id] if n in STRANDS][:3] or ctx.class_subjects[c.id][:2]
        for st in ctx.students[c.id]:
            for subject in subjects:
                strand, sub, criterion = STRANDS.get(subject, (subject, "Core skills", f"Shows understanding of {subject.lower()} concepts"))
                s.add(CompetencyAssessment(
                    school_id=s.sid, student_id=st.id, class_id=c.id, subject_id=ctx.subjects[subject].id, teacher_user_id=ctx.homeroom[c.id].id, term=ctx.term, strand=strand, sub_strand=sub,
                    criterion=criterion, performance_level=s.rng.choices(levels, weights=[2, 5, 5, 3, 1])[0], assessment_date=s.today - timedelta(days=s.rng.randint(3, 40)),
                    teacher_comment=s.rng.choice(notes), follow_up_action=None,
                ))
            if s.rng.random() < 0.5:
                s.add(ObservationNote(school_id=s.sid, student_id=st.id, class_id=c.id, teacher_user_id=ctx.homeroom[c.id].id, subject_id=ctx.subjects[subjects[0]].id, strand=STRANDS.get(subjects[0], ("General",))[0], note=s.rng.choice(notes), noted_on=s.today - timedelta(days=s.rng.randint(1, 20))))
    s.flush()


def seed_remarks_feedback_crm(s: Seeder, ctx: Ctx):
    head = _head(s)
    prev = ctx.terms[ctx.terms.index(ctx.term) - 1] if ctx.terms.index(ctx.term) > 0 else ctx.term
    class_remarks = ["A pleasant learner who is making steady progress.", "Works hard and shows good leadership among classmates.", "Needs to be more consistent with homework.", "Has improved remarkably this term."]
    principal_remarks = ["Keep up the good work.", "Well done. Aim even higher next term.", "Good effort. Please revise regularly at home."]
    for c_id, learners in ctx.students.items():
        teacher = ctx.homeroom[c_id]
        for st in learners:
            s.add(ReportCardRemark(school_id=s.sid, student_id=st.id, term=prev, class_teacher_remark=s.rng.choice(class_remarks), principal_remark=s.rng.choice(principal_remarks)))
    # What the head has asked teachers to look at.
    for t, _ in ctx.teachers[:3]:
        s.add(LeadershipFeedback(school_id=s.sid, recipient_user_id=t.id, author_user_id=head.id if head else None, topic="Lesson plan: this term", link="/dashboard/lesson-plans",
                                 message="Thank you for the plans. Please add resources for weeks 9 to 12.", status="acknowledged" if t is ctx.teachers[0][0] else "sent",
                                 reply="Done, thank you." if t is ctx.teachers[0][0] else None))
    secretary = (ctx.staff.get(UserRole.SECRETARY) or [None])[0]
    grades = [g.display_name for g in ctx.grades]
    stages = [LeadStage.ENQUIRY, LeadStage.VISIT_BOOKED, LeadStage.APPLIED, LeadStage.OFFER_SENT, LeadStage.ENROLLED, LeadStage.LOST]
    for i in range(10):
        p = s.person()
        child = s.person()
        s.add(Lead(school_id=s.sid, child_name=f"{child['first']} {child['middle']} {p['last']}", grade_interested=s.rng.choice(grades), guardian_name=p["full"], guardian_phone=s.phone(),
                   guardian_email=f"{p['first'].lower()}.{p['last'].lower()}@example.com", source=s.rng.choice(["Referral", "Open day", "Facebook", "Walk-in", "School website"]),
                   stage=stages[i % len(stages)], notes="Interested in the new year intake.", created_by=secretary.id if secretary else None))
    s.flush()


def seed_live_and_meetings(s: Seeder, ctx: Ctx):
    head = _head(s)
    now = datetime.now(timezone.utc)
    for i, (g, subject, delta, status) in enumerate([(ctx.grades[-1], None, 1, LiveClassStatus.SCHEDULED), (ctx.grades[min(3, len(ctx.grades) - 1)], None, -1, LiveClassStatus.ENDED)]):
        c = ctx.classes[g.code]
        subject = ctx.class_subjects[c.id][0]
        teacher = ctx.subject_teacher[(c.id, subject)]
        s.add(LiveClass(school_id=s.sid, class_id=c.id, title=f"{subject} revision: {g.display_name}", scheduled_start=now + timedelta(days=delta, hours=3), status=status,
                        room_name=f"sample-{s.sid}-{i}-{int(now.timestamp())}", join_code=f"S{s.sid}X{i}{int(now.timestamp()) % 100000}", created_by=teacher.id))
    if head:
        s.add(StaffMeeting(host_user_id=head.id, title="Term review meeting", agenda="Results, attendance, fees and closing-day plans.", scheduled_start=now + timedelta(days=2, hours=2), status="scheduled",
                           room_name=f"meeting-{s.sid}-{int(now.timestamp())}", school_ids=[s.sid], audience="all", invitee_user_ids=[]))
    s.flush()
