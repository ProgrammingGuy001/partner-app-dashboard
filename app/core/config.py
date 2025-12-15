from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Modula Admin Dashboard"
    DATABASE_URL: str|None=None
    SECRET_KEY: str|None=None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  

    class Config:
        env_file = ".env"

settings = Settings()
