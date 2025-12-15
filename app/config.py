from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    DB_HOST: str
    DB_NAME: str
    DB_USER: str
    DB_PASS: str
    DATABASE_URL: str

    PROJECT_NAME: str = "Modula Admin Dashboard"
    DATABASE_URL: str|None=None
    SECRET_KEY: str|None=None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    
    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # ✅ Add AWS configs here
    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: str
    AWS_REGION: str
    AWS_S3_BUCKET: str

    # SMS Service
    RML_SMS_USERNAME: str
    RML_SMS_PASSWORD: str
    RML_SMS_SENDER_ID: str
    RML_SMS_ENTITY_ID: str
    RML_SMS_TEMPLATE_ID: str
    
    # Attestr API
    ATTESTR_API_KEY: str
    
    
    
    # OTP Settings
    OTP_EXPIRY_MINUTES: int = 10
    OTP_LENGTH: int = 6
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()