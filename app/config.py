from pydantic_settings import BaseSettings
from typing import Optional, List


class Settings(BaseSettings):
    # Environment
    ENVIRONMENT: str = "development"  # "development", "staging", "production"
    
    # Database
    DB_HOST: str
    DB_NAME: str
    DB_USER: str
    DB_PASS: str
    DATABASE_URL: str
    
    # Project
    PROJECT_NAME: str = "Modula Admin Dashboard"
    
    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # AWS
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
    
    # Trusted Proxy Hosts (comma-separated in .env)
    TRUSTED_PROXY_HOSTS: str = "127.0.0.1"
    
    # File Upload Settings
    MAX_UPLOAD_SIZE_MB: int = 10
    ALLOWED_FILE_EXTENSIONS: str = ".jpg,.jpeg,.png,.pdf,.doc,.docx"
    
    # Odoo Settings
    ODOO_URL: str
    ODOO_DB: str
    ODOO_USERNAME: str
    ODOO_PASSWORD: str
    
    @property
    def trusted_hosts_list(self) -> List[str]:
        return [h.strip() for h in self.TRUSTED_PROXY_HOSTS.split(",")]
    
    @property
    def allowed_extensions_list(self) -> List[str]:
        return [e.strip().lower() for e in self.ALLOWED_FILE_EXTENSIONS.split(",")]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()