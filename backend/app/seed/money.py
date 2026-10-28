from datetime import datetime, timedelta, timezone

from app.models.fee_structure import FeeStructureLine
from app.models.fees import FeeInvoice, FeePayment
from app.models.user import User, UserRole
from app.seed.academics import Ctx
from app.seed.core import Seeder

TUITION = {"pre_primary": 12000, "primary": 18000, "junior_school": 24000, "senior_school": 32000}
MEALS = {"pre_primary": 4500, "primary": 5500, "junior_school": 6500, "senior_school": 7500}
ACTIVITY = {"pre_primary": 1500, "primary": 2000, "junior_school": 2500, "senior_school": 3000}
BOARDING = 28000
TRANSPORT = 6000


def _head(s: Seeder):
    return s.db.query(User).filter_by(school_id=s.sid, role=UserRole.HEAD_OF_INSTITUTION).first()


def seed_fees(s: Seeder, ctx: Ctx):
    prev = ctx.terms[ctx.terms.index(ctx.term) - 1] if ctx.terms.index(ctx.term) > 0 else None
    head = _head(s)
    existing = {(l.term, l.grade_level_id, l.category) for l in s.db.query(FeeStructureLine).filter_by(school_id=s.sid)}
    terms = [t for t in (prev, ctx.term) if t]
    for term in terms:
        for g in ctx.grades:
            grp = g.level_group.value
            lines = [("tuition", TUITION[grp]), ("meals", MEALS[grp]), ("activity", ACTIVITY[grp]), ("transport", TRANSPORT)]
            if ctx.boarding:
                lines.append(("boarding", BOARDING))
            for cat, amount in lines:
                if (term, g.id, cat) not in existing:
                    s.add(FeeStructureLine(school_id=s.sid, term=term, grade_level_id=g.id, category=cat, amount=amount))
    s.flush()

    methods = ["M-Pesa", "M-Pesa", "M-Pesa", "Bank", "Cash"]
    for g in ctx.grades:
        grp = g.level_group.value
        c = ctx.classes[g.code]
        for idx, st in enumerate(ctx.students[c.id]):
            for term in terms:
                is_current = term == ctx.term
                cats = [("tuition", TUITION[grp]), ("meals", MEALS[grp]), ("activity", ACTIVITY[grp])]
                if ctx.boarding and idx % 3 == 0:
                    cats.append(("boarding", BOARDING))
                if idx % 4 == 0:
                    cats.append(("transport", TRANSPORT))
                # Some families clear everything, some pay in part, a few have paid nothing yet.
                profile = s.rng.choices(["full", "part", "little"], weights=[40, 40, 20])[0]
                if not is_current:
                    profile = s.rng.choices(["full", "part"], weights=[70, 30])[0]   # last term: a few left owing
                for cat, amount in cats:
                    paid = amount if profile == "full" else round(amount * s.rng.choice([0.4, 0.5, 0.6, 0.75])) if profile == "part" else (round(amount * 0.1) if cat == "tuition" else 0)
                    due = s.today + timedelta(days=14) if is_current else s.today - timedelta(days=60)
                    inv = s.add(FeeInvoice(school_id=s.sid, student_id=st.id, term=term, category=cat, amount_due=amount, amount_paid=paid, due_date=due))
                    s.flush()
                    if paid > 0:
                        first = round(paid * 0.6) if paid > 4000 and profile != "full" else paid
                        for part, amt in enumerate([first, paid - first]):
                            if amt <= 0:
                                continue
                            paid_at = datetime.now(timezone.utc) - timedelta(days=s.rng.randint(3, 40) + part * 12)
                            s.add(FeePayment(
                                school_id=s.sid, invoice_id=inv.id, amount=amt, method=s.rng.choice(methods),
                                reference="".join(s.rng.choice("ABCDEFGHJKLMNPQRSTUVWXYZ0123456789") for _ in range(10)),
                                recorded_by=head.id if head else None, paid_at=paid_at,
                            ))
    s.flush()
