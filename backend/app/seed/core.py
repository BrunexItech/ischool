import random
import re
from datetime import date, timedelta

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.dates import school_today
from app.core.security import pwd_context
from app.models.sample_data import SampleDataRow
from app.models.school import School
from app.models.user import User, UserRole
from app.seed import names

EMAIL_DOMAIN = "milai.com"


def hash_password(password: str) -> str:
    """Sample logins use a cheap bcrypt setting so a whole campus is made in seconds. Any hash still verifies at sign-in."""
    return pwd_context.using(bcrypt__rounds=4).hash(password)


class Seeder:
    """Everything one school's sample data needs: a repeatable random source, unique simple logins, and a record of
    every row created so the lot can be removed again without touching real records."""

    def __init__(self, db: Session, school: School):
        self.db = db
        self.school = school
        self.sid = school.id
        self.rng = random.Random(school.id * 7919 + 13)
        self.today: date = school_today(db, school.id)
        self.created: list = []
        self._emails = {e.lower() for (e,) in db.query(User.email)}
        self._firsts_in_use = {e.split("@")[0].rstrip("0123456789") for e in self._emails if e.endswith("@" + EMAIL_DOMAIN)}
        self._hash_cache: dict[str, str] = {}

    # ---- bookkeeping ------------------------------------------------------------------------------------------
    def add(self, obj):
        self.db.add(obj)
        self.created.append(obj)
        return obj

    def flush(self):
        self.db.flush()

    def save_log(self):
        self.db.flush()
        for seq, obj in enumerate(self.created):
            self.db.add(SampleDataRow(school_id=self.sid, seq=seq, table_name=obj.__tablename__, row_id=obj.id))

    # ---- dates ------------------------------------------------------------------------------------------------
    def school_days_back(self, count: int) -> list[date]:
        days, d = [], self.today
        while len(days) < count:
            if d.weekday() < 5:
                days.append(d)
            d -= timedelta(days=1)
        return list(reversed(days))

    def monday_of(self, d: date) -> date:
        return d - timedelta(days=d.weekday())

    # ---- people -----------------------------------------------------------------------------------------------
    def person(self, female: bool | None = None, unique_first: bool = False) -> dict:
        female = self.rng.random() < 0.5 if female is None else female
        pool = names.FEMALE_FIRST if female else names.MALE_FIRST
        if unique_first:
            free = [n for n in pool if n.lower() not in self._firsts_in_use]
            first = self.rng.choice(free or pool)
        else:
            first = self.rng.choice(pool)
        group = self.rng.choice(["k", "lu", "lo"])
        last = self.rng.choice({"k": names.KALENJIN_LAST, "lu": names.LUHYA_LAST, "lo": names.LUO_LAST}[group])
        middle = self.rng.choice(
            {
                ("k", True): names.KALENJIN_MIDDLE_F, ("k", False): names.KALENJIN_MIDDLE_M,
                ("lu", True): names.LUHYA_MIDDLE_F, ("lu", False): names.LUHYA_MIDDLE_M,
                ("lo", True): names.LUO_MIDDLE_F, ("lo", False): names.LUO_MIDDLE_M,
            }[(group, female)]
        )
        return {"first": first, "middle": middle, "last": last, "female": female, "full": f"{first} {middle} {last}"}

    def phone(self) -> str:
        return f"+2547{self.rng.randint(10, 29)}{self.rng.randint(100000, 999999)}"

    def account(self, role: UserRole, person: dict | None = None, *, female: bool | None = None, school: bool = True) -> tuple[User, dict]:
        """A login like eugene@milai.com with the password @Eugene@#1."""
        person = person or self.person(female, unique_first=True)
        base = re.sub(r"[^a-z]", "", person["first"].lower())
        email, n = f"{base}@{EMAIL_DOMAIN}", 1
        while email in self._emails:
            n += 1
            email = f"{base}{n}@{EMAIL_DOMAIN}"
        self._emails.add(email)
        self._firsts_in_use.add(base)
        password = f"@{person['first']}@#1"
        hashed = self._hash_cache.get(password) or self._hash_cache.setdefault(password, hash_password(password))
        user = self.add(
            User(
                school_id=self.sid if school else None, email=email, full_name=person["full"], hashed_password=hashed,
                role=role, must_change_password=False, is_demo=True,
            )
        )
        self.flush()
        return user, person


def remove_sample_rows(db: Session, school_id: int) -> int:
    """Delete exactly the rows the generator made for this school, newest first, a table at a time."""
    rows = db.query(SampleDataRow).filter_by(school_id=school_id).order_by(SampleDataRow.seq.desc()).all()
    removed = 0
    batches: list[tuple[str, list[int]]] = []
    for r in rows:
        if batches and batches[-1][0] == r.table_name and len(batches[-1][1]) < 500:
            batches[-1][1].append(r.row_id)
        else:
            batches.append((r.table_name, [r.row_id]))
    for table, ids in batches:
        try:
            with db.begin_nested():
                res = db.execute(text(f'DELETE FROM "{table}" WHERE id = ANY(:ids)'), {"ids": ids})
                removed += res.rowcount or 0
        except Exception:
            for rid in ids:   # one stubborn row (now referenced by something real) must not stop the rest
                try:
                    with db.begin_nested():
                        removed += db.execute(text(f'DELETE FROM "{table}" WHERE id = :i'), {"i": rid}).rowcount or 0
                except Exception:
                    continue
    db.query(SampleDataRow).filter_by(school_id=school_id).delete()
    db.commit()
    return removed
