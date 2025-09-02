"""
Configuration management for Iran Market Data Fetcher
Enhanced version with better structure and API URL management
"""
import os
from dotenv import load_dotenv
from typing import Dict

# Load environment variables
load_dotenv()


class Config:
    """Configuration class for database and API settings"""
    
    def __init__(self):
        # Database Configuration
        self.DB_HOST = os.getenv('DB_HOST', 'localhost')
        self.DB_PORT = int(os.getenv('DB_PORT', 5432))
        self.DB_NAME = os.getenv('DB_NAME', 'iran_market_data')
        self.DB_USER = os.getenv('DB_USER', 'postgres')
        self.DB_PASSWORD = os.getenv('DB_PASSWORD', 'postgres123')
        
        # API Configuration - IMPORTANT: Set these in environment variables or .env file
        self.BRSAPI_FREE_KEY = os.getenv('BRSAPI_FREE_KEY', '')  # Set your API key in .env file
        self.BRSAPI_PRO_KEY = os.getenv('BRSAPI_PRO_KEY', '')   # Set your API key in .env file
        self.API_BATCH_SIZE = int(os.getenv('API_BATCH_SIZE', 10))
        self.API_DELAY_SECONDS = float(os.getenv('API_DELAY_SECONDS', 1))
        self.MAX_RETRIES = int(os.getenv('MAX_RETRIES', 3))
    
    @property
    def database_url(self):
        """Get database connection URL"""
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    def get_api_urls(self) -> Dict[str, str]:
        """Get API endpoint URLs with proper purposes (matches iran_market_platform structure)"""
        return {
            "tsetmc_all_symbols": os.getenv('STOCKS_API_URL', 'https://BrsApi.ir/Api/Tsetmc/AllSymbols.php'),  # Get all symbols
            "tsetmc_candlestick": os.getenv('CANDLESTICK_API_URL', 'https://BrsApi.ir/Api/Tsetmc/Candlestick.php'),  # History candle of each symbol
            "currency": os.getenv('CURRENCY_LIST_API_URL', 'https://BrsApi.ir/Api/Market/Gold_Currency.php'),  # Get all list of available currencies
            "currency_pro": os.getenv('CURRENCY_HISTORY_API_URL', 'https://BrsApi.ir/Api/Market/Gold_Currency_Pro.php')  # Get history of each currency
        }
    
    @property
    def request_headers(self) -> Dict[str, str]:
        """Get HTTP request headers"""
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache"
        }