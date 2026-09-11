"""One-off bootstrap: create the first super-admin account.

Usage: python create_superadmin.py <email> <password> <full name>
"""

import sys

from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models.user import User, UserRole


def main():
    if len(sys.argv) < 4:
        print(__doc__)
        sys.exit(1)

    email, password, full_name = sys.argv[1], sys.argv[2], " ".join(sys.argv[3:])

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).filter_by(email=email).first():
            print(f"A user with email {email} already exists.")
            sys.exit(1)

        db.add(
            User(
                email=email,
                full_name=full_name,
                hashed_password=hash_password(password),
                role=UserRole.SUPER_ADMIN,
                school_id=None,
            )
        )
        db.commit()
        print(f"Super-admin '{email}' created.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
