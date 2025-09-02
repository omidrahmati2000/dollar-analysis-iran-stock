"""
Repository for stock symbols and prices data access
"""
from typing import List, Dict, Optional, Any
from datetime import datetime
from dataclasses import dataclass

from .repositories import DatabaseConnection
from ..core.exceptions import RepositoryException
from ..domain.models import DataType


@dataclass
class StockData:
    """Stock data model with joined price information"""
    id: int
    symbol: str
    name: str
    name_fa: str
    exchange: str
    sector: Optional[str] = None
    industry: Optional[str] = None
    market_cap: Optional[float] = None
    shares_outstanding: Optional[int] = None
    
    # Latest price data (from stock_prices)
    latest_price: Optional[float] = None
    latest_date: Optional[datetime] = None
    open_price: Optional[float] = None
    high_price: Optional[float] = None
    low_price: Optional[float] = None
    close_price: Optional[float] = None
    volume: Optional[int] = None
    data_type: Optional[int] = None
    
    # Calculated fields
    change_amount: Optional[float] = None
    change_percent: Optional[float] = None
    
    # Metadata
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_active: bool = True


class StockRepository:
    """Repository for stock symbols and prices operations"""
    
    def __init__(self, db_connection: DatabaseConnection):
        self.db = db_connection
    
    def get_all_stocks_with_latest_prices(self, data_type: int = 2, 
                                        limit: int = None, 
                                        offset: int = 0) -> List[StockData]:
        """Get all stock symbols with their latest prices"""
        with self.db.get_cursor() as cursor:
            query = """
                SELECT 
                    s.id,
                    s.symbol,
                    s.name,
                    s.name_fa,
                    s.exchange,
                    s.sector,
                    s.industry,
                    s.market_cap,
                    s.shares_outstanding,
                    s.created_at,
                    s.updated_at,
                    s.is_active,
                    sp.open_price,
                    sp.high_price,
                    sp.low_price,
                    sp.close_price,
                    sp.volume,
                    sp.date as latest_date,
                    sp.data_type,
                    sp.close_price as latest_price
                FROM stock_symbols s
                LEFT JOIN LATERAL (
                    SELECT open_price, high_price, low_price, close_price, volume, date, data_type
                    FROM stock_prices 
                    WHERE stock_id = s.id AND data_type = %s
                    ORDER BY date DESC 
                    LIMIT 1
                ) sp ON true
                WHERE s.is_active = true
                ORDER BY s.symbol
            """
            
            params = [data_type]
            
            if limit:
                query += f" LIMIT {limit} OFFSET {offset}"
                
            cursor.execute(query, params)
            results = cursor.fetchall()
            
            return [self._map_to_stock_data(row) for row in results]
    
    def search_stocks(self, search_term: str, data_type: int = 2, 
                     limit: int = 50) -> List[StockData]:
        """Search stocks by symbol or name"""
        with self.db.get_cursor() as cursor:
            search_pattern = f"%{search_term}%"
            
            query = """
                SELECT 
                    s.id,
                    s.symbol,
                    s.name,
                    s.name_fa,
                    s.exchange,
                    s.sector,
                    s.industry,
                    s.market_cap,
                    s.shares_outstanding,
                    s.created_at,
                    s.updated_at,
                    s.is_active,
                    sp.open_price,
                    sp.high_price,
                    sp.low_price,
                    sp.close_price,
                    sp.volume,
                    sp.date as latest_date,
                    sp.data_type,
                    sp.close_price as latest_price
                FROM stock_symbols s
                LEFT JOIN LATERAL (
                    SELECT open_price, high_price, low_price, close_price, volume, date, data_type
                    FROM stock_prices 
                    WHERE stock_id = s.id AND data_type = %s
                    ORDER BY date DESC 
                    LIMIT 1
                ) sp ON true
                WHERE 
                    s.is_active = true AND (
                        s.symbol ILIKE %s OR 
                        s.name ILIKE %s OR 
                        s.name_fa ILIKE %s
                    )
                ORDER BY s.symbol
                LIMIT %s
            """
            
            cursor.execute(query, (data_type, search_pattern, search_pattern, search_pattern, limit))
            results = cursor.fetchall()
            
            return [self._map_to_stock_data(row) for row in results]
    
    def get_stocks_by_exchange(self, exchange: str, data_type: int = 2, 
                              limit: int = None) -> List[StockData]:
        """Get stocks filtered by exchange"""
        with self.db.get_cursor() as cursor:
            query = """
                SELECT 
                    s.id,
                    s.symbol,
                    s.name,
                    s.name_fa,
                    s.exchange,
                    s.sector,
                    s.industry,
                    s.market_cap,
                    s.shares_outstanding,
                    s.created_at,
                    s.updated_at,
                    s.is_active,
                    sp.open_price,
                    sp.high_price,
                    sp.low_price,
                    sp.close_price,
                    sp.volume,
                    sp.date as latest_date,
                    sp.data_type,
                    sp.close_price as latest_price
                FROM stock_symbols s
                LEFT JOIN LATERAL (
                    SELECT open_price, high_price, low_price, close_price, volume, date, data_type
                    FROM stock_prices 
                    WHERE stock_id = s.id AND data_type = %s
                    ORDER BY date DESC 
                    LIMIT 1
                ) sp ON true
                WHERE s.is_active = true AND s.exchange = %s
                ORDER BY s.symbol
            """
            
            params = [data_type, exchange]
            
            if limit:
                query += f" LIMIT {limit}"
                
            cursor.execute(query, params)
            results = cursor.fetchall()
            
            return [self._map_to_stock_data(row) for row in results]
    
    def get_stocks_sorted(self, sort_by: str = "symbol", 
                         sort_order: str = "ASC", 
                         data_type: int = 2,
                         limit: int = None) -> List[StockData]:
        """Get stocks sorted by specified column"""
        
        # Valid sort columns
        valid_columns = {
            "symbol": "s.symbol",
            "name": "s.name", 
            "name_fa": "s.name_fa",
            "exchange": "s.exchange",
            "sector": "s.sector",
            "latest_price": "sp.close_price",
            "volume": "sp.volume",
            "market_cap": "s.market_cap",
            "latest_date": "sp.date"
        }
        
        if sort_by not in valid_columns:
            sort_by = "symbol"
        
        if sort_order.upper() not in ["ASC", "DESC"]:
            sort_order = "ASC"
        
        with self.db.get_cursor() as cursor:
            query = f"""
                SELECT 
                    s.id,
                    s.symbol,
                    s.name,
                    s.name_fa,
                    s.exchange,
                    s.sector,
                    s.industry,
                    s.market_cap,
                    s.shares_outstanding,
                    s.created_at,
                    s.updated_at,
                    s.is_active,
                    sp.open_price,
                    sp.high_price,
                    sp.low_price,
                    sp.close_price,
                    sp.volume,
                    sp.date as latest_date,
                    sp.data_type,
                    sp.close_price as latest_price
                FROM stock_symbols s
                LEFT JOIN LATERAL (
                    SELECT open_price, high_price, low_price, close_price, volume, date, data_type
                    FROM stock_prices 
                    WHERE stock_id = s.id AND data_type = %s
                    ORDER BY date DESC 
                    LIMIT 1
                ) sp ON true
                WHERE s.is_active = true
                ORDER BY {valid_columns[sort_by]} {sort_order}
            """
            
            params = [data_type]
            
            if limit:
                query += f" LIMIT {limit}"
            
            cursor.execute(query, params)
            results = cursor.fetchall()
            
            return [self._map_to_stock_data(row) for row in results]
    
    def get_stocks_filtered(self, filters: Dict[str, Any], 
                           data_type: int = 2) -> List[StockData]:
        """Get stocks with advanced filters"""
        with self.db.get_cursor() as cursor:
            conditions = ["s.is_active = true"]
            params = [data_type]
            
            # Exchange filter
            if filters.get('exchange'):
                conditions.append("s.exchange = %s")
                params.append(filters['exchange'])
            
            # Sector filter
            if filters.get('sector'):
                conditions.append("s.sector = %s")
                params.append(filters['sector'])
            
            # Industry filter
            if filters.get('industry'):
                conditions.append("s.industry = %s")
                params.append(filters['industry'])
            
            # Price range filter
            if filters.get('min_price'):
                conditions.append("sp.close_price >= %s")
                params.append(filters['min_price'])
            
            if filters.get('max_price'):
                conditions.append("sp.close_price <= %s")
                params.append(filters['max_price'])
            
            # Volume filter
            if filters.get('min_volume'):
                conditions.append("sp.volume >= %s")
                params.append(filters['min_volume'])
            
            # Market cap filter
            if filters.get('min_market_cap'):
                conditions.append("s.market_cap >= %s")
                params.append(filters['min_market_cap'])
            
            # Has recent data filter
            if filters.get('has_recent_data'):
                conditions.append("sp.date >= CURRENT_DATE - INTERVAL '7 days'")
            
            where_clause = "WHERE " + " AND ".join(conditions)
            
            query = f"""
                SELECT 
                    s.id,
                    s.symbol,
                    s.name,
                    s.name_fa,
                    s.exchange,
                    s.sector,
                    s.industry,
                    s.market_cap,
                    s.shares_outstanding,
                    s.created_at,
                    s.updated_at,
                    s.is_active,
                    sp.open_price,
                    sp.high_price,
                    sp.low_price,
                    sp.close_price,
                    sp.volume,
                    sp.date as latest_date,
                    sp.data_type,
                    sp.close_price as latest_price
                FROM stock_symbols s
                LEFT JOIN LATERAL (
                    SELECT open_price, high_price, low_price, close_price, volume, date, data_type
                    FROM stock_prices 
                    WHERE stock_id = s.id AND data_type = %s
                    ORDER BY date DESC 
                    LIMIT 1
                ) sp ON true
                {where_clause}
                ORDER BY s.symbol
                LIMIT 1000
            """
            
            cursor.execute(query, params)
            results = cursor.fetchall()
            
            return [self._map_to_stock_data(row) for row in results]
    
    def get_exchanges(self) -> List[str]:
        """Get list of all exchanges"""
        with self.db.get_cursor() as cursor:
            cursor.execute("""
                SELECT DISTINCT exchange 
                FROM stock_symbols 
                WHERE is_active = true AND exchange IS NOT NULL
                ORDER BY exchange
            """)
            results = cursor.fetchall()
            return [row['exchange'] for row in results]
    
    def get_sectors(self, exchange: str = None) -> List[str]:
        """Get list of sectors, optionally filtered by exchange"""
        with self.db.get_cursor() as cursor:
            query = """
                SELECT DISTINCT sector 
                FROM stock_symbols 
                WHERE is_active = true AND sector IS NOT NULL
            """
            params = []
            
            if exchange:
                query += " AND exchange = %s"
                params.append(exchange)
            
            query += " ORDER BY sector"
            
            cursor.execute(query, params)
            results = cursor.fetchall()
            return [row['sector'] for row in results]
    
    def get_industries(self, sector: str = None) -> List[str]:
        """Get list of industries, optionally filtered by sector"""
        with self.db.get_cursor() as cursor:
            query = """
                SELECT DISTINCT industry 
                FROM stock_symbols 
                WHERE is_active = true AND industry IS NOT NULL
            """
            params = []
            
            if sector:
                query += " AND sector = %s"
                params.append(sector)
            
            query += " ORDER BY industry"
            
            cursor.execute(query, params)
            results = cursor.fetchall()
            return [row['industry'] for row in results]
    
    def get_stock_stats(self, data_type: int = 2) -> Dict[str, Any]:
        """Get overall stock statistics"""
        with self.db.get_cursor() as cursor:
            query = """
                SELECT 
                    COUNT(*) as total_stocks,
                    COUNT(sp.close_price) as stocks_with_prices,
                    AVG(sp.close_price) as avg_price,
                    MAX(sp.close_price) as max_price,
                    MIN(sp.close_price) as min_price,
                    SUM(sp.volume) as total_volume,
                    COUNT(DISTINCT s.exchange) as total_exchanges,
                    COUNT(DISTINCT s.sector) as total_sectors
                FROM stock_symbols s
                LEFT JOIN LATERAL (
                    SELECT close_price, volume
                    FROM stock_prices 
                    WHERE stock_id = s.id AND data_type = %s
                    ORDER BY date DESC 
                    LIMIT 1
                ) sp ON true
                WHERE s.is_active = true
            """
            
            cursor.execute(query, [data_type])
            result = cursor.fetchone()
            
            return dict(result) if result else {}
    
    def get_stock_price_history(self, stock_id: int, data_type: int = 2, 
                               days: int = 30) -> List[Dict]:
        """Get price history for a stock"""
        with self.db.get_cursor() as cursor:
            query = """
                SELECT date, open_price, high_price, low_price, close_price, volume, data_type
                FROM stock_prices
                WHERE stock_id = %s AND data_type = %s
                    AND date >= CURRENT_DATE - INTERVAL '%s days'
                ORDER BY date DESC
                LIMIT 1000
            """
            
            cursor.execute(query, (stock_id, data_type, days))
            return cursor.fetchall()
    
    def _map_to_stock_data(self, row: Dict) -> StockData:
        """Map database row to StockData object"""
        # Calculate change if we have current and previous prices
        change_amount = None
        change_percent = None
        
        stock_data = StockData(
            id=row['id'],
            symbol=row['symbol'],
            name=row['name'],
            name_fa=row['name_fa'],
            exchange=row['exchange'],
            sector=row.get('sector'),
            industry=row.get('industry'),
            market_cap=float(row['market_cap']) if row['market_cap'] else None,
            shares_outstanding=int(row['shares_outstanding']) if row['shares_outstanding'] else None,
            
            latest_price=float(row['latest_price']) if row['latest_price'] else None,
            latest_date=row.get('latest_date'),
            open_price=float(row['open_price']) if row['open_price'] else None,
            high_price=float(row['high_price']) if row['high_price'] else None,
            low_price=float(row['low_price']) if row['low_price'] else None,
            close_price=float(row['close_price']) if row['close_price'] else None,
            volume=int(row['volume']) if row['volume'] else None,
            data_type=int(row['data_type']) if row['data_type'] else None,
            
            change_amount=change_amount,
            change_percent=change_percent,
            
            created_at=row.get('created_at'),
            updated_at=row.get('updated_at'),
            is_active=bool(row.get('is_active', True))
        )
        
        return stock_data