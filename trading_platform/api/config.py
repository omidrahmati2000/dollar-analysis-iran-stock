"""
Application Configuration
"""
import os
from typing import Dict, Any


class Config:
    """Application configuration"""
    
    # Database configuration
    DATABASE_CONFIG: Dict[str, Any] = {
        'host': os.getenv('DB_HOST', '127.0.0.1'),
        'port': int(os.getenv('DB_PORT', 5432)),
        'database': os.getenv('DB_NAME', 'iran_market_data'),
        'user': os.getenv('DB_USER', 'postgres'),
        'password': os.getenv('DB_PASSWORD', 'postgres123')
    }
    
    # API configuration
    API_TITLE = "Iran Market Trading API"
    API_VERSION = "2.0.0"
    API_DESCRIPTION = """
    Professional REST API for Iranian stock market and currency data.
    
    ## Features
    - Real-time stock market data
    - Currency exchange rates
    - Technical indicators calculation
    - Market analysis and summaries
    - Advanced search and filtering
    
    ## Architecture
    - **Repository Layer**: Database access and queries
    - **Service Layer**: Business logic and calculations
    - **API Layer**: RESTful endpoints with validation
    """
    
    # CORS configuration
    CORS_ORIGINS = ["*"]
    CORS_ALLOW_CREDENTIALS = True
    CORS_ALLOW_METHODS = ["*"]
    CORS_ALLOW_HEADERS = ["*"]
    
    # Cache configuration
    CACHE_TTL = 60  # seconds
    
    # Pagination defaults
    DEFAULT_PAGE_SIZE = 50
    MAX_PAGE_SIZE = 200
    
    # Technical indicators
    DEFAULT_INDICATORS = ["SMA_20", "EMA_12", "RSI_14", "MACD", "BB_20"]
    
    # Market hours (Tehran time)
    MARKET_OPEN_HOUR = 9
    MARKET_CLOSE_HOUR = 15
    MARKET_CLOSE_MINUTE = 30


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    TESTING = False


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    TESTING = False
    
    # Override with production database
    DATABASE_CONFIG = {
        'host': os.getenv('DB_HOST', '127.0.0.1'),
        'port': int(os.getenv('DB_PORT', 5432)),
        'database': os.getenv('DB_NAME', 'iran_market_data'),
        'user': os.getenv('DB_USER', 'postgres'),
        'password': os.getenv('DB_PASSWORD')
    }


class TestingConfig(Config):
    """Testing configuration"""
    DEBUG = True
    TESTING = True
    
    # Use test database
    DATABASE_CONFIG = {
        'host': '127.0.0.1',
        'port': 5432,
        'database': 'iran_market_test',
        'user': 'postgres',
        'password': 'postgres123'
    }


def get_config(env: str = None) -> Config:
    """Get configuration based on environment"""
    
    if env is None:
        env = os.getenv('APP_ENV', 'development')
    
    configs = {
        'development': DevelopmentConfig,
        'production': ProductionConfig,
        'testing': TestingConfig
    }
    
    return configs.get(env.lower(), DevelopmentConfig)()