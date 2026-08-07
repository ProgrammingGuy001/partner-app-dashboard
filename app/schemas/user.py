from pydantic import BaseModel, EmailStr, Field, field_validator


class UserBase(BaseModel):
    email: EmailStr

    @field_validator("email", mode="before")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        return v.lower() if isinstance(v, str) else v
    isActive:bool=True
    isApproved:bool=False
    is_superadmin:bool=False
    is_dev:bool=False
    name: str | None = None

class UserCreate(UserBase):
    password:str

class UserResponse(UserBase):
    id:int
    class Config:
        from_attributes = True


class UserNameUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
