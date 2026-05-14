from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://soc_user:soc_pass@localhost:5432/soc_db"
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ANTHROPIC_API_KEY: str = ""
    UPLOAD_DIR: str = "uploads"
    FRONTEND_URL: str = ""

    def get_database_url(self) -> str:
        url = self.DATABASE_URL
        # Railway provides postgresql:// but SQLAlchemy needs postgresql+psycopg2://
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
        return url

    class Config:
        env_file = ".env"

settings = Settings()
