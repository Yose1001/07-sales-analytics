from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://sales:salespass@localhost:5434/salesdb"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret: str = "dev-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24
    upload_dir: str = "./uploads"


settings = Settings()
