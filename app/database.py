from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings


# Database engine with connection pooling for better performance
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=10,           # Number of connections to keep in the pool
    max_overflow=20,        # Max additional connections when pool is exhausted
    pool_pre_ping=True,     # Check connection validity before using
    pool_recycle=3600,      # Recycle connections after 1 hour
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
