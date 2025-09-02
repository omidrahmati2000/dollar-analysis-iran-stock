"""
Web Platform Configuration
"""

from pydantic import BaseSettings
import os

class WebPlatformConfig(BaseSettings):
    """Web platform configuration settings"""
    
    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    DEBUG: bool = True
    
    # Database settings
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "iran_market_data"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres123"
    
    # Security settings - IMPORTANT: Set this in environment variables
    SECRET_KEY: str = os.getenv("SECRET_KEY", "CHANGE-THIS-IN-PRODUCTION")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS settings
    ALLOWED_ORIGINS: list = [
        "http://localhost:3000",
        "http://localhost:3001", 
        "http://127.0.0.1:3000"
    ]
    
    # Redis settings (for future use)
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    
    class Config:
        env_file = ".env"

# Create global config instance
config = WebPlatformConfig()