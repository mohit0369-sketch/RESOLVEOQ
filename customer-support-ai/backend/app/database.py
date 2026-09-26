import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Reads DATABASE_URL from environment (see .env.example).
# Example for Postgres: postgresql://user:password@localhost:5432/support_ai
# If not set, falls back to a local SQLite file so the backend runs with zero setup.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./local_dev.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
