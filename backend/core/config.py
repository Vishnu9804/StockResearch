import os
from pydantic_settings import BaseSettings
from typing import List

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_file_path = os.path.join(base_dir, ".env")

class Settings(BaseSettings):
    PORT: int = 8000
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "info"
    
    SUPABASE_URL: str = "https://csejxkjmxdqmemfurkgn.supabase.co"
    SUPABASE_JWT_SECRET: str = "4q2S/EDA+MpZMYwt3x9T9J8NKwz5a1/jRBJR+PALYi4Lf6e2gtVKjv5CJz7DZjpCwUil954FSU6sGdZI1bzB3Q=="
    # Add the Anon Key so the backend can securely pass the firewall
    SUPABASE_ANON_KEY: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzZWp4a2pteGRxbWVtZnVya2duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NDIxMjIsImV4cCI6MjA5ODQxODEyMn0.ouY8pWXsaoCVW7pBhivvysPrpk-TsOIBK2Ac9wnO_AA"
    
    FINEDGE_API_KEY_1: str = "demo-key-1"
    FINEDGE_API_KEY_2: str = "demo-key-2"
    FINEDGE_API_KEY_3: str = "demo-key-3"
    FINEDGE_BASE_URL: str = "https://data.finedgeapi.com"
    FRONTEND_URL: str = "http://localhost:3000"

    @property
    def FINEDGE_API_KEYS(self) -> List[str]:
        return [self.FINEDGE_API_KEY_1, self.FINEDGE_API_KEY_2, self.FINEDGE_API_KEY_3]

    class Config:
        env_file = env_file_path
        extra = "ignore"

settings = Settings()