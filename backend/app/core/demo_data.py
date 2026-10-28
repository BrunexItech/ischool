"""Generates and tears down a small set of sample records for a school, so a
superadmin can show the product on a freshly onboarded, otherwise-empty
school. Every row this creates is tagged `is_demo=True`, which is the only
thing `delete_demo_data` looks at — real records are never touched."""

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.academics import SchoolClass, StaffProfile, Student
from app.models.school import School
from app.models.user import User, UserRole

DEMO_PASSWORD = "Demo1234"

_STUDENTS = [
    ("Amani", "Otieno", "F"),
    ("Brian", "Kiprotich", "M"),
    ("Cynthia", "Wanjiru", "F"),
    ("Dennis", "Mwangi", "M"),
    ("Faith", "Chebet", "F"),
    ("Collins", "Were", "M"),
    ("Grace", "Achieng", "F"),
    ("Kevin", "Njoroge", "M"),
]


def has_demo_data(db: Session, school_id: int) -> bool:
    from app.seed.run import has_sample_data

    return has_sample_data(db, school_id) or (
        db.query(Student.id).filter_by(school_id=school_id, is_demo=True).first() is not None
        or db.query(StaffProfile.id).filter_by(school_id=school_id, is_demo=True).first() is not None
    )


def seed_demo_data(db: Session, school: School) -> dict:
    """The full sample school: terms, the standard school day, CBC learning areas, teachers, classes, learners,
    parents, timetable, homework, exams, lesson plans, attendance, marks, fees and events. See app/seed."""
    from app.seed.run import seed_school

    return seed_school(db, school)


def _legacy_seed_demo_data(db: Session, school: School) -> dict:
    if has_demo_data(db, school.id):
        raise ValueError("This school already has demo data. Delete it first.")

    teacher_email = f"demo.teacher.{school.id}@ischool.demo"
    # Clears out a stale demo login left over from a school that was deleted
    # without going through the teardown endpoint — email is globally unique.
    db.query(User).filter_by(email=teacher_email).delete()

    teacher = User(
        school_id=school.id,
        email=teacher_email,
        full_name="Demo Teacher",
        hashed_password=hash_password(DEMO_PASSWORD),
        role=UserRole.TEACHER,
        must_change_password=False,
        is_demo=True,
    )
    db.add(teacher)
    db.flush()

    db.add(
        StaffProfile(
            school_id=school.id,
            user_id=teacher.id,
            staff_number="DEMO-T1",
            department="Demo Department",
            is_demo=True,
        )
    )

    school_class = SchoolClass(
        school_id=school.id,
        name="Demo Class 7A",
        grade_level="Grade 7",
        homeroom_teacher_id=teacher.id,
        is_demo=True,
    )
    db.add(school_class)
    db.flush()

    for i, (first, last, gender) in enumerate(_STUDENTS, start=1):
        db.add(
            Student(
                school_id=school.id,
                class_id=school_class.id,
                admission_number=f"DEMO-{i:03d}",
                first_name=first,
                last_name=last,
                gender=gender,
                guardian_name=f"{last} Family",
                guardian_phone="+254700000000",
                guardian_email=f"demo.guardian.{i}@ischool.demo",
                is_demo=True,
            )
        )

    db.commit()
    return {
        "classes": 1,
        "students": len(_STUDENTS),
        "staff": 1,
        "teacher_login": {"email": teacher_email, "password": DEMO_PASSWORD},
    }


def delete_demo_data(db: Session, school_id: int) -> dict:
    from app.seed.run import remove_school_sample

    removed = remove_school_sample(db, school_id)["removed"]
    counts = _legacy_delete_demo_data(db, school_id)
    counts["sample_rows"] = removed
    return counts


def _legacy_delete_demo_data(db: Session, school_id: int) -> dict:
    counts = {
        "students": db.query(Student).filter_by(school_id=school_id, is_demo=True).delete(),
        "classes": db.query(SchoolClass).filter_by(school_id=school_id, is_demo=True).delete(),
        "staff": db.query(StaffProfile).filter_by(school_id=school_id, is_demo=True).delete(),
        "users": db.query(User).filter_by(school_id=school_id, is_demo=True).delete(),
    }
    db.commit()
    return counts
