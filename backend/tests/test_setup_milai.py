from app.models.grade_level import SchoolEnabledGrade
from app.models.module import SchoolModule
from app.models.school import School
from app.models.supervisor_link import SupervisorSchoolLink
from app.models.user import User, UserRole
import setup_milai


def test_the_four_campuses_are_created_once_with_their_levels_and_a_linked_principal(db_session):
    setup_milai.run(db_session)
    setup_milai.run(db_session)   # safe to run twice

    schools = {s.slug: s for s in db_session.query(School).filter(School.slug.like("milai-%"))}
    assert set(schools) == {"milai-north", "milai-east", "milai-west", "milai-elgon-view"}
    grades = {slug: db_session.query(SchoolEnabledGrade).filter_by(school_id=s.id).count() for slug, s in schools.items()}
    assert grades == {"milai-north": 11, "milai-east": 11, "milai-west": 14, "milai-elgon-view": 5}

    def on(slug, key):
        return db_session.query(SchoolModule).filter_by(school_id=schools[slug].id, module_key=key).first().enabled

    assert on("milai-north", "boarding") and on("milai-west", "boarding")
    assert not on("milai-east", "boarding") and not on("milai-elgon-view", "boarding")
    assert db_session.query(User).filter_by(role=UserRole.HEAD_OF_INSTITUTION).filter(User.school_id.in_([s.id for s in schools.values()])).count() == 4
    principal = db_session.query(User).filter_by(email="peter.wanyama@milai.com").one()
    assert db_session.query(SupervisorSchoolLink).filter_by(supervisor_user_id=principal.id).count() == 4
