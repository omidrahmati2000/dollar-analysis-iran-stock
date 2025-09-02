"""
Market data service - Orchestrates data fetching and processing
Refactored business logic from batch_processor.py following clean architecture
"""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

from ..data_providers.factory import data_provider_factory
from ..config.manager import config_manager
from .database_service import DatabaseService


class MarketDataService:
    """
    Service for orchestrating market data operations
    Follows Single Responsibility Principle - only handles data coordination
    """
    
    def __init__(self, database_service: DatabaseService = None):
        self.logger = logging.getLogger("service.market_data")
        self.config = config_manager.settings
        self.db_service = database_service or DatabaseService()
        self.lock = threading.Lock()
        
        # Initialize data providers
        self.tsetmc_provider = data_provider_factory.get_provider("tsetmc")
        self.currency_provider = data_provider_factory.get_provider("currency")
    
    def fetch_all_stock_symbols(self, symbol_type: int = 1) -> List[Dict[str, Any]]:
        """
        Fetch all stock symbols with their current market data
        
        Args:
            symbol_type: Type of symbols to fetch (1=Stocks+ETF+Rights)
            
        Returns:
            List of symbol data dictionaries
        """
        try:
            self.logger.info(f"Fetching all stock symbols (type={symbol_type})")
            
            symbols = self.tsetmc_provider.get_all_symbols(symbol_type)
            
            if not symbols:
                self.logger.warning("No symbols fetched from TSETMC")
                return []
            
            self.logger.info(f"Successfully fetched {len(symbols)} stock symbols")
            return symbols
            
        except Exception as e:
            self.logger.error(f"Failed to fetch stock symbols: {e}")
            raise
    
    def fetch_candlestick_data(
        self,
        symbol: str,
        timeframe: str = "1D",
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Fetch candlestick data for a specific symbol
        
        Args:
            symbol: Symbol name
            timeframe: Time frame for candles
            limit: Maximum number of candles
            
        Returns:
            List of OHLCV data
        """
        try:
            self.logger.debug(f"Fetching candlestick data for {symbol}")
            
            candles = self.tsetmc_provider.get_candlestick_data(
                symbol, timeframe, limit
            )
            
            self.logger.debug(f"Fetched {len(candles)} candles for {symbol}")
            return candles
            
        except Exception as e:
            self.logger.error(f"Failed to fetch candlestick data for {symbol}: {e}")
            return []
    
    def fetch_currency_rates(self, use_pro: bool = False) -> List[Dict[str, Any]]:
        """
        Fetch current currency and commodity rates
        
        Args:
            use_pro: Whether to use pro API endpoint
            
        Returns:
            List of currency rate dictionaries
        """
        try:
            self.logger.info(f"Fetching currency rates (pro={use_pro})")
            
            rates = self.currency_provider.get_currency_rates(use_pro)
            
            self.logger.info(f"Successfully fetched {len(rates)} currency rates")
            return rates
            
        except Exception as e:
            self.logger.error(f"Failed to fetch currency rates: {e}")
            raise
    
    def process_and_store_symbols(self, symbols: List[Dict[str, Any]]) -> Dict[str, int]:
        """
        Process and store symbol data in database
        
        Args:
            symbols: List of symbol data
            
        Returns:
            Dictionary with processing statistics
        """
        stats = {"success": 0, "errors": 0, "skipped": 0}
        
        try:
            for symbol_data in symbols:
                try:
                    # Store symbol information
                    symbol_id = self.db_service.store_stock_symbol(symbol_data)
                    
                    if symbol_id:
                        # Store price data
                        self.db_service.store_stock_price(symbol_id, symbol_data)
                        
                        # Store order book data
                        self.db_service.store_order_book(symbol_id, symbol_data)
                        
                        stats["success"] += 1
                    else:
                        stats["skipped"] += 1
                        
                except Exception as e:
                    stats["errors"] += 1
                    symbol_name = symbol_data.get('l18', 'unknown')
                    self.logger.error(f"Error processing symbol {symbol_name}: {e}")
            
            self.logger.info(f"Symbol processing completed: {stats}")
            return stats
            
        except Exception as e:
            self.logger.error(f"Failed to process symbols: {e}")
            raise
    
    def process_and_store_candlestick_data(
        self,
        symbols: List[Dict[str, Any]],
        timeframe: str = "1D",
        max_workers: int = None
    ) -> Dict[str, int]:
        """
        Process and store candlestick data for multiple symbols
        
        Args:
            symbols: List of symbols to process
            timeframe: Timeframe for candlestick data
            max_workers: Maximum number of concurrent workers
            
        Returns:
            Dictionary with processing statistics
        """
        stats = {"success": 0, "errors": 0, "skipped": 0}
        max_workers = max_workers or self.config.api.batch_size
        
        try:
            if max_workers == 1:
                # Sequential processing
                for symbol_data in symbols:
                    result = self._process_single_candlestick(symbol_data, timeframe)
                    stats[result] += 1
            else:
                # Parallel processing
                with ThreadPoolExecutor(max_workers=max_workers) as executor:
                    # Submit all tasks
                    futures = {
                        executor.submit(self._process_single_candlestick, symbol_data, timeframe): symbol_data
                        for symbol_data in symbols
                    }
                    
                    # Collect results
                    for future in as_completed(futures):
                        try:
                            result = future.result()
                            stats[result] += 1
                        except Exception as e:
                            stats["errors"] += 1
                            symbol_data = futures[future]
                            symbol_name = symbol_data.get('l18', 'unknown')
                            self.logger.error(f"Error processing candlesticks for {symbol_name}: {e}")
            
            self.logger.info(f"Candlestick processing completed: {stats}")
            return stats
            
        except Exception as e:
            self.logger.error(f"Failed to process candlestick data: {e}")
            raise
    
    def _process_single_candlestick(self, symbol_data: Dict[str, Any], timeframe: str) -> str:
        """
        Process candlestick data for a single symbol
        
        Args:
            symbol_data: Symbol information
            timeframe: Timeframe for data
            
        Returns:
            Processing result ('success', 'errors', 'skipped')
        """
        symbol_name = symbol_data.get('l18')
        
        if not symbol_name:
            return "skipped"
        
        try:
            # Fetch candlestick data
            candles = self.fetch_candlestick_data(symbol_name, timeframe)
            
            if not candles:
                return "skipped"
            
            # Store candlestick data
            symbol_id = symbol_data.get('id') or symbol_data.get('l18')
            stored_count = self.db_service.store_candlestick_data(symbol_id, candles)
            
            if stored_count > 0:
                return "success"
            else:
                return "skipped"
                
        except Exception as e:
            self.logger.error(f"Error processing candlesticks for {symbol_name}: {e}")
            return "errors"
    
    def process_and_store_currencies(self) -> Dict[str, int]:
        """
        Process and store currency data
        
        Returns:
            Dictionary with processing statistics
        """
        stats = {"success": 0, "errors": 0, "skipped": 0}
        
        try:
            # Fetch currency data
            currencies = self.fetch_currency_rates(use_pro=True)
            
            for currency_data in currencies:
                try:
                    stored = self.db_service.store_currency_data(currency_data)
                    
                    if stored:
                        stats["success"] += 1
                    else:
                        stats["skipped"] += 1
                        
                except Exception as e:
                    stats["errors"] += 1
                    currency_name = currency_data.get('name', 'unknown')
                    self.logger.error(f"Error processing currency {currency_name}: {e}")
            
            self.logger.info(f"Currency processing completed: {stats}")
            return stats
            
        except Exception as e:
            self.logger.error(f"Failed to process currencies: {e}")
            raise
    
    def get_symbol_info(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a symbol
        
        Args:
            symbol: Symbol name
            
        Returns:
            Symbol information or None if not found
        """
        try:
            return self.tsetmc_provider.get_symbol_info(symbol)
        except Exception as e:
            self.logger.error(f"Failed to get symbol info for {symbol}: {e}")
            return None
    
    def search_symbols(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Search for symbols by name or code
        
        Args:
            query: Search query
            limit: Maximum results
            
        Returns:
            List of matching symbols
        """
        try:
            return self.tsetmc_provider.search_symbols(query, limit)
        except Exception as e:
            self.logger.error(f"Failed to search symbols with query '{query}': {e}")
            return []
    
    def get_currency_by_code(self, code: str) -> Optional[Dict[str, Any]]:
        """
        Get specific currency information
        
        Args:
            code: Currency code
            
        Returns:
            Currency information or None if not found
        """
        try:
            return self.currency_provider.get_specific_currency(code)
        except Exception as e:
            self.logger.error(f"Failed to get currency {code}: {e}")
            return None
    
    def get_market_summary(self) -> Dict[str, Any]:
        """
        Get market summary statistics
        
        Returns:
            Market summary dictionary
        """
        try:
            summary = {
                "timestamp": datetime.now(),
                "providers_health": data_provider_factory.health_check_all(),
                "database_stats": self.db_service.get_database_stats()
            }
            
            return summary
            
        except Exception as e:
            self.logger.error(f"Failed to get market summary: {e}")
            return {"error": str(e)}