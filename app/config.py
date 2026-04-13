from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

APP_DIR = Path(__file__).resolve().parent


@lru_cache(maxsize=1)
def get_env_file() -> str:
    """
    Read env.mode file to determine which environment file to load.
    Returns an absolute path to app/.env or app/.env.test based on env.mode content.
    """
    mode_file = APP_DIR / "env.mode"

    def env_path(filename: str) -> str:
        return str((APP_DIR / filename).resolve())

    if not mode_file.exists():
        return env_path(".env.test")

    try:
        content = mode_file.read_text(encoding="utf-8").strip()
        for line in content.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("ENVIRONMENT="):
                mode = line.split("=", 1)[1].strip().lower()
                if mode == "prod":
                    return env_path(".env")
                if mode == "test":
                    return env_path(".env.test")
                break
    except OSError:
        return env_path(".env.test")

    return env_path(".env.test")


class Settings(BaseSettings):
    # Environment
    ENVIRONMENT: str = "test"  # "test" or "prod"
    AUTO_CREATE_TABLES: Optional[bool] = None

    # Database
    DATABASE_URL: str
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 3600

    # Project
    PROJECT_NAME: str = "Modula Admin Dashboard"

    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ADMIN_AUTH_COOKIE_NAME: str = "admin_access_token"
    IP_AUTH_COOKIE_NAME: str = "ip_access_token"
    ADMIN_REFRESH_COOKIE_NAME: str = "admin_refresh_token"
    IP_REFRESH_COOKIE_NAME: str = "ip_refresh_token"
    SERVICE_SECRET_KEY: str

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
    OTP_DEBUG_LOG_ENABLED: bool = False

    # CORS allowed origins (comma-separated in .env)
    CORS_ORIGINS: str = "http://localhost,http://localhost:3000,http://localhost:5174,http://localhost:5173,https://partner.modula.in,https://partner-app-dashboard-navy.vercel.app"

    # Trusted Proxy Hosts (comma-separated in .env)
    TRUSTED_PROXY_HOSTS: str = "127.0.0.1"

    # File Upload Settings
    MAX_UPLOAD_SIZE_MB: int = 10
    ALLOWED_FILE_EXTENSIONS: str = ".jpg,.jpeg,.png,.pdf,.doc,.docx"
    UPLOAD_READ_CHUNK_SIZE: int = 1024 * 1024

    # Odoo Settings (optional - only needed if Odoo integration is used)
    ODOO_URL: Optional[str] = None
    ODOO_DB: Optional[str] = None
    ODOO_USERNAME: Optional[str] = None
    ODOO_PASSWORD: Optional[str] = None
    # Set to "false" to disable SSL verification for Odoo (dev only, never in prod)
    ODOO_SSL_VERIFY: str = "true"
    
    ModulaCare_URL: str 

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if not v or len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long")
        return v

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def trusted_hosts_list(self) -> List[str]:
        return [h.strip() for h in self.TRUSTED_PROXY_HOSTS.split(",")]

    @property
    def allowed_extensions_list(self) -> List[str]:
        return [e.strip().lower() for e in self.ALLOWED_FILE_EXTENSIONS.split(",")]

    @property
    def normalized_environment(self) -> str:
        return self.ENVIRONMENT.strip().lower()

    @property
    def enable_schema_sync(self) -> bool:
        if self.AUTO_CREATE_TABLES is not None:
            return self.AUTO_CREATE_TABLES
        return self.normalized_environment in {"test", "development", "dev", "local"}

    @property
    def is_secure_cookie_environment(self) -> bool:
        return self.normalized_environment in {"production", "prod", "staging"}

    model_config = SettingsConfigDict(
        env_file=get_env_file(),
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
