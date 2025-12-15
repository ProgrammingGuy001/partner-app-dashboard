from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from db.session import Base

class IPUser(Base):
    __tablename__='ip_user'
    
    id:Mapped[int]=mapped_column(Integer,primary_key=True,index=True)
    phone_number:Mapped[str]=mapped_column(String,unique=True,index=True,nullable=False)
    first_name:Mapped[str]=mapped_column(String,nullable=False)
    last_name:Mapped[str]=mapped_column(String,nullable=False)
    is_verified:Mapped[bool]=mapped_column(Boolean,default=False)
    is_idverified:Mapped[bool]=mapped_column('is_id_verified', Boolean,default=False)
    is_assigned:Mapped[bool]=mapped_column(Boolean,default=False)