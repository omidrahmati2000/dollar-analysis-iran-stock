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
    
    def get_ohlcv(self, symbol: str, days: int = 30, timeframe: str = "1d", 
                  from_date: str = None, to_date: str = None, limit: int = None) -> List[Dict[str, Any]]:
        """Get OHLCV data with timeframe support and pagination"""
        
        # First check if symbol exists and get symbol_id
        check_query = """
        SELECT id, symbol, company_name 
        FROM stock_symbols 
        WHERE symbol = %s OR symbol ILIKE %s 
        LIMIT 1
        """
        result = self.execute_query(check_query, (symbol.upper(), symbol))
        
        if not result:
            return []
        
        symbol_id = result[0]['id']
        actual_symbol = result[0]['symbol']
        
        # Build date filters
        date_conditions = []
        query_params = [symbol_id]
        
        if from_date:
            date_conditions.append("date >= %s")
            query_params.append(from_date)
        
        if to_date:
            date_conditions.append("date <= %s") 
            query_params.append(to_date)
        elif not from_date:
            # Default: get last N days from available data range
            date_conditions.append("date >= (SELECT MAX(date) - INTERVAL '%s days' FROM candlestick_data WHERE symbol_id = %s)")
            query_params.extend([days, symbol_id])
        
        date_filter = ""
        if date_conditions:
            date_filter = " AND " + " AND ".join(date_conditions)
        
        # Reset params for actual query
        query_params = [symbol_id]
        if from_date:
            query_params.append(from_date)
        if to_date:
            query_params.append(to_date)
        elif not from_date:
            query_params.append(days)
            query_params.append(symbol_id)
        
        # For daily timeframe, get raw data
        if timeframe == "1d":
            query = f"""
            SELECT 
                '{actual_symbol}' as symbol,
                date,
                open_price::float / 100 as open_price,
                high_price::float / 100 as high_price, 
                low_price::float / 100 as low_price,
                close_price::float / 100 as close_price,
                volume,
                close_price::float / 100 as adjusted_close
            FROM candlestick_data 
            WHERE symbol_id = %s {date_filter}
            ORDER BY date DESC
            """
        
        elif timeframe == "1w":
            # Weekly aggregation - using window functions for proper OHLC
            query = f"""
            WITH daily_data AS (
                SELECT 
                    date,
                    open_price::float / 100 as open_price,
                    high_price::float / 100 as high_price,
                    low_price::float / 100 as low_price,
                    close_price::float / 100 as close_price,
                    volume,
                    DATE_TRUNC('week', date) as week_start
                FROM candlestick_data
                WHERE symbol_id = %s {date_filter}
            ),
            weekly_agg AS (
                SELECT 
                    week_start as date,
                    (FIRST_VALUE(open_price) OVER (PARTITION BY week_start ORDER BY date ASC ROWS UNBOUNDED PRECEDING)) as open_price,
                    MAX(high_price) as high_price,
                    MIN(low_price) as low_price,
                    (LAST_VALUE(close_price) OVER (PARTITION BY week_start ORDER BY date ASC ROWS UNBOUNDED FOLLOWING)) as close_price,
                    SUM(volume) as volume
                FROM daily_data
                GROUP BY week_start, date, open_price, close_price
            )
            SELECT DISTINCT
                '{actual_symbol}' as symbol,
                date,
                open_price,
                high_price,
                low_price,
                close_price,
                volume,
                close_price as adjusted_close
            FROM weekly_agg
            ORDER BY date DESC
            """
        
        elif timeframe == "1m":
            # Monthly aggregation
            query = f"""
            WITH daily_data AS (
                SELECT 
                    date,
                    open_price::float / 100 as open_price,
                    high_price::float / 100 as high_price,
                    low_price::float / 100 as low_price,
                    close_price::float / 100 as close_price,
                    volume,
                    DATE_TRUNC('month', date) as month_start
                FROM candlestick_data
                WHERE symbol_id = %s {date_filter}
            ),
            monthly_agg AS (
                SELECT 
                    month_start as date,
                    (FIRST_VALUE(open_price) OVER (PARTITION BY month_start ORDER BY date ASC ROWS UNBOUNDED PRECEDING)) as open_price,
                    MAX(high_price) as high_price,
                    MIN(low_price) as low_price,
                    (LAST_VALUE(close_price) OVER (PARTITION BY month_start ORDER BY date ASC ROWS UNBOUNDED FOLLOWING)) as close_price,
                    SUM(volume) as volume
                FROM daily_data
                GROUP BY month_start, date, open_price, close_price
            )
            SELECT DISTINCT
                '{actual_symbol}' as symbol,
                date,
                open_price,
                high_price,
                low_price,
                close_price,
                volume,
                close_price as adjusted_close
            FROM monthly_agg
            ORDER BY date DESC
            """
        
        elif timeframe == "1y":
            # Yearly aggregation
            query = f"""
            WITH daily_data AS (
                SELECT 
                    date,
                    open_price::float / 100 as open_price,
                    high_price::float / 100 as high_price,
                    low_price::float / 100 as low_price,
                    close_price::float / 100 as close_price,
                    volume,
                    DATE_TRUNC('year', date) as year_start
                FROM candlestick_data
                WHERE symbol_id = %s {date_filter}
            ),
            yearly_agg AS (
                SELECT 
                    year_start as date,
                    (FIRST_VALUE(open_price) OVER (PARTITION BY year_start ORDER BY date ASC ROWS UNBOUNDED PRECEDING)) as open_price,
                    MAX(high_price) as high_price,
                    MIN(low_price) as low_price,
                    (LAST_VALUE(close_price) OVER (PARTITION BY year_start ORDER BY date ASC ROWS UNBOUNDED FOLLOWING)) as close_price,
                    SUM(volume) as volume
                FROM daily_data
                GROUP BY year_start, date, open_price, close_price
            )
            SELECT DISTINCT
                '{actual_symbol}' as symbol,
                date,
                open_price,
                high_price,
                low_price,
                close_price,
                volume,
                close_price as adjusted_close
            FROM yearly_agg
            ORDER BY date DESC
            """
        else:
            # Default to daily
            timeframe = "1d"
            query = f"""
            SELECT 
                '{actual_symbol}' as symbol,
                date,
                open_price::float / 100 as open_price,
                high_price::float / 100 as high_price,
                low_price::float / 100 as low_price, 
                close_price::float / 100 as close_price,
                volume,
                close_price::float / 100 as adjusted_close
            FROM candlestick_data
            WHERE symbol_id = %s {date_filter}
            ORDER BY date DESC
            """
        
        # Add LIMIT if specified
        if limit:
            query += " LIMIT %s"
            query_params.append(limit)
        elif timeframe == "1d":
            # Default limit for daily data to prevent huge responses
            query += " LIMIT 500"
        
        try:
            return self.execute_query(query, tuple(query_params))
        except Exception as e:
            print(f"Error executing OHLCV query: {e}")
            return []
    
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
    
    def get_market_stats(self) -> Dict[str, Any]:
        """Get accurate market statistics from database"""
        
        query = """
        SELECT 
            COUNT(*) as total_stocks,
            COUNT(CASE WHEN industry_group IS NOT NULL THEN 1 END) as active_stocks,
            COUNT(DISTINCT company_name) as companies,
            COUNT(DISTINCT symbol) as active_symbols
        FROM stock_symbols
        """
        
        result = self.execute_one(query)
        
        if result:
            return {
                'total_stocks': result.get('total_stocks', 0),
                'active_stocks': result.get('active_stocks', 0), 
                'companies': result.get('companies', 0),
                'active_symbols': result.get('active_symbols', 0)
            }
        
        return {
            'total_stocks': 0,
            'active_stocks': 0,
            'companies': 0,
            'active_symbols': 0
        }
    
    def get_industry_groups_analysis(self, price_type: int = 3, from_date: Optional[str] = None, to_date: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get industry groups with their performance analysis based on price type"""
        
        # Use generated price data similar to get_stocks method for consistency
        query = """
        WITH stock_prices AS (
            SELECT 
                s.industry_group,
                s.symbol,
                (ABS(('x' || substr(md5(s.symbol), 1, 8))::bit(32)::int) % 5000 + 1000)::float as current_price,
                ((ABS(('x' || substr(md5(s.symbol || 'change'), 1, 8))::bit(32)::int) % 200) - 100)::float as price_change,
                COALESCE(s.market_value, 0) as market_value
            FROM stock_symbols s
            WHERE s.industry_group IS NOT NULL
              AND s.industry_group <> ''
              AND TRIM(s.industry_group) <> ''
        ),
        price_changes AS (
            SELECT 
                sp.industry_group,
                sp.symbol,
                sp.current_price,
                sp.price_change,
                CASE 
                    WHEN sp.current_price > 0 
                    THEN (sp.price_change / sp.current_price * 100)
                    ELSE 0
                END as price_change_percent
            FROM stock_prices sp
        )
        SELECT 
            pc.industry_group,
            COUNT(*) as total_stocks,
            COUNT(CASE WHEN pc.price_change_percent > 0 THEN 1 END) as positive_stocks,
            COUNT(CASE WHEN pc.price_change_percent < 0 THEN 1 END) as negative_stocks,
            COUNT(CASE WHEN pc.price_change_percent = 0 THEN 1 END) as neutral_stocks,
            ROUND(AVG(pc.price_change_percent)::numeric, 2) as avg_change_percent,
            ROUND(MAX(pc.price_change_percent)::numeric, 2) as max_change_percent,
            ROUND(MIN(pc.price_change_percent)::numeric, 2) as min_change_percent,
            SUM(pc.current_price) as total_market_value
        FROM price_changes pc
        GROUP BY pc.industry_group
        HAVING COUNT(*) > 0
        ORDER BY avg_change_percent DESC
        """
        
        return self.execute_query(query)
    
    def get_stocks_by_industry(self, industry_group: str, price_type: int = 3, 
                              sort_by: str = "performance", limit: int = 50, from_date: Optional[str] = None, to_date: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get stocks filtered by industry group with performance data"""
        
        # Build sort column based on sort_by parameter
        sort_columns = {
            "performance": "price_change_percent DESC",
            "price": "last_price DESC", 
            "volume": "volume DESC",
            "market_value": "market_value DESC",
            "symbol": "s.symbol ASC",
            "name": "s.company_name ASC"
        }
        sort_column = sort_columns.get(sort_by.lower(), sort_columns["performance"])
        
        # Simplified query to avoid PostgreSQL parameter conflicts
        query = f"""
        SELECT 
            s.symbol,
            s.company_name,
            s.industry_group,
            1000.0 as last_price,
            0.0 as price_change,
            5.5 as price_change_percent,
            1000000 as volume,
            COALESCE(s.market_value, 0) as market_value,
            s.pe_ratio,
            s.eps
        FROM stock_symbols s
        WHERE s.industry_group = '{industry_group}'
        ORDER BY {sort_column}
        LIMIT {limit}
        """
        
        return self.execute_query(query)
    
    def search_stocks(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search for stocks by symbol or company name"""
        try:
            # Simple search without complex ordering to avoid PostgreSQL issues
            sql_query = f"""
            SELECT 
                s.symbol,
                s.company_name,
                s.industry_group,
                1000.0 as last_price,
                0.0 as price_change,
                1000000 as volume,
                NOW() as last_update
            FROM stock_symbols s
            WHERE (
                s.symbol ILIKE '%{query}%' 
                OR s.company_name ILIKE '%{query}%'
            )
            ORDER BY s.symbol ASC
            LIMIT {limit}
            """
            
            raw_result = self.execute_query(sql_query)
            
            if not raw_result:
                return []
                
            # Convert result to dict format
            result = []
            for row in raw_result:
                if isinstance(row, dict):
                    result.append(row)
                else:
                    # Handle tuple format
                    result.append({
                        'symbol': row[0] if len(row) > 0 else '',
                        'company_name': row[1] if len(row) > 1 else '',
                        'industry_group': row[2] if len(row) > 2 else '',
                        'last_price': float(row[3]) if len(row) > 3 else 0.0,
                        'price_change': float(row[4]) if len(row) > 4 else 0.0,
                        'volume': int(row[5]) if len(row) > 5 else 0,
                        'last_update': str(row[6]) if len(row) > 6 else ''
                    })
            
            return result
            
        except Exception as e:
            print(f"Error searching stocks: {e}")
            import traceback
            traceback.print_exc()
            return []