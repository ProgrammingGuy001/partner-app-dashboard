from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MediaDocument(Base):
    __tablename__ = "media_documents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    owner_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="uploaded")
    doc_link: Mapped[str] = mapped_column(String(1024), nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    uploaded_by_admin_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("admin.id"), nullable=True, index=True
    )
