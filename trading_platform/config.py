"""
Configuration for Trading Platform
"""

import os
from pathlib import Path
from pydantic import BaseSettings

class AppConfig(BaseSettings):
    """Application configuration"""
    
    # Database settings
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str = "iran_market_data"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "postgres")
    
    # API settings - IMPORTANT: Set these in environment variables or .env file
    BRSAPI_FREE_KEY: str = ""  # Set your API key in .env file
    BRSAPI_PRO_KEY: str = ""   # Set your API key in .env file
    API_BATCH_SIZE: int = 10
    API_DELAY_SECONDS: float = 1.0
    MAX_RETRIES: int = 3
    
    # Application settings
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"
    
    # UI settings
    WINDOW_WIDTH: int = 1400
    WINDOW_HEIGHT: int = 900
    THEME: str = "dark"
    
    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'

# Global config instance
config = AppConfig()