"""
Currency data provider implementation
Refactored from original api/currency_api.py following clean architecture
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

from .base import BaseDataProvider, DataProviderException


class CurrencyDataProvider(BaseDataProvider):
    """
    Currency and commodity data provider
    Provides access to foreign exchange and precious metals data
    """
    
    def __init__(self):
        super().__init__("Currency")
    
    def get_base_url(self) -> str:
        """Get currency API base URL"""
        return "https://BrsApi.ir/Api/Market/"
    
    def get_endpoints(self) -> Dict[str, str]:
        """Get available currency endpoints"""
        return {
            "gold_currency": "Gold_Currency.php",
            "gold_currency_pro": "Gold_Currency_Pro.php",
            "forex": "Forex.php",
            "crypto": "Crypto.php"
        }
    
    def _prepare_request_params(self, **kwargs) -> Dict[str, Any]:
        """Prepare currency-specific request parameters"""
        params = {}
        
        # Add API key if provided
        if hasattr(self.config, 'brsapi_free_key') and self.config.brsapi_free_key:
            params['key'] = self.config.brsapi_free_key
        
        # Add other parameters
        params.update(kwargs)
        return params
    
    def _validate_response(self, data: Any) -> bool:
        """Validate currency response format"""
        if not isinstance(data, (list, dict)):
            return False
        
        # For list responses, check if not empty
        if isinstance(data, list):
            return len(data) > 0
        
        # For dict responses, check for common currency fields
        if isinstance(data, dict):
            return 'error' not in data or data.get('error') != 1
        
        return True
    
    def get_currency_rates(self, use_pro: bool = False) -> List[Dict[str, Any]]:
        """
        Fetch current currency and gold rates
        
        Args:
            use_pro: Whether to use the pro API endpoint (more detailed data)
            
        Returns:
            List of currency/gold rate dictionaries
        """
        try:
            endpoint = "gold_currency_pro" if use_pro else "gold_currency"
            self.logger.info(f"Fetching currency rates (pro={use_pro})")
            
            data = self._make_request(self.get_endpoints()[endpoint])
            
            if not data:
                raise DataProviderException("No currency data received")
            
            # Format the data
            formatted_data = self._format_currency_data(data)
            
            self.logger.info(f"Successfully fetched {len(formatted_data)} currency rates")
            return formatted_data
            
        except Exception as e:
            self.logger.error(f"Failed to fetch currency rates: {e}")
            raise DataProviderException(f"Failed to fetch currency rates: {e}")
    
    def _format_currency_data(self, raw_data: List[Dict]) -> List[Dict[str, Any]]:
        """
        Format raw currency data to standard format
        
        Args:
            raw_data: Raw data from currency API
            
        Returns:
            Formatted currency data
        """
        formatted = []
        
        for item in raw_data:
            try:
                formatted_item = {
                    'name': item.get('name', ''),
                    'name_en': item.get('name_en', ''),
                    'code': item.get('code', ''),
                    'buy_price': self._parse_price(item.get('buy', item.get('buy_price', 0))),
                    'sell_price': self._parse_price(item.get('sell', item.get('sell_price', 0))),
                    'change': self._parse_price(item.get('change', 0)),
                    'change_percent': float(item.get('change_percent', 0)),
                    'high': self._parse_price(item.get('high', 0)),
                    'low': self._parse_price(item.get('low', 0)),
                    'timestamp': self._parse_currency_timestamp(item.get('date', item.get('time'))),
                    'category': self._determine_category(item),
                    'unit': item.get('unit', 'IRR'),
                    'weight': item.get('weight', ''),
                    'purity': item.get('purity', '')
                }
                
                # Calculate mid price
                if formatted_item['buy_price'] and formatted_item['sell_price']:
                    formatted_item['mid_price'] = (
                        formatted_item['buy_price'] + formatted_item['sell_price']
                    ) / 2
                else:
                    formatted_item['mid_price'] = formatted_item['buy_price'] or formatted_item['sell_price']
                
                formatted.append(formatted_item)
                
            except (ValueError, TypeError) as e:
                self.logger.warning(f"Skipping invalid currency data: {item}, error: {e}")
                continue
        
        return formatted
    
    def _parse_price(self, price_value: Any) -> float:
        """
        Parse price value from various formats
        
        Args:
            price_value: Price value in various formats
            
        Returns:
            Parsed float price
        """
        if isinstance(price_value, (int, float)):
            return float(price_value)
        
        if isinstance(price_value, str):
            # Remove common separators and convert
            cleaned = price_value.replace(',', '').replace(' ', '')
            try:
                return float(cleaned)
            except ValueError:
                pass
        
        return 0.0
    
    def _parse_currency_timestamp(self, date_value: Any) -> datetime:
        """
        Parse timestamp from currency data
        
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
                '%Y-%m-%d %H:%M:%S',
                '%Y/%m/%d %H:%M:%S',
                '%Y-%m-%d',
                '%Y/%m/%d',
                '%H:%M:%S'
            ]
            
            for fmt in formats:
                try:
                    return datetime.strptime(date_value, fmt)
                except ValueError:
                    continue
        
        # Default to current time if parsing fails
        return datetime.now()
    
    def _determine_category(self, item: Dict[str, Any]) -> str:
        """
        Determine the category of the currency/commodity item
        
        Args:
            item: Currency data item
            
        Returns:
            Category string
        """
        name = str(item.get('name', '')).lower()
        name_en = str(item.get('name_en', '')).lower()
        code = str(item.get('code', '')).lower()
        
        # Gold and precious metals
        if any(keyword in name for keyword in ['طلا', 'سکه', 'گرم']) or \
           any(keyword in name_en for keyword in ['gold', 'coin']) or \
           code in ['xau', 'gold']:
            return 'precious_metals'
        
        # Major currencies
        if code in ['usd', 'eur', 'gbp', 'jpy', 'chf', 'cad', 'aud']:
            return 'major_currencies'
        
        # Cryptocurrencies
        if any(keyword in name for keyword in ['بیت', 'اتریوم', 'ارز دیجیتال']) or \
           any(keyword in name_en for keyword in ['bitcoin', 'ethereum', 'crypto']) or \
           code in ['btc', 'eth', 'bnb', 'ada', 'dot']:
            return 'cryptocurrencies'
        
        # Other currencies
        if 'currency' in name_en or 'dollar' in name_en:
            return 'other_currencies'
        
        return 'other'
    
    def get_specific_currency(self, currency_code: str) -> Optional[Dict[str, Any]]:
        """
        Get data for a specific currency
        
        Args:
            currency_code: Currency code (e.g., 'USD', 'EUR', 'BTC')
            
        Returns:
            Currency data dictionary or None if not found
        """
        try:
            all_currencies = self.get_currency_rates(use_pro=True)
            currency_code = currency_code.upper()
            
            for currency in all_currencies:
                if currency.get('code', '').upper() == currency_code:
                    return currency
            
            return None
            
        except Exception as e:
            self.logger.error(f"Failed to get currency {currency_code}: {e}")
            return None
    
    def get_currencies_by_category(self, category: str) -> List[Dict[str, Any]]:
        """
        Get currencies filtered by category
        
        Args:
            category: Category filter ('precious_metals', 'major_currencies', 'cryptocurrencies', etc.)
            
        Returns:
            List of currencies in the specified category
        """
        try:
            all_currencies = self.get_currency_rates(use_pro=True)
            
            filtered = [
                currency for currency in all_currencies
                if currency.get('category') == category
            ]
            
            return filtered
            
        except Exception as e:
            self.logger.error(f"Failed to get currencies by category {category}: {e}")
            return []
    
    def get_gold_prices(self) -> List[Dict[str, Any]]:
        """
        Get gold and precious metals prices
        
        Returns:
            List of gold/precious metals data
        """
        return self.get_currencies_by_category('precious_metals')
    
    def get_major_currencies(self) -> List[Dict[str, Any]]:
        """
        Get major currency exchange rates
        
        Returns:
            List of major currency data
        """
        return self.get_currencies_by_category('major_currencies')
    
    def get_crypto_prices(self) -> List[Dict[str, Any]]:
        """
        Get cryptocurrency prices
        
        Returns:
            List of cryptocurrency data
        """
        return self.get_currencies_by_category('cryptocurrencies')