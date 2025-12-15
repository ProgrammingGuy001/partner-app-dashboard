from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from core.config import settings

# Create engine
# Set connect_args based on database type
if "sqlite" in settings.DATABASE_URL:
    connect_args = {"check_same_thread": False}
elif "postgresql" in settings.DATABASE_URL:
    connect_args = {"options": "-csearch_path=public"}
else:
    connect_args = {}

engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, pool_recycle=3600)

# Bind session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Define Base
Base = declarative_base()

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
