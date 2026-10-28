from datetime import datetime, time, timedelta, timezone

from app.models.academic_term import AcademicTerm
from app.models.exam import Exam, ExamAnswer, ExamQuestion, ExamQuestionType, ExamSubmission, ExamSubmissionStatus
from app.models.homework import Homework, HomeworkDeclaration, HomeworkSubmission, HomeworkSubmissionStatus
from app.models.lesson_delivery import LessonDelivery
from app.models.lesson_plan import LessonPlan, LessonPlanEntry, LessonPlanEntryStatus
from app.seed import banks
from app.seed.academics import Ctx
from app.seed.core import Seeder
from app.seed.pdfs import save_sample_pdf

HOMEWORK_PLAN = [
    # (type, title template, instructions, give a PDF worksheet?, due in days)
    ("Assignment", "{subject}: practice exercise", "Complete the exercise in your {subject} book. Show your working and hand in on the due date.", True, 2),
    ("Revision", "{subject}: end of term revision", "Revise the topics covered this term using your notes and the attached sheet.", True, 5),
    ("Reading", "{subject}: reading task", "Read the passage given in class and answer the questions in full sentences.", False, 1),
    ("Project", "{subject}: group project", "Work in your group of four to prepare a short presentation. Each member must speak.", False, 7),
]


def _utc(d, h=8, m=0):
    return datetime(d.year, d.month, d.day, h, m, tzinfo=timezone.utc)


def seed_homework(s: Seeder, ctx: Ctx):
    declared = 0
    for g in ctx.grades:
        c = ctx.classes[g.code]
        subjects = [n for n in ctx.class_subjects[c.id] if n in ctx.subjects]
        s.rng.shuffle(subjects)
        picks = subjects[: len(HOMEWORK_PLAN)]
        for (htype, title_t, instr_t, pdf, due_days), subject in zip(HOMEWORK_PLAN, picks):
            teacher = ctx.subject_teacher[(c.id, subject)]
            title = title_t.format(subject=subject)
            attachment = None
            if pdf:
                attachment = save_sample_pdf(
                    s.sid, "homework", f"{g.code.lower()}-{subject.lower().replace(' ', '-')}", f"{subject} - {g.display_name}",
                    [f"Worksheet for {g.display_name}", "", "Name: ______________________   Date: ______________", ""]
                    + [f"{i}. ________________________________________________" for i in range(1, 11)],
                )
            due = s.today + timedelta(days=due_days - 3)   # some already past, so the lists show late work too
            hw = s.add(Homework(
                school_id=s.sid, class_id=c.id, subject_id=ctx.subjects[subject].id, title=title, homework_type=htype,
                instructions=instr_t.format(subject=subject), attachment_url=attachment, due_date=due,
                allow_digital_submission=True, created_by=teacher.id,
            ))
            s.flush()
            for st in ctx.students[c.id]:
                roll = s.rng.random()
                if roll < 0.45:
                    s.add(HomeworkSubmission(
                        homework_id=hw.id, student_id=st.id, status=HomeworkSubmissionStatus.REVIEWED, submitted_at=_utc(due - timedelta(days=1), 15),
                        score=s.rng.randint(5, 10), teacher_comment=s.rng.choice(["Well done", "Neat work", "Good effort, check your spelling", "Excellent"]),
                        reviewed_by=teacher.id, reviewed_at=_utc(due, 10),
                    ))
                elif roll < 0.65:
                    s.add(HomeworkSubmission(homework_id=hw.id, student_id=st.id, status=HomeworkSubmissionStatus.SUBMITTED, submitted_at=_utc(due - timedelta(days=1), 17)))
        # A day with no homework is a recorded fact too.
        if len(subjects) > len(HOMEWORK_PLAN):
            s.add(HomeworkDeclaration(school_id=s.sid, class_id=c.id, subject_id=ctx.subjects[subjects[-1]].id, date=s.school_days_back(2)[0], declared_by=ctx.subject_teacher[(c.id, subjects[-1])].id))
            declared += 1
    s.flush()


def seed_exams(s: Seeder, ctx: Ctx):
    """Online multiple-choice exams for the classes that sit them (Grade 1 upwards), some already marked."""
    now = datetime.now(timezone.utc)
    for g in ctx.grades:
        if g.code in ("PP1", "PP2"):
            continue
        c = ctx.classes[g.code]
        made = 0
        for subject in ctx.class_subjects[c.id]:
            bank = banks.bank_for(subject, s.rng, max(1, g.sort_order - 2))
            if bank is None or made >= 2:
                continue
            made += 1
            teacher = ctx.subject_teacher[(c.id, subject)]
            qs = list(bank)[:10]
            exam = s.add(Exam(
                school_id=s.sid, subject_id=ctx.subjects[subject].id, class_id=c.id, title=f"{subject}: {'CAT 2' if made == 1 else 'Mid Term'} online quiz",
                exam_type="CAT 2" if made == 1 else "Mid Term", term=ctx.term, duration_minutes=30, is_published=True,
                opens_at=now - timedelta(days=3), closes_at=now + timedelta(days=10), created_by=teacher.id,
            ))
            s.flush()
            questions = []
            for i, (q, opts, right) in enumerate(qs, start=1):
                questions.append(s.add(ExamQuestion(exam_id=exam.id, question_text=q, question_type=ExamQuestionType.MCQ, marks=2, order=i, options=opts, correct_option_index=right)))
            s.flush()
            # A few learners have already sat it.
            for st in ctx.students[c.id][: s.rng.randint(4, 7)]:
                sub = s.add(ExamSubmission(exam_id=exam.id, student_id=st.id, status=ExamSubmissionStatus.GRADED, started_at=now - timedelta(days=2, hours=1), submitted_at=now - timedelta(days=2, minutes=35)))
                s.flush()
                skill = s.rng.uniform(0.45, 0.95)
                for qn in questions:
                    correct = s.rng.random() < skill
                    pick = qn.correct_option_index if correct else (qn.correct_option_index + s.rng.randint(1, 3)) % len(qn.options)
                    s.add(ExamAnswer(submission_id=sub.id, question_id=qn.id, answer_text=str(pick), awarded_marks=2.0 if correct else 0.0))
    # And a printable paper (PDF) for the end-of-term exam in the highest classes of the campus.
    for g in ctx.grades[-2:]:
        c = ctx.classes[g.code]
        subject = ctx.class_subjects[c.id][2 if len(ctx.class_subjects[c.id]) > 2 else 0]
        teacher = ctx.subject_teacher[(c.id, subject)]
        url = save_sample_pdf(s.sid, "exams", f"{g.code.lower()}-end-term-paper", f"{subject} End Term Paper - {g.display_name}",
                              ["Time: 1 hour 30 minutes", "", "Answer ALL questions in the spaces provided."] + [f"{i}. ______________________________________________ (5 marks)" for i in range(1, 9)])
        s.add(Exam(school_id=s.sid, subject_id=ctx.subjects[subject].id, class_id=c.id, title=f"{subject}: End Term paper", exam_type="End Term", term=ctx.term,
                   duration_minutes=90, is_published=True, opens_at=now + timedelta(days=1), closes_at=now + timedelta(days=6), paper_file_url=url, created_by=teacher.id))
    s.flush()


def seed_lesson_plans(s: Seeder, ctx: Ctx):
    """A full-term plan for every learning area of every class, with the weeks already taught marked complete."""
    term_row = s.db.query(AcademicTerm).filter_by(school_id=s.sid, name=ctx.term).first()
    start = (term_row.start_date if term_row else None) or (s.today - timedelta(days=70))
    weeks_done = max(0, min(11, (s.today - start).days // 7))
    plans = {}
    for g in ctx.grades:
        c = ctx.classes[g.code]
        for subject in ctx.class_subjects[c.id]:
            teacher = ctx.subject_teacher[(c.id, subject)]
            plan = s.add(LessonPlan(school_id=s.sid, class_id=c.id, subject_id=ctx.subjects[subject].id, term=ctx.term, created_by=teacher.id))
            s.flush()
            topics = banks.topics_for(subject)
            entries = []
            for i, topic in enumerate(topics[:12], start=1):
                wk = i
                entries.append(s.add(LessonPlanEntry(
                    lesson_plan_id=plan.id, order=i, label=f"Week {wk}", scheduled_date=start + timedelta(days=7 * (wk - 1)), topic=topic,
                    objectives=f"By the end of the lesson the learner should be able to explain and apply: {topic.lower()}.",
                    resources="Textbook, charts, exercise books and real objects from the environment",
                    notes="Group work and a short oral assessment at the end.",
                    status=LessonPlanEntryStatus.COMPLETED if wk <= weeks_done else LessonPlanEntryStatus.PLANNED,
                )))
            plans[(c.id, subject)] = entries
    s.flush()

    # What was actually taught over the last ten school days (the record of work covered).
    days = s.school_days_back(10)
    for slot, c, subject in ctx.slots:
        entries = plans.get((c.id, subject))
        if not entries:
            continue
        teacher = ctx.subject_teacher[(c.id, subject)]
        for d in days:
            if d.weekday() != slot.day_of_week:
                continue
            roll = s.rng.random()
            wk = min(len(entries) - 1, max(0, (d - start).days // 7))
            if roll < 0.82:
                status, reason, topic = "taught", None, entries[wk].topic
            elif roll < 0.92:
                status, reason, topic = "partly", None, entries[wk].topic
            else:
                status, reason, topic = "not_taught", s.rng.choice(["teacher_absent", "school_event", "exams"]), None
            s.add(LessonDelivery(
                school_id=s.sid, teacher_user_id=teacher.id, class_id=c.id, subject_id=slot.subject_id, timetable_slot_id=slot.id,
                entry_id=entries[wk].id if topic else None, lesson_date=d, start_time=slot.start_time, end_time=slot.end_time,
                status=status, reason=reason, topic=topic, remark="Completed as planned" if status == "taught" else None,
            ))
    s.flush()
