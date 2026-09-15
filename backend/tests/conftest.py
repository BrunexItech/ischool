"""Runs the whole suite against a dedicated `ischool_test` database (never
the dev DB) so tests can freely create/destroy data. Each test gets its own
DB transaction that's rolled back afterward — fast, and tests never see
each other's data — via SQLAlchemy's documented external-transaction
pattern (Session bound to a connection with join_transaction_mode set to
create a SAVEPOINT under every commit the app code makes).

Create the test DB once, from inside the Postgres container, before running:
    docker exec ischool-db-1 psql -U ischool -d postgres -c "CREATE DATABASE ischool_test;"
"""

import os
import sys
from pathlib import Path

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql://ischool:ischool@localhost:5434/ischool_test"
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session as SQLASession

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.main import app
from app.models.module import MODULE_KEYS, SchoolModule
from app.models.school import School
from app.models.user import User, UserRole

engine = create_engine(TEST_DATABASE_URL)


@pytest.fixture(scope="session", autouse=True)
def _create_schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    session = SQLASession(bind=connection, join_transaction_mode="create_savepoint")
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def school(db_session):
    """A fresh school with every module enabled, matching what onboarding does."""
    s = School(name="Test Academy", slug="test-academy")
    db_session.add(s)
    db_session.flush()
    for key in MODULE_KEYS:
        db_session.add(SchoolModule(school_id=s.id, module_key=key, enabled=True))
    db_session.commit()
    return s


@pytest.fixture
def other_school(db_session):
    """A second, unrelated school — used to prove tenant isolation."""
    s = School(name="Rival Academy", slug="rival-academy")
    db_session.add(s)
    db_session.flush()
    for key in MODULE_KEYS:
        db_session.add(SchoolModule(school_id=s.id, module_key=key, enabled=True))
    db_session.commit()
    return s


def _make_user(db_session, school, role, email, password="TestPass123!"):
    user = User(
        school_id=school.id if school else None,
        email=email,
        full_name=email.split("@")[0].replace(".", " ").title(),
        hashed_password=hash_password(password),
        role=role,
    )
    db_session.add(user)
    db_session.commit()
    return user, password


def _login(client, email, password):
    response = client.post("/auth/login", data={"username": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


@pytest.fixture
def super_admin_token(client, db_session):
    user, password = _make_user(db_session, None, UserRole.SUPER_ADMIN, "super@ischool.test")
    return _login(client, user.email, password)


@pytest.fixture
def school_admin_token(client, db_session, school):
    user, password = _make_user(db_session, school, UserRole.SCHOOL_ADMIN, "admin@test-academy.test")
    return _login(client, user.email, password)


@pytest.fixture
def other_school_admin_token(client, db_session, other_school):
    user, password = _make_user(db_session, other_school, UserRole.SCHOOL_ADMIN, "admin@rival-academy.test")
    return _login(client, user.email, password)


@pytest.fixture
def teacher_token(client, db_session, school):
    user, password = _make_user(db_session, school, UserRole.TEACHER, "teacher@test-academy.test")
    return _login(client, user.email, password)


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
