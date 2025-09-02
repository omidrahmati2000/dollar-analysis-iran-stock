"""
TSETMC data provider implementation
Refactored from original api/tsetmc_api.py following clean architecture
"""
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime, timedelta

from .base import BaseDataProvider, DataProviderException


class TSETMCDataProvider(BaseDataProvider):
    """
    TSETMC (Tehran Stock Exchange) data provider
    Inherits common functionality from BaseDataProvider
    """
    
    def __init__(self):
        super().__init__("TSETMC")
    
    def get_base_url(self) -> str:
        """Get TSETMC base URL"""
        return "https://BrsApi.ir/Api/Tsetmc/"
    
    def get_endpoints(self) -> Dict[str, str]:
        """Get available TSETMC endpoints"""
        return {
            "all_symbols": "AllSymbols.php",
            "candlestick": "Candlestick.php",
            "intraday": "Intraday.php",
            "company_info": "CompanyInfo.php"
        }
    
    def _prepare_request_params(self, **kwargs) -> Dict[str, Any]:
        """Prepare TSETMC-specific request parameters"""
        params = {}
        
        # Add API key if provided
        if hasattr(self.config, 'brsapi_free_key') and self.config.brsapi_free_key:
            params['key'] = self.config.brsapi_free_key
        
        # Add other parameters
        params.update(kwargs)
        return params
    
    def _validate_response(self, data: Any) -> bool:
        """Validate TSETMC response format"""
        if not isinstance(data, (list, dict)):
            return False
        
        # For list responses, check if not empty
        if isinstance(data, list):
            return len(data) > 0
        
        # For dict responses, check for common TSETMC fields
        if isinstance(data, dict):
            return 'error' not in data or data.get('error') != 1
        
        return True
    
    def get_all_symbols(self, symbol_type: int = 1) -> List[Dict[str, Any]]:
        """
        Fetch all stock symbols from TSETMC
        
        Args:
            symbol_type: 1=Stocks+ETF+Rights, 2=Commodities, 3=Futures, 4=Bonds, 5=Housing
            
        Returns:
            List of symbol dictionaries with market data
        """
        try:
            self.logger.info(f"Fetching all symbols (type={symbol_type})")
            
            params = {
                'type': symbol_type
            }
            
            data = self._make_request(
                self.get_endpoints()['all_symbols'],
                params
            )
            
            if not data:
                raise DataProviderException("No symbols data received")
            
            self.logger.info(f"Successfully fetched {len(data)} symbols")
            return data
            
        except Exception as e:
            self.logger.error(f"Failed to fetch symbols: {e}")
            raise DataProviderException(f"Failed to fetch symbols: {e}")
    
    def get_candlestick_data(
        self,
        symbol: str,
        timeframe: str = "1D",
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Fetch candlestick data for a symbol
        
        Args:
            symbol: Symbol name (e.g., 'وبملت')
            timeframe: Time frame ('1D', '1W', '1M')
            limit: Maximum number of candles
            
        Returns:
            List of OHLCV data
        """
        try:
            self.logger.debug(f"Fetching candlestick data for {symbol}")
            
            params = {
                'symbol': symbol,
                'timeframe': timeframe,
                'limit': limit
            }
            
            data = self._make_request(
                self.get_endpoints()['candlestick'],
                params
            )
            
            if not data:
                self.logger.warning(f"No candlestick data for {symbol}")
                return []
            
            # Convert to standard OHLCV format
            formatted_data = self._format_candlestick_data(data)
            
            self.logger.debug(f"Successfully fetched {len(formatted_data)} candles for {symbol}")
            return formatted_data
            
        except Exception as e:
            self.logger.error(f"Failed to fetch candlestick data for {symbol}: {e}")
            raise DataProviderException(f"Failed to fetch candlestick data: {e}")
    
    def _format_candlestick_data(self, raw_data: List[Dict]) -> List[Dict[str, Any]]:
        """
        Format raw candlestick data to standard OHLCV format
        
        Args:
            raw_data: Raw data from TSETMC API
            
        Returns:
            Formatted OHLCV data
        """
        formatted = []
        
        for candle in raw_data:
            try:
                formatted_candle = {
                    'timestamp': self._parse_timestamp(candle.get('date', candle.get('d'))),
                    'open': float(candle.get('open', candle.get('o', 0))),
                    'high': float(candle.get('high', candle.get('h', 0))),
                    'low': float(candle.get('low', candle.get('l', 0))),
                    'close': float(candle.get('close', candle.get('c', 0))),
                    'volume': int(candle.get('volume', candle.get('v', 0))),
                    'value': float(candle.get('value', candle.get('val', 0))),
                    'count': int(candle.get('count', candle.get('cnt', 0)))
                }
                
                # Skip invalid candles
                if formatted_candle['open'] > 0 and formatted_candle['close'] > 0:
                    formatted.append(formatted_candle)
                    
            except (ValueError, TypeError) as e:
                self.logger.warning(f"Skipping invalid candle data: {candle}, error: {e}")
                continue
        
        # Sort by timestamp
        formatted.sort(key=lambda x: x['timestamp'])
        return formatted
    
    def _parse_timestamp(self, date_value: Any) -> datetime:
        """
        Parse various timestamp formats from TSETMC
        
        Args:
            date_value: Date value in various formats
            
        Returns:
            Parsed datetime object
        """
        if isinstance(date_value, datetime):
            return date_value
        
        if isinstance(date_value, str):
            # Try different date formats
            formats = [
                '%Y-%m-%d',
                '%Y/%m/%d',
                '%Y%m%d',
                '%Y-%m-%d %H:%M:%S',
                '%Y/%m/%d %H:%M:%S'
            ]
            
            for fmt in formats:
                try:
                    return datetime.strptime(date_value, fmt)
                except ValueError:
                    continue
        
        if isinstance(date_value, (int, float)):
            # Assume Unix timestamp
            try:
                return datetime.fromtimestamp(date_value)
            except (ValueError, OSError):
                # Try milliseconds timestamp
                try:
                    return datetime.fromtimestamp(date_value / 1000)
                except (ValueError, OSError):
                    pass
        
        # Default to current time if parsing fails
        self.logger.warning(f"Could not parse timestamp: {date_value}, using current time")
        return datetime.now()
    
    def get_symbol_info(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a symbol
        
        Args:
            symbol: Symbol name
            
        Returns:
            Symbol information dictionary or None if not found
        """
        try:
            # First, try to find the symbol in all symbols list
            symbols = self.get_all_symbols()
            
            for sym_data in symbols:
                if sym_data.get('l18') == symbol or sym_data.get('symbol') == symbol:
                    return {
                        'symbol': sym_data.get('l18', symbol),
                        'name': sym_data.get('l30'),
                        'isin': sym_data.get('isin'),
                        'sector': sym_data.get('sector'),
                        'market': sym_data.get('market'),
                        'last_price': sym_data.get('pl'),
                        'close_price': sym_data.get('pc'),
                        'volume': sym_data.get('tvol'),
                        'value': sym_data.get('tval'),
                        'count': sym_data.get('tno'),
                        'high': sym_data.get('ph'),
                        'low': sym_data.get('pdl'),
                        'first': sym_data.get('pf'),
                        'yesterday': sym_data.get('py')
                    }
            
            return None
            
        except Exception as e:
            self.logger.error(f"Failed to get symbol info for {symbol}: {e}")
            return None
    
    def search_symbols(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Search for symbols by name or code
        
        Args:
            query: Search query
            limit: Maximum number of results
            
        Returns:
            List of matching symbols
        """
        try:
            all_symbols = self.get_all_symbols()
            query = query.lower()
            
            matches = []
            for symbol in all_symbols:
                symbol_name = str(symbol.get('l18', '')).lower()
                company_name = str(symbol.get('l30', '')).lower()
                
                if (query in symbol_name or query in company_name):
                    matches.append(symbol)
                    if len(matches) >= limit:
                        break
            
            return matches
            
        except Exception as e:
            self.logger.error(f"Failed to search symbols with query '{query}': {e}")
            return []