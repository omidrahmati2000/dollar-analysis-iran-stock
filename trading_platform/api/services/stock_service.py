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
            results = self.repository.search_stocks(query, limit)
            
            if not results:
                return []
            
            # Service layer adds business logic like relevance scoring
            formatted_results = []
            for result in results:
                formatted_result = {
                    'symbol': result['symbol'],
                    'company_name': result.get('company_name', result['symbol']),
                    'last_price': float(result.get('last_price', 0)),
                    'price_change': float(result.get('price_change', 0)),
                    'price_change_percent': (float(result.get('price_change', 0)) / float(result.get('last_price', 1)) * 100) if result.get('last_price') else 0,
                    'volume': int(result.get('volume', 0)),
                    'industry': result.get('industry_group', 'Unknown'),
                    'relevance_score': self._calculate_relevance_score(query, result)
                }
                formatted_results.append(formatted_result)
            
            # Sort by relevance score - this is business logic, belongs in service
            formatted_results.sort(key=lambda x: x['relevance_score'], reverse=True)
            return formatted_results
            
        except Exception as e:
            print(f"Error searching symbols: {e}")
            import traceback
            traceback.print_exc()
            return []
    
    def get_ohlcv(self, symbol: str, days: int = 30, timeframe: str = "1d", 
                   from_date: str = None, to_date: str = None, limit: int = None,
                   before_date: str = None, after_date: str = None, cursor: str = None) -> List[Dict[str, Any]]:
        """Get OHLCV data with calculations"""
        
        try:
            # Use repository with new parameters
            ohlcv_data = self.repository.get_ohlcv(
                symbol=symbol, 
                days=days, 
                timeframe=timeframe,
                from_date=from_date,
                to_date=to_date,
                limit=limit,
                before_date=before_date,
                after_date=after_date,
                cursor=cursor
            )
            
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
    
    def get_market_stats(self) -> Dict[str, Any]:
        """Get accurate market statistics"""
        
        try:
            stats = self.repository.get_market_stats()
            return stats
            
        except Exception as e:
            print(f"Error fetching market stats: {e}")
            return {
                'total_stocks': 0,
                'active_stocks': 0,
                'companies': 0,
                'active_symbols': 0
            }
    
    def get_industry_groups_analysis(self, price_type: int = 3, from_date: Optional[str] = None, to_date: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get industry groups analysis with performance metrics"""
        
        try:
            groups = self.repository.get_industry_groups_analysis(price_type, from_date, to_date)
            
            if not groups:
                return []
            
            # Process groups data - check if it's already dict or tuple
            processed_groups = []
            
            for group in groups:
                # Handle both dict and tuple formats
                if isinstance(group, dict):
                    group_dict = dict(group)
                else:
                    # Assume tuple format: (industry_group, total_stocks, positive_stocks, negative_stocks, neutral_stocks, avg_change_percent, max_change_percent, min_change_percent, total_market_value)
                    group_dict = {
                        'industry_group': group[0],
                        'total_stocks': group[1],
                        'positive_stocks': group[2],
                        'negative_stocks': group[3],
                        'neutral_stocks': group[4],
                        'avg_change_percent': float(group[5]) if group[5] is not None else 0.0,
                        'max_change_percent': float(group[6]) if group[6] is not None else 0.0,
                        'min_change_percent': float(group[7]) if group[7] is not None else 0.0,
                        'total_market_value': float(group[8]) if group[8] is not None else 0.0
                    }
                
                # Add business logic calculations
                total_stocks = group_dict.get('total_stocks', 0)
                positive_stocks = group_dict.get('positive_stocks', 0)
                negative_stocks = group_dict.get('negative_stocks', 0)
                
                # Calculate performance ratios
                group_dict['positive_ratio'] = (positive_stocks / total_stocks * 100) if total_stocks > 0 else 0
                group_dict['negative_ratio'] = (negative_stocks / total_stocks * 100) if total_stocks > 0 else 0
                
                # Determine group trend
                if group_dict['positive_ratio'] > 60:
                    group_dict['trend'] = 'BULLISH'
                elif group_dict['negative_ratio'] > 60:
                    group_dict['trend'] = 'BEARISH'
                else:
                    group_dict['trend'] = 'NEUTRAL'
                
                processed_groups.append(group_dict)
            
            return processed_groups
            
        except Exception as e:
            print(f"Error fetching industry groups analysis: {e}")
            import traceback
            print(traceback.format_exc())
            return []
    
    def get_stocks_by_industry(self, industry_group: str, price_type: int = 3, 
                              sort_by: str = "performance", limit: int = 50, from_date: Optional[str] = None, to_date: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get stocks filtered by industry group with performance data"""
        
        try:
            stocks = self.repository.get_stocks_by_industry(
                industry_group, price_type, sort_by, limit, from_date, to_date
            )
            
            if not stocks:
                return []
            
            # Add business logic formatting
            processed_stocks = []
            for stock in stocks:
                # Handle both dict and tuple formats
                if isinstance(stock, dict):
                    stock_dict = dict(stock)
                else:
                    # Assume tuple format from query
                    stock_dict = {
                        'symbol': stock[0],
                        'company_name': stock[1],
                        'industry_group': stock[2],
                        'market_value': stock[3],
                        'pe_ratio': stock[4],
                        'eps': stock[5],
                        'last_price': stock[6],
                        'price_change': stock[7],
                        'volume': stock[8],
                        'price_change_percent': stock[9]
                    }
                
                processed_stock = {
                    'symbol': stock_dict['symbol'],
                    'company_name': stock_dict['company_name'],
                    'industry_group': stock_dict['industry_group'],
                    'last_price': float(stock_dict.get('last_price', 0)) if stock_dict.get('last_price') is not None else 0.0,
                    'price_change': float(stock_dict.get('price_change', 0)) if stock_dict.get('price_change') is not None else 0.0,
                    'price_change_percent': float(stock_dict.get('price_change_percent', 0)) if stock_dict.get('price_change_percent') is not None else 0.0,
                    'volume': int(stock_dict.get('volume', 0)) if stock_dict.get('volume') is not None else 0,
                    'market_value': float(stock_dict.get('market_value', 0)) if stock_dict.get('market_value') else 0,
                    'pe_ratio': float(stock_dict.get('pe_ratio', 0)) if stock_dict.get('pe_ratio') else None,
                    'eps': float(stock_dict.get('eps', 0)) if stock_dict.get('eps') else None
                }
                
                # Add performance category
                change_percent = processed_stock['price_change_percent']
                if change_percent > 2:
                    processed_stock['performance_category'] = 'STRONG_POSITIVE'
                elif change_percent > 0:
                    processed_stock['performance_category'] = 'POSITIVE'
                elif change_percent < -2:
                    processed_stock['performance_category'] = 'STRONG_NEGATIVE'
                elif change_percent < 0:
                    processed_stock['performance_category'] = 'NEGATIVE'
                else:
                    processed_stock['performance_category'] = 'NEUTRAL'
                
                processed_stocks.append(processed_stock)
            
            return processed_stocks
            
        except Exception as e:
            print(f"Error fetching stocks by industry: {e}")
            import traceback
            print(traceback.format_exc())
            return []
    
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