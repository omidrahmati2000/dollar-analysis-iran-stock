"""
Currency Service - Business logic for currency operations
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
import random
import logging
from trading_platform.api.repositories.currency_repository import CurrencyRepository

logger = logging.getLogger(__name__)


class CurrencyService:
    """Service layer for currency-related business logic"""
    
    def __init__(self, repository: CurrencyRepository):
        self.repository = repository
    
    def get_currencies(self, limit: int = 20, currency_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get currencies with business logic processing"""
        
        try:
            currencies = self.repository.get_currencies(limit, currency_filter)
            
            if not currencies:
                return self._generate_mock_currencies()
            
            # Process and enhance currency data
            processed = []
            for currency in currencies:
                processed.append(self._format_currency_data(currency))
            return processed
            
        except Exception as e:
            logger.error(f"Exception in get_currencies: {e}")
            import traceback
            print(f"TRACEBACK: {traceback.format_exc()}")
            return self._generate_mock_currencies()
    
    def get_currency_details(self, currency_code: str) -> Optional[Dict[str, Any]]:
        """Get detailed information for a specific currency"""
        
        try:
            currency = self.repository.get_currency_by_code(currency_code)
            if currency:
                formatted = self._format_currency_data(currency)
                
                # Add historical data
                history = self.repository.get_currency_history(currency_code, days=7)
                formatted['history_7d'] = self._process_history(history)
                
                return formatted
            return None
            
        except Exception as e:
            print(f"Error fetching currency details: {e}")
            return None
    
    def get_exchange_rates(self) -> Dict[str, float]:
        """Get all exchange rates"""
        
        try:
            rates = self.repository.get_exchange_rates()
            
            if not rates:
                # Return mock rates
                return {
                    'USD': 42500.0,
                    'EUR': 46800.0,
                    'GBP': 54200.0,
                    'AED': 11580.0,
                    'TRY': 1420.0,
                    'CNY': 5890.0
                }
            
            return rates
            
        except Exception as e:
            print(f"Error fetching exchange rates: {e}")
            return {}
    
    def convert_currency(self, amount: float, from_currency: str, to_currency: str) -> Dict[str, Any]:
        """Convert amount between currencies"""
        
        try:
            rates = self.get_exchange_rates()
            
            # Handle IRR conversions
            if from_currency == 'IRR':
                if to_currency == 'IRR':
                    converted = amount
                else:
                    rate = rates.get(to_currency, 1)
                    converted = amount / rate if rate > 0 else 0
            elif to_currency == 'IRR':
                rate = rates.get(from_currency, 1)
                converted = amount * rate
            else:
                # Cross rate calculation
                from_rate = rates.get(from_currency, 1)
                to_rate = rates.get(to_currency, 1)
                converted = (amount * from_rate) / to_rate if to_rate > 0 else 0
            
            return {
                'from_currency': from_currency,
                'to_currency': to_currency,
                'amount': amount,
                'converted_amount': converted,
                'exchange_rate': converted / amount if amount > 0 else 0,
                'timestamp': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"Error converting currency: {e}")
            return {
                'error': str(e),
                'from_currency': from_currency,
                'to_currency': to_currency,
                'amount': amount
            }
    
    def search_currencies(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search for currencies by code or name"""
        try:
            results = self.repository.search_currencies(query, limit)
            
            # Process results
            processed_results = []
            for currency in results:
                processed_results.append(self._format_currency_data(currency))
            
            return processed_results
        except Exception as e:
            print(f"Error searching currencies: {e}")
            # Fallback to mock data search
            mock_data = self._generate_mock_currencies()
            query_lower = query.lower()
            filtered = [c for c in mock_data if 
                       query_lower in c['currency_code'].lower() or 
                       query_lower in c['currency_name'].lower() or
                       query_lower in c['currency_name_fa']]
            return filtered[:limit]

    def get_currency_statistics(self) -> Dict[str, Any]:
        """Get currency market statistics"""
        
        try:
            stats = self.repository.get_currency_statistics()
            
            # Add market analysis
            stats['market_sentiment'] = self._analyze_market_sentiment(stats)
            stats['volatility_index'] = self._calculate_volatility_index(stats)
            
            return stats
            
        except Exception as e:
            print(f"Error fetching currency statistics: {e}")
            return self._generate_mock_statistics()
    
    def _format_currency_data(self, currency: Dict[str, Any]) -> Dict[str, Any]:
        """Format currency data for API response"""
        
        return {
            'currency_code': currency['currency_code'],
            'currency_name': currency.get('currency_name', currency['currency_code']),
            'currency_name_fa': currency.get('currency_name_fa', currency['currency_code']),
            'price_irr': float(currency.get('price_irr', 0)),
            'change_24h': float(currency.get('change_24h', 0)),
            'change_percent_24h': float(currency.get('change_percent_24h', 0)),
            'volume_24h': float(currency.get('volume_24h', 0)) if currency.get('volume_24h') else None,
            'market_cap': float(currency.get('market_cap', 0)) if currency.get('market_cap') else None,
            'last_update': str(currency.get('last_update', datetime.now().isoformat()))
        }
    
    def _process_history(self, history: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process currency history data"""
        
        processed = []
        for i, data in enumerate(history):
            processed_data = {
                'date': str(data.get('date', data.get('last_update', ''))),
                'price': float(data['price_irr']),
                'change_24h': float(data['change_24h']),
                'volume_24h': float(data.get('volume_24h', 0)) if data.get('volume_24h') else 0
            }
            
            # Calculate trend
            if i > 0:
                prev_price = float(history[i-1]['price_irr'])
                processed_data['daily_change'] = processed_data['price'] - prev_price
                processed_data['daily_change_percent'] = (processed_data['daily_change'] / prev_price * 100) if prev_price > 0 else 0
            
            processed.append(processed_data)
        
        return processed
    
    def _analyze_market_sentiment(self, stats: Dict[str, Any]) -> str:
        """Analyze overall market sentiment"""
        
        avg_change = stats.get('avg_change_24h', 0)
        
        if avg_change > 2:
            return "VERY_BULLISH"
        elif avg_change > 0.5:
            return "BULLISH"
        elif avg_change < -2:
            return "VERY_BEARISH"
        elif avg_change < -0.5:
            return "BEARISH"
        else:
            return "NEUTRAL"
    
    def _calculate_volatility_index(self, stats: Dict[str, Any]) -> float:
        """Calculate currency market volatility index"""
        
        max_gain = abs(stats.get('max_gain_24h', 0))
        max_loss = abs(stats.get('max_loss_24h', 0))
        
        # Simple volatility calculation
        volatility = (max_gain + max_loss) / 2
        
        # Normalize to 0-100 scale
        return min(volatility * 10, 100)
    
    def _generate_mock_currencies(self) -> List[Dict[str, Any]]:
        """Generate mock currency data"""
        
        currencies = [
            {"code": "USD", "name": "US Dollar", "fa_name": "دلار آمریکا", "base_price": 42500},
            {"code": "EUR", "name": "Euro", "fa_name": "یورو", "base_price": 46800},
            {"code": "GBP", "name": "British Pound", "fa_name": "پوند انگلیس", "base_price": 54200},
            {"code": "AED", "name": "UAE Dirham", "fa_name": "درهم امارات", "base_price": 11580},
            {"code": "TRY", "name": "Turkish Lira", "fa_name": "لیره ترکیه", "base_price": 1420},
            {"code": "CNY", "name": "Chinese Yuan", "fa_name": "یوان چین", "base_price": 5890}
        ]
        
        result = []
        for curr in currencies:
            change_percent = random.uniform(-3, 3)
            change_24h = curr["base_price"] * change_percent / 100
            
            result.append({
                'currency_code': curr["code"],
                'currency_name': curr["name"],
                'currency_name_fa': curr["fa_name"],
                'price_irr': curr["base_price"] + change_24h,
                'change_24h': change_24h,
                'change_percent_24h': change_percent,
                'volume_24h': random.uniform(1000000, 10000000),
                'market_cap': None,
                'last_update': datetime.now().isoformat()
            })
        
        return result
    
    def _generate_mock_statistics(self) -> Dict[str, Any]:
        """Generate mock currency statistics"""
        
        return {
            'total_currencies': 6,
            'avg_change_24h': random.uniform(-1, 1),
            'max_gain_24h': random.uniform(2, 5),
            'max_loss_24h': random.uniform(-5, -2),
            'total_volume_24h': random.uniform(10000000, 50000000),
            'best_performer': 'EUR',
            'worst_performer': 'TRY',
            'market_sentiment': random.choice(['BULLISH', 'BEARISH', 'NEUTRAL']),
            'volatility_index': random.uniform(20, 60),
            'last_update': datetime.now().isoformat()
        }