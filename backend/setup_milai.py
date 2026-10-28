"""One-off setup for the real Milai campuses.

Run inside the backend container:  python setup_milai.py
It uses the same code as the super-admin panel, so each campus gets its module switches, chart of accounts and
first head of institution exactly as if you had created it by hand. Safe to run twice: anything already there is skipped.

These are sample names (Kalenjin, Luhya and Luo) so the platform feels local. Replace them with the real people when known. A head or principal can be
replaced later from the super-admin panel, and every account must change its password at first sign-in.
"""

from app.core.database import SessionLocal
from app.models.grade_level import GradeLevel, SchoolEnabledGrade
from app.models.module import SchoolModule
from app.models.school import School
from app.models.user import User, UserRole
from app.routers.schools import onboard_school
from app.routers.supervisors import create_supervisor, link_school
from app.schemas.school import SchoolCreate
from app.schemas.supervisor import SupervisorCreate, SupervisorLinkCreate

TEMP_PASSWORD = "Milai@2026#"   # everyone must change it at first sign-in

PP = ["PP1", "PP2"]
PRIMARY = ["G1", "G2", "G3", "G4", "G5", "G6"]
JUNIOR = ["G7", "G8", "G9"]
SENIOR = ["G10", "G11", "G12"]

# name, slug, head email, head name, grades, boarding, has junior/senior section
CAMPUSES = [
    ("Milai School North", "milai-north", "beatrice.rotich@milai.com", "Beatrice Jepkoech Rotich", PP + PRIMARY + JUNIOR, True, True),
    ("Milai School East", "milai-east", "samuel.barasa@milai.com", "Samuel Wekesa Barasa", PP + PRIMARY + JUNIOR, False, True),
    ("Milai School West", "milai-west", "grace.odhiambo@milai.com", "Grace Atieno Odhiambo", PP + PRIMARY + JUNIOR + SENIOR, True, True),
    ("Milai School Elgon View", "milai-elgon-view", "joyce.koech@milai.com", "Joyce Chepkemoi Koech", PP + ["G1", "G2", "G3"], False, False),
]

PRINCIPAL = ("peter.wanyama@milai.com", "Peter Simiyu Wanyama")


def run(db) -> list[str]:
    report: list[str] = []
    schools: list[School] = []
    for name, slug, head_email, head_name, grades, boarding, upper in CAMPUSES:
        school = db.query(School).filter_by(slug=slug).first()
        if school is None:
            school = onboard_school(
                SchoolCreate(name=name, slug=slug, admin_email=head_email, admin_full_name=head_name, admin_password=TEMP_PASSWORD),
                db,
            )
            report.append(f"created {name}  (head: {head_email})")
        else:
            report.append(f"already there: {name}")
        schools.append(school)

        # The levels this campus really teaches.
        wanted = {g.id for g in db.query(GradeLevel).filter(GradeLevel.code.in_(grades))}
        db.query(SchoolEnabledGrade).filter_by(school_id=school.id).delete()
        for gid in wanted:
            db.add(SchoolEnabledGrade(school_id=school.id, grade_level_id=gid))

        # Day or boarding, and which sections exist.
        switches = {"boarding": boarding, "secondary_section": upper, "college_section": False, "pre_primary": True, "primary_section": True}
        for key, on in switches.items():
            row = db.query(SchoolModule).filter_by(school_id=school.id, module_key=key).first()
            if row is not None:
                row.enabled = on
        db.commit()

    principal = db.query(User).filter_by(email=PRINCIPAL[0]).first()
    if principal is None:
        created = create_supervisor(SupervisorCreate(email=PRINCIPAL[0], full_name=PRINCIPAL[1], password=TEMP_PASSWORD), db)
        principal_id = created.id
        report.append(f"created principal {PRINCIPAL[0]}")
    else:
        principal_id = principal.id
        report.append(f"already there: principal {PRINCIPAL[0]}")
    for school in schools:
        link_school(principal_id, SupervisorLinkCreate(school_id=school.id), db)
    report.append("principal linked to all four campuses")
    return report


def main() -> None:
    db = SessionLocal()
    try:
        for line in run(db):
            print(line)
        print(f"\nTemporary password for every account above: {TEMP_PASSWORD}  (each person must change it at first sign-in)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
