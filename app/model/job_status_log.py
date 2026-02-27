from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, synonym
from datetime import datetime
from app.database import Base


class JobStatusLog(Base):
    __tablename__ = "job_status_logs"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(Integer, ForeignKey("jobs.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=True)

    # Backward-compat alias for existing response schema.
    timestamp = synonym("created_at")
