from sqlalchemy import select

from app.database import SessionLocal
from app.models import User
from app.security import hash_password

DEMO_EMAIL = "demo@sales.com"
DEMO_PASSWORD = "demo123"


def main() -> None:
    db = SessionLocal()
    try:
        if db.scalar(select(User).where(User.email == DEMO_EMAIL)) is None:
            db.add(
                User(
                    email=DEMO_EMAIL,
                    password_hash=hash_password(DEMO_PASSWORD),
                    name="Demo User",
                )
            )
            db.commit()
            print(f"seeded demo user: {DEMO_EMAIL}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
