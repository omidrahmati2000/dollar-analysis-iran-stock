"""
Repository for currency data access
"""
from typing import List, Dict, Optional, Any
from datetime import datetime
from dataclasses import dataclass

from .repositories import DatabaseConnection
from ..core.exceptions import RepositoryException


@dataclass
class CurrencyData:
    """Currency data model"""
    id: int
    symbol: str
    name: str
    name_fa: str
    latest_price: Optional[float] = None
    latest_date: Optional[datetime] = None
    change_24h: Optional[float] = None
    change_percent_24h: Optional[float] = None
    volume_24h: Optional[float] = None
    market_cap: Optional[float] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CurrencyRepository:
    """Repository for currency data operations"""
    
    def __init__(self, db_connection: DatabaseConnection):
        self.db = db_connection
    
    def get_all_currencies_with_latest_prices(self, limit: int = None, offset: int = 0) -> List[CurrencyData]:
        """Get all currencies with their latest prices from currency_history"""
        with self.db.get_cursor() as cursor:
            query = """
                SELECT 
                    c.id,
                    c.symbol,
                    c.name,
                    c.name_fa,
                    c.created_at,
                    c.updated_at,
                    ch.price as latest_price,
                    ch.date as latest_date,
                    ch.change_24h,
                    ch.change_percent_24h,
                    ch.volume_24h,
                    ch.market_cap
                FROM currencies c
                LEFT JOIN LATERAL (
                    SELECT price, date, change_24h, change_percent_24h, volume_24h, market_cap
                    FROM currency_history 
                    WHERE currency_id = c.id 
                    ORDER BY date DESC 
                    LIMIT 1
                ) ch ON true
                ORDER BY c.symbol
            """
            
            if limit:
                query += f" LIMIT {limit} OFFSET {offset}"
            
            cursor.execute(query)
            results = cursor.fetchall()
            
            return [self._map_to_currency_data(row) for row in results]
    
    def search_currencies(self, search_term: str, limit: int = 50) -> List[CurrencyData]:
        """Search currencies by symbol or name"""
        with self.db.get_cursor() as cursor:
            search_pattern = f"%{search_term}%"
            
            query = """
                SELECT 
                    c.id,
                    c.symbol,
                    c.name,
                    c.name_fa,
                    c.created_at,
                    c.updated_at,
                    ch.price as latest_price,
                    ch.date as latest_date,
                    ch.change_24h,
                    ch.change_percent_24h,
                    ch.volume_24h,
                    ch.market_cap
                FROM currencies c
                LEFT JOIN LATERAL (
                    SELECT price, date, change_24h, change_percent_24h, volume_24h, market_cap
                    FROM currency_history 
                    WHERE currency_id = c.id 
                    ORDER BY date DESC 
                    LIMIT 1
                ) ch ON true
                WHERE 
                    c.symbol ILIKE %s OR 
                    c.name ILIKE %s OR 
                    c.name_fa ILIKE %s
                ORDER BY c.symbol
                LIMIT %s
            """
            
            cursor.execute(query, (search_pattern, search_pattern, search_pattern, limit))
            results = cursor.fetchall()
            
            return [self._map_to_currency_data(row) for row in results]
    
    def get_currency_price_history(self, currency_id: int, days: int = 30) -> List[Dict]:
        """Get price history for a currency"""
        with self.db.get_cursor() as cursor:
            query = """
                SELECT date, price, change_24h, change_percent_24h, volume_24h, market_cap
                FROM currency_history
                WHERE currency_id = %s
                    AND date >= CURRENT_DATE - INTERVAL '%s days'
                ORDER BY date DESC
                LIMIT 1000
            """
            
            cursor.execute(query, (currency_id, days))
            return cursor.fetchall()
    
    def get_currencies_sorted(self, sort_by: str = "symbol", 
                            sort_order: str = "ASC", 
                            limit: int = None) -> List[CurrencyData]:
        """Get currencies sorted by specified column"""
        
        # Valid sort columns
        valid_columns = {
            "symbol": "c.symbol",
            "name": "c.name", 
            "name_fa": "c.name_fa",
            "latest_price": "ch.price",
            "change_24h": "ch.change_24h",
            "change_percent_24h": "ch.change_percent_24h",
            "volume_24h": "ch.volume_24h",
            "market_cap": "ch.market_cap",
            "latest_date": "ch.date"
        }
        
        if sort_by not in valid_columns:
            sort_by = "symbol"
        
        if sort_order.upper() not in ["ASC", "DESC"]:
            sort_order = "ASC"
        
        with self.db.get_cursor() as cursor:
            query = f"""
                SELECT 
                    c.id,
                    c.symbol,
                    c.name,
                    c.name_fa,
                    c.created_at,
                    c.updated_at,
                    ch.price as latest_price,
                    ch.date as latest_date,
                    ch.change_24h,
                    ch.change_percent_24h,
                    ch.volume_24h,
                    ch.market_cap
                FROM currencies c
                LEFT JOIN LATERAL (
                    SELECT price, date, change_24h, change_percent_24h, volume_24h, market_cap
                    FROM currency_history 
                    WHERE currency_id = c.id 
                    ORDER BY date DESC 
                    LIMIT 1
                ) ch ON true
                ORDER BY {valid_columns[sort_by]} {sort_order}
            """
            
            if limit:
                query += f" LIMIT {limit}"
            
            cursor.execute(query)
            results = cursor.fetchall()
            
            return [self._map_to_currency_data(row) for row in results]
    
    def get_currencies_filtered(self, filters: Dict[str, Any]) -> List[CurrencyData]:
        """Get currencies with advanced filters"""
        with self.db.get_cursor() as cursor:
            conditions = []
            params = []
            
            # Price range filter
            if filters.get('min_price'):
                conditions.append("ch.price >= %s")
                params.append(filters['min_price'])
            
            if filters.get('max_price'):
                conditions.append("ch.price <= %s")
                params.append(filters['max_price'])
            
            # Change percentage filter
            if filters.get('min_change'):
                conditions.append("ch.change_percent_24h >= %s")
                params.append(filters['min_change'])
            
            if filters.get('max_change'):
                conditions.append("ch.change_percent_24h <= %s")
                params.append(filters['max_change'])
            
            # Volume filter
            if filters.get('min_volume'):
                conditions.append("ch.volume_24h >= %s")
                params.append(filters['min_volume'])
            
            # Has recent data filter
            if filters.get('has_recent_data'):
                conditions.append("ch.date >= CURRENT_DATE - INTERVAL '7 days'")
            
            where_clause = ""
            if conditions:
                where_clause = "WHERE " + " AND ".join(conditions)
            
            query = f"""
                SELECT 
                    c.id,
                    c.symbol,
                    c.name,
                    c.name_fa,
                    c.created_at,
                    c.updated_at,
                    ch.price as latest_price,
                    ch.date as latest_date,
                    ch.change_24h,
                    ch.change_percent_24h,
                    ch.volume_24h,
                    ch.market_cap
                FROM currencies c
                LEFT JOIN LATERAL (
                    SELECT price, date, change_24h, change_percent_24h, volume_24h, market_cap
                    FROM currency_history 
                    WHERE currency_id = c.id 
                    ORDER BY date DESC 
                    LIMIT 1
                ) ch ON true
                {where_clause}
                ORDER BY c.symbol
                LIMIT 1000
            """
            
            cursor.execute(query, params)
            results = cursor.fetchall()
            
            return [self._map_to_currency_data(row) for row in results]
    
    def get_currency_stats(self) -> Dict[str, Any]:
        """Get overall currency statistics"""
        with self.db.get_cursor() as cursor:
            query = """
                SELECT 
                    COUNT(*) as total_currencies,
                    COUNT(ch.price) as currencies_with_prices,
                    AVG(ch.change_percent_24h) as avg_change_24h,
                    MAX(ch.change_percent_24h) as max_change_24h,
                    MIN(ch.change_percent_24h) as min_change_24h,
                    SUM(ch.volume_24h) as total_volume_24h
                FROM currencies c
                LEFT JOIN LATERAL (
                    SELECT price, change_percent_24h, volume_24h
                    FROM currency_history 
                    WHERE currency_id = c.id 
                    ORDER BY date DESC 
                    LIMIT 1
                ) ch ON true
            """
            
            cursor.execute(query)
            result = cursor.fetchone()
            
            return dict(result) if result else {}
    
    def _map_to_currency_data(self, row: Dict) -> CurrencyData:
        """Map database row to CurrencyData object"""
        return CurrencyData(
            id=row['id'],
            symbol=row['symbol'],
            name=row['name'],
            name_fa=row['name_fa'],
            latest_price=float(row['latest_price']) if row['latest_price'] else None,
            latest_date=row['latest_date'],
            change_24h=float(row['change_24h']) if row['change_24h'] else None,
            change_percent_24h=float(row['change_percent_24h']) if row['change_percent_24h'] else None,
            volume_24h=float(row['volume_24h']) if row['volume_24h'] else None,
            market_cap=float(row['market_cap']) if row['market_cap'] else None,
            created_at=row.get('created_at'),
            updated_at=row.get('updated_at')
        )