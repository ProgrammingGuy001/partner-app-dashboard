from pydantic import BaseModel, Field, validator
from typing import Optional
from datetime import datetime



def normalize_phone_number(value: str) -> str:
    if any(char not in '0123456789 +()-\t\r\n' for char in value):
        raise ValueError('Enter a mobile number using digits, with an optional +91 country code')
    digits = ''.join(char for char in value if char in '0123456789')
    # A ten-digit number may itself start with 91; only strip a full country code.
    if len(digits) == 12 and digits.startswith('91'):
        digits = digits[2:]
    if len(digits) != 10 or digits[0] not in '6789':
        raise ValueError('Enter a valid 10-digit Indian mobile number, with or without +91')
    return '91' + digits


class UserRegistration(BaseModel):
    phone_number: str = Field(..., description="phone_number number with or without country code")
    first_name: str = Field(..., min_length=2, max_length=100)
    last_name: str = Field(..., min_length=2, max_length=100)
    city: str = Field(..., min_length=2, max_length=100)
    pincode: str = Field(..., pattern=r'^\d{6}$')
    is_internal: bool = False

    @validator('phone_number')
    def validate_phone_number(cls, v):
        return normalize_phone_number(v)


class LoginRequest(BaseModel):
    phone_number: str

    @validator('phone_number')
    def validate_phone_number(cls, v):
        return normalize_phone_number(v)


class OTPVerification(BaseModel):
    phone_number: str
    otp: str = Field(..., min_length=6, max_length=6, pattern=r'^\d{6}$')

    @validator('phone_number')
    def validate_phone_number(cls, v):
        return normalize_phone_number(v)


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., min_length=32)


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


class VerificationStatusResponse(UserDetailResponse):
    id_document_uploaded: bool = False


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
