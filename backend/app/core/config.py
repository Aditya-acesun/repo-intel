from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    QDRANT_URL: str
    QDRANT_API_KEY: str
    HF_TOKEN: str
    GITHUB_TOKEN: str
    GROQ_API_KEY: str
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440  # 24 hours

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()