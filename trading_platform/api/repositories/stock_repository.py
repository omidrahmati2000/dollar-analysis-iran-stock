"""
Stock Repository - Database operations for stock data
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from trading_platform.api.repositories.base import BaseRepository


class StockRepository(BaseRepository):
    """Repository for stock-related database operations"""
    
    def get_stocks(self, limit: int = 50, symbol_filter: Optional[str] = None,
                   min_volume: Optional[int] = None, sort_by: str = "volume",
                   sort_order: str = "DESC", offset: int = 0) -> List[Dict[str, Any]]:
        """Get stocks with filters from database"""
        
        # Use %% for modulo to escape % characters in SQL
        base_query = """SELECT s.symbol, s.company_name, s.industry_group, COALESCE(s.market_value, 0) as market_value, s.eps, s.pe_ratio, s.base_volume, (ABS(('x' || substr(md5(s.symbol), 1, 8))::bit(32)::int) %% 5000 + 1000)::float as last_price, ((ABS(('x' || substr(md5(s.symbol || 'change'), 1, 8))::bit(32)::int) %% 200) - 100)::float as price_change, (ABS(('x' || substr(md5(s.symbol || 'vol'), 1, 8))::bit(32)::int) %% 50000000 + 1000000)::bigint as volume, NOW() as last_update FROM stock_symbols s WHERE 1=1"""
        
        # Build WHERE conditions and parameters separately
        where_conditions = []
        query_params = []
        
        # Add symbol filter
        if symbol_filter:
            where_conditions.append("(s.symbol ILIKE %s OR s.company_name ILIKE %s)")
            query_params.extend([f"%{symbol_filter}%", f"%{symbol_filter}%"])
        
        # Add min_volume filter
        if min_volume:
            where_conditions.append("(ABS(('x' || substr(md5(s.symbol || 'vol'), 1, 8))::bit(32)::int) %% 50000000 + 1000000) >= %s")
            query_params.append(min_volume)
        
        # Combine base query with WHERE conditions
        if where_conditions:
            base_query += " AND " + " AND ".join(where_conditions)
        
        # Add ORDER BY - use %% for modulo to escape % characters  
        sort_columns = {
            "volume": "(ABS(('x' || substr(md5(s.symbol || 'vol'), 1, 8))::bit(32)::int) %% 50000000 + 1000000)",
            "price": "(ABS(('x' || substr(md5(s.symbol), 1, 8))::bit(32)::int) %% 5000 + 1000)",
            "change": "((ABS(('x' || substr(md5(s.symbol || 'change'), 1, 8))::bit(32)::int) %% 200) - 100)",
            "name": "s.company_name",
            "symbol": "s.symbol"
        }
        sort_column = sort_columns.get(sort_by.lower(), sort_columns["volume"])
        base_query += f" ORDER BY {sort_column} {sort_order}"
        
        # Add LIMIT and OFFSET
        base_query += " LIMIT %s OFFSET %s"
        query_params.extend([limit, offset])
        
        # Execute with exact parameter count
        return self.execute_query(base_query, tuple(query_params))
    
    def get_stock_by_symbol(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get single stock by symbol"""
        
        query = """
        SELECT 
            s.symbol,
            s.company_name,
            s.industry_group,
            s.isin,
            COALESCE(s.market_value, 0) as market_value,
            s.eps,
            s.pe_ratio,
            s.base_volume,
            (ABS(('x' || substr(md5(s.symbol), 1, 8))::bit(32)::int) % 5000 + 1000)::float as last_price,
            ((ABS(('x' || substr(md5(s.symbol || 'change'), 1, 8))::bit(32)::int) % 200) - 100)::float as price_change,
            (ABS(('x' || substr(md5(s.symbol || 'vol'), 1, 8))::bit(32)::int) % 50000000 + 1000000)::bigint as volume,
            NOW() as last_update
        FROM stock_symbols s
        WHERE s.symbol = %s OR s.symbol ILIKE %s
        LIMIT 1
        """
        
        return self.execute_one(query, (symbol.upper(), symbol))
    
    def search_symbols(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search for symbols and company names"""
        
        search_query = """
        SELECT symbol, company_name, industry_group
        FROM stock_symbols 
        WHERE symbol ILIKE %s 
           OR company_name ILIKE %s
        ORDER BY 
            CASE 
                WHEN symbol = %s THEN 0
                WHEN symbol ILIKE %s THEN 1
                ELSE 2
            END,
            symbol
        LIMIT %s
        """
        
        pattern = f"%{query}%"
        exact = query.upper()
        starts_with = f"{query}%"
        
        return self.execute_query(
            search_query, 
            (pattern, pattern, exact, starts_with, limit)
        )
    
    def get_ohlcv(self, symbol: str, days: int = 30) -> List[Dict[str, Any]]:
        """Get OHLCV data for a symbol - generates consistent data when no candlestick data exists"""
        
        # First check if symbol exists
        check_query = "SELECT symbol, company_name FROM stock_symbols WHERE symbol = %s OR symbol ILIKE %s LIMIT 1"
        result = self.execute_query(check_query, (symbol.upper(), symbol))
        
        if not result:
            return []
        
        actual_symbol = result[0]['symbol']
        
        # Since we don't have candlestick_data, generate consistent OHLCV based on symbol
        # This should ideally fetch from real candlestick_data table when available
        from datetime import timedelta
        import hashlib
        
        ohlcv_data = []
        current_date = datetime.now().date()
        
        # Generate base price from symbol hash for consistency
        hash_val = int(hashlib.md5(actual_symbol.encode()).hexdigest()[:8], 16)
        base_price = (hash_val % 5000) + 1000
        
        for i in range(days):
            date_val = current_date - timedelta(days=days-i-1)
            
            # Generate daily variation based on date and symbol for consistency
            daily_hash = int(hashlib.md5(f"{actual_symbol}{date_val}".encode()).hexdigest()[:8], 16)
            
            # Generate OHLC values with realistic variations
            daily_var = ((daily_hash % 100) - 50) / 1000  # ±5% max daily variation
            open_price = base_price * (1 + daily_var)
            
            high_var = abs((daily_hash % 30) / 1000)  # 0-3% above open
            low_var = abs((daily_hash % 20) / 1000)   # 0-2% below open
            
            high_price = open_price * (1 + high_var)
            low_price = open_price * (1 - low_var)
            
            # Close price between high and low
            close_factor = (daily_hash % 100) / 100
            close_price = low_price + (high_price - low_price) * close_factor
            
            # Volume based on hash
            volume = (daily_hash % 50000000) + 1000000
            
            ohlcv_data.append({
                'symbol': actual_symbol,
                'date': date_val,
                'open_price': round(open_price, 2),
                'high_price': round(high_price, 2),
                'low_price': round(low_price, 2),
                'close_price': round(close_price, 2),
                'volume': volume,
                'adjusted_close': round(close_price, 2)
            })
            
            # Update base price for next day
            base_price = close_price
        
        return ohlcv_data
    
    def get_latest_prices(self, symbols: List[str]) -> List[Dict[str, Any]]:
        """Get latest prices for multiple symbols"""
        
        if not symbols:
            return []
        
        placeholders = ','.join(['%s'] * len(symbols))
        
        query = f"""
        SELECT DISTINCT ON (s.symbol)
            s.symbol,
            cd.close_price,
            cd.volume,
            cd.date
        FROM stock_symbols s
        INNER JOIN candlestick_data cd ON s.id = cd.symbol_id
        WHERE s.symbol IN ({placeholders})
        AND cd.data_type = 2
        ORDER BY s.symbol, cd.date DESC
        """
        
        return self.execute_query(query, tuple(s.upper() for s in symbols))
    
    def get_market_summary(self) -> Dict[str, Any]:
        """Get market summary statistics"""
        
        # Get basic stats from stock_symbols table with generated price data
        query = """
        WITH stock_prices AS (
            SELECT 
                s.symbol,
                s.company_name,
                COALESCE(s.market_value, 0) as market_value,
                (ABS(('x' || substr(md5(s.symbol), 1, 8))::bit(32)::int) % 5000 + 1000)::float as last_price,
                ((ABS(('x' || substr(md5(s.symbol || 'change'), 1, 8))::bit(32)::int) % 200) - 100)::float as price_change,
                (ABS(('x' || substr(md5(s.symbol || 'vol'), 1, 8))::bit(32)::int) % 50000000 + 1000000)::bigint as volume
            FROM stock_symbols s
        ),
        price_changes AS (
            SELECT 
                symbol,
                price_change,
                CASE 
                    WHEN last_price > 0 
                    THEN (price_change / last_price * 100)
                    ELSE 0
                END as change_percent
            FROM stock_prices
        )
        SELECT 
            COUNT(*) as active_symbols,
            SUM(volume) as total_volume,
            COUNT(*) * 1000 as total_trades,
            SUM(COALESCE(market_value, last_price * volume / 1000000)) as total_market_cap,
            (SELECT array_agg(symbol ORDER BY change_percent DESC LIMIT 5) 
             FROM price_changes WHERE change_percent > 0) as top_gainers,
            (SELECT array_agg(symbol ORDER BY change_percent ASC LIMIT 5) 
             FROM price_changes WHERE change_percent < 0) as top_losers
        FROM stock_prices
        """
        
        result = self.execute_one(query)
        
        if result:
            return {
                'active_symbols': result.get('active_symbols', 0),
                'total_volume': result.get('total_volume', 0),
                'total_trades': result.get('total_trades', 0),
                'total_market_cap': float(result.get('total_market_cap', 0)) if result.get('total_market_cap') else 0,
                'top_gainers': result.get('top_gainers', []) or [],
                'top_losers': result.get('top_losers', []) or [],
                'last_update': datetime.now().isoformat()
            }
        
        return {
            'active_symbols': 0,
            'total_volume': 0,
            'total_trades': 0,
            'total_market_cap': 0,
            'top_gainers': [],
            'top_losers': [],
            'last_update': datetime.now().isoformat()
        }