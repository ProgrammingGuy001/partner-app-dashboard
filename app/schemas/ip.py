from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime



class UserRegistration(BaseModel):
    phone_number: str = Field(..., description="phone_number number with or without country code")
    first_name: str = Field(..., min_length=2, max_length=100)
    last_name: str = Field(..., min_length=2, max_length=100)
    city: str = Field(..., min_length=2, max_length=100)
    pincode: str = Field(..., pattern=r'^\d{6}$')
    is_internal: bool = Field(default=False, description="Whether the IP is an internal Modula employee")

    @validator('phone_number')
    def validate_phone_number(cls, v):
        # Remove any non-digit characters
        digits = ''.join(filter(str.isdigit, v))

        # If it starts with 91, ensure it's 12 digits
        if digits.startswith('91'):
            if len(digits) != 12:
                raise ValueError('phone_number number with country code must be 12 digits')
        elif len(digits) == 10:
            digits = '91' + digits
        else:
            raise ValueError('phone_number number must be 10 digits (or 12 with country code)')

        return digits


class LoginRequest(BaseModel):
    phone_number: str

    @validator('phone_number')
    def validate_phone_number(cls, v):
        """Validate and normalize phone number"""
        digits = ''.join(filter(str.isdigit, v))

        if digits.startswith('91'):
            if len(digits) != 12:
                raise ValueError('Phone number with country code must be 12 digits')
        elif len(digits) == 10:
            # Validate Indian mobile number format (starts with 6-9)
            if digits[0] not in '6789':
                raise ValueError('Invalid Indian mobile number')
            digits = '91' + digits
        else:
            raise ValueError('Phone number must be 10 digits (or 12 with country code)')

        return digits


class OTPVerification(BaseModel):
    phone_number: str
    otp: str = Field(..., min_length=6, max_length=6)


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class PANVerification(BaseModel):
    pan: str = Field(..., pattern=r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$')


class BankVerification(BaseModel):
    account_number: str = Field(..., min_length=9, max_length=18)
    ifsc: str = Field(..., pattern=r'^[A-Z]{4}0[A-Z0-9]{6}$')
    fetch_ifsc: bool = False


class UserResponse(BaseModel):
    id: int
    phone_number: str
    first_name: str
    last_name: str
    city: str
    pincode: Optional[int] = None
    is_verified: bool
    is_pan_verified: bool
    is_bank_details_verified: bool
    is_id_verified: bool
    is_internal: bool
    registered_at: datetime

    class Config:
        from_attributes = True


class UserDetailResponse(UserResponse):
    pan_number: Optional[str] = None
    pan_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    account_holder_name: Optional[str] = None
    verified_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        instance = super().model_validate(obj, *args, **kwargs)
        # Mask sensitive fields — full values stay server-side only
        if instance.pan_number:
            instance.pan_number = instance.pan_number[:2] + "XXXXX" + instance.pan_number[-3:]
        if instance.account_number:
            instance.account_number = "XXXX" + instance.account_number[-4:]
        return instance


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class MobileAuthResponse(UserResponse):
    access_token: str
    refresh_token: str


class RefreshTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class ipuser(BaseModel):
    first_name:str
    last_name:str
    phone_number:str
    is_verified:bool

class approveipuser(ipuser):
    is_idverified:bool
