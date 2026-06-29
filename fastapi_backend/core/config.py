import os
# pyrefly: ignore [missing-import]
from pydantic_settings import BaseSettings
from typing import List

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_file_path = os.path.join(base_dir, ".env")


class Settings(BaseSettings):
    PORT: int = 8000
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "info"

    DATABASE_URL: str = "sqlite+aiosqlite:///./finscreen.db"

    JWT_ACCESS_SECRET: str = "finescreen-access-secret-key-12345!"
    JWT_REFRESH_SECRET: str = "finescreen-refresh-secret-key-67890!"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    FINEDGE_API_KEY_1: str = "demo-key-1"
    FINEDGE_API_KEY_2: str = "demo-key-2"
    FINEDGE_API_KEY_3: str = "demo-key-3"
    FINEDGE_BASE_URL: str = "https://data.finedgeapi.com"

    PAYU_MERCHANT_KEY: str = "GTK42i"
    PAYU_MERCHANT_SALT: str = "eCwWELSp"

    FRONTEND_URL: str = "http://localhost:3000"

    @property
    def FINEDGE_API_KEYS(self) -> List[str]:
        return [self.FINEDGE_API_KEY_1, self.FINEDGE_API_KEY_2, self.FINEDGE_API_KEY_3]

    @property
    def PAYU_CHECKOUT_URL(self) -> str:
        if self.ENVIRONMENT == "production":
            return "https://secure.payu.in/_payment"
        return "https://sandboxsecure.payu.in/_payment"

    class Config:
        env_file = env_file_path
        extra = "ignore"


settings = Settings()
