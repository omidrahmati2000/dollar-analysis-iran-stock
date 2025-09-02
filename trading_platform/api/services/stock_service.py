"""
Stock Service - Business logic for stock operations
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
from fastapi import HTTPException
from trading_platform.api.repositories.stock_repository import StockRepository


class StockService:
    """Service layer for stock-related business logic"""
    
    def __init__(self, repository: StockRepository):
        self.repository = repository
    
    def get_stocks(self, limit: int = 50, symbol_filter: Optional[str] = None,
                   min_volume: Optional[int] = None, sort_by: str = "volume",
                   offset: int = 0) -> List[Dict[str, Any]]:
        """Get stocks with business logic processing"""

        try:
            # Use repository to get data - NO SQL in service layer!
            stocks = self.repository.get_stocks(
                limit=limit,
                symbol_filter=symbol_filter,
                min_volume=min_volume,
                sort_by=sort_by,
                sort_order="DESC",
                offset=offset
            )
            
            if not stocks:
                return []
            
            # Service layer only handles business logic and formatting
            processed_stocks = []
            for stock in stocks:
                last_price = float(stock.get('last_price', 0))
                price_change = float(stock.get('price_change', 0))
                
                processed_stocks.append({
                    'symbol': stock['symbol'],
                    'company_name': stock['company_name'],
                    'last_price': last_price,
                    'price_change': price_change,
                    'price_change_percent': (price_change / last_price * 100) if last_price > 0 else 0,
                    'volume': int(stock.get('volume', 0)),
                    'market_cap': float(stock['market_value']) if stock.get('market_value') else (last_price * int(stock.get('volume', 0))),
                    'last_update': str(stock.get('last_update', datetime.now().isoformat()))
                })
            
            return processed_stocks
            
        except Exception as e:
            print(f'Error in get_stocks: {e}')
            import traceback
            print(traceback.format_exc())
            # Return empty list instead of mock data on error
            return []
    
    def get_stock_details(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get detailed information for a specific stock"""
        
        try:
            # Use repository - NO SQL in service layer!
            stock = self.repository.get_stock_by_symbol(symbol)
            
            if not stock:
                return None
            
            # Service layer only formats and adds business logic
            last_price = float(stock.get('last_price', 0))
            price_change = float(stock.get('price_change', 0))
            
            return {
                'symbol': stock['symbol'],
                'company_name': stock['company_name'],
                'last_price': last_price,
                'price_change': price_change,
                'price_change_percent': (price_change / last_price * 100) if last_price > 0 else 0,
                'volume': int(stock.get('volume', 0)),
                'market_cap': float(stock['market_value']) if stock.get('market_value') else (last_price * int(stock.get('volume', 0))),
                'industry_group': stock.get('industry_group', 'N/A'),
                'isin': stock.get('isin', 'N/A'),
                'eps': float(stock['eps']) if stock.get('eps') else None,
                'pe_ratio': float(stock['pe_ratio']) if stock.get('pe_ratio') else None,
                'base_volume': int(stock['base_volume']) if stock.get('base_volume') else None,
                'last_update': str(stock.get('last_update', datetime.now().isoformat()))
            }
            
        except Exception as e:
            print(f"Error fetching stock details: {e}")
            return None
    
    def search_symbols(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search for symbols with enhanced results"""
        
        try:
            # Use repository for search - NO SQL in service!
            results = self.repository.search_symbols(query, limit)
            
            if not results:
                return []
            
            # Service layer adds business logic like relevance scoring
            formatted_results = []
            for result in results:
                formatted_results.append({
                    'symbol': result['symbol'],
                    'company_name': result.get('company_name', result['symbol']),
                    'industry': result.get('industry_group', 'Unknown'),
                    'relevance_score': self._calculate_relevance_score(query, result)
                })
            
            # Sort by relevance score - this is business logic, belongs in service
            formatted_results.sort(key=lambda x: x['relevance_score'], reverse=True)
            return formatted_results
            
        except Exception as e:
            print(f"Error searching symbols: {e}")
            return []
    
    def get_ohlcv(self, symbol: str, days: int = 30) -> List[Dict[str, Any]]:
        """Get OHLCV data with calculations"""
        
        try:
            # Use repository - NO SQL or data generation in service!
            ohlcv_data = self.repository.get_ohlcv(symbol, days)
            
            if not ohlcv_data:
                return []
            
            # Service layer adds business calculations like daily returns and volatility
            processed_data = []
            prev_close = None
            
            for data in ohlcv_data:
                processed = {
                    'symbol': data['symbol'],
                    'date': str(data['date']),
                    'open_price': float(data['open_price']),
                    'high_price': float(data['high_price']),
                    'low_price': float(data['low_price']),
                    'close_price': float(data['close_price']),
                    'volume': int(data['volume']),
                    'adjusted_close': float(data.get('adjusted_close', data['close_price']))
                }
                
                # Calculate daily return and volatility - business logic
                if prev_close:
                    processed['daily_return'] = round(((processed['close_price'] - prev_close) / prev_close * 100), 2)
                else:
                    processed['daily_return'] = 0
                
                processed['volatility'] = round(((processed['high_price'] - processed['low_price']) / processed['close_price'] * 100), 2)
                
                processed_data.append(processed)
                prev_close = processed['close_price']
            
            return processed_data
            
        except Exception as e:
            print(f"Error processing OHLCV data: {e}")
            return []
    
    def get_market_summary(self) -> Dict[str, Any]:
        """Get comprehensive market summary"""
        
        try:
            summary = self.repository.get_market_summary()
            
            # Add market status
            summary['market_status'] = self._determine_market_status()
            summary['market_trend'] = self._calculate_market_trend(summary)
            
            return summary
            
        except Exception as e:
            print(f"Error fetching market summary: {e}")
            # Return empty summary on error - no mock data!
            return {
                'total_volume': 0,
                'total_trades': 0,
                'total_market_cap': 0,
                'active_symbols': 0,
                'top_gainers': [],
                'top_losers': [],
                'market_status': self._determine_market_status(),
                'market_trend': 'NEUTRAL',
                'last_update': datetime.now().isoformat()
            }
    
    def _format_stock_data(self, stock: Dict[str, Any]) -> Dict[str, Any]:
        """Format stock data for API response"""
        
        return {
            'symbol': stock['symbol'],
            'company_name': stock.get('company_name', stock['symbol']),
            'last_price': float(stock.get('last_price', 0)),
            'price_change': float(stock.get('price_change', 0)),
            'price_change_percent': float(stock.get('price_change_percent', 0)),
            'volume': int(stock.get('volume', 0)),
            'market_cap': float(stock.get('market_cap', 0)) if stock.get('market_cap') else None,
            'last_update': str(stock.get('last_update', datetime.now().isoformat()))
        }
    
    def _calculate_relevance_score(self, query: str, result: Dict[str, Any]) -> float:
        """Calculate relevance score for search results"""
        
        query_upper = query.upper()
        symbol = result.get('symbol', '')
        company_name = result.get('company_name', '')
        
        score = 0
        
        # Exact symbol match
        if symbol == query_upper:
            score += 100
        # Symbol starts with query
        elif symbol.startswith(query_upper):
            score += 50
        # Symbol contains query
        elif query_upper in symbol:
            score += 25
        
        # Company name matching
        if query.lower() in company_name.lower():
            score += 20
        
        return score
    
    def _determine_market_status(self) -> str:
        """Determine current market status"""
        
        now = datetime.now()
        hour = now.hour
        
        # Tehran Stock Exchange hours (9:00 - 15:30 Tehran time)
        if now.weekday() < 5:  # Monday to Friday
            if 9 <= hour < 15 or (hour == 15 and now.minute <= 30):
                return "OPEN"
            elif hour < 9:
                return "PRE_MARKET"
            else:
                return "AFTER_HOURS"
        else:
            return "CLOSED"
    
    def _calculate_market_trend(self, summary: Dict[str, Any]) -> str:
        """Calculate overall market trend"""
        
        gainers = len(summary.get('top_gainers', []))
        losers = len(summary.get('top_losers', []))
        
        if gainers > losers * 1.5:
            return "BULLISH"
        elif losers > gainers * 1.5:
            return "BEARISH"
        else:
            return "NEUTRAL"