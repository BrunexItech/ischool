"""iSchool's own billing relationship with a school (separate from the
fees a school charges its own parents) — a suspended subscription blocks
login for that school's users, but never for super-admin."""

from app.models.school import SubscriptionStatus
from tests.conftest import auth_headers


def test_suspended_school_blocks_login(client, db_session, school):
    from app.core.security import hash_password
    from app.models.user import User, UserRole

    user_email = "admin@test-academy.test"

    user = User(
        school_id=school.id, email=user_email, full_name="Admin",
        hashed_password=hash_password("TestPass123!"), role=UserRole.SCHOOL_ADMIN,
    )
    db_session.add(user)
    db_session.commit()

    ok = client.post("/auth/login", data={"username": user_email, "password": "TestPass123!"})
    assert ok.status_code == 200

    school.subscription_status = SubscriptionStatus.SUSPENDED
    db_session.commit()

    blocked = client.post("/auth/login", data={"username": user_email, "password": "TestPass123!"})
    assert blocked.status_code == 402


def test_super_admin_login_unaffected_by_any_schools_suspension(client, db_session, school, super_admin_token):
    school.subscription_status = SubscriptionStatus.SUSPENDED
    db_session.commit()

    response = client.get("/schools", headers=auth_headers(super_admin_token))
    assert response.status_code == 200


def test_only_super_admin_can_change_a_schools_subscription(client, school_admin_token, school):
    response = client.patch(
        f"/schools/{school.id}/subscription",
        headers=auth_headers(school_admin_token),
        json={"subscription_status": "active"},
    )
    assert response.status_code == 403
