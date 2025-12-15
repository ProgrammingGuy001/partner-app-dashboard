from pydantic import BaseModel,EmailStr


class UserBase(BaseModel):
    email:EmailStr
    isActive:bool=True
    isApproved:bool=False

class UserCreate(UserBase):
    password:str
class UserResponse(UserBase):
    id:int
    class Config:
        from_attributes = True