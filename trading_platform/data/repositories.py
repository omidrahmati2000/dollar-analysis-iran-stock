"""
Repository pattern implementation for data access
Following Single Responsibility and Dependency Inversion principles
"""
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import pandas as pd
from contextlib import contextmanager

from ..core.interfaces import IRepository
from ..core.exceptions import RepositoryException
from ..domain.models import Symbol, OHLCV, MarketType, TimeFrame, MarketStatistics


class DatabaseConnection:
    """Database connection manager"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self._connection = None
    
    @contextmanager
    def get_connection(self):
        """Get database connection context manager"""
        try:
            conn = psycopg2.connect(**self.config)
            yield conn
        except Exception as e:
            raise RepositoryException(f"Database connection error: {e}")
        finally:
            if conn:
                conn.close()
    
    @contextmanager
    def get_cursor(self):
        """Get database cursor context manager"""
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            try:
                yield cursor
                conn.commit()
            except Exception as e:
                conn.rollback()
                raise RepositoryException(f"Database operation error: {e}")


class SymbolRepository(IRepository):
    """Repository for Symbol entities"""
    
    def __init__(self, db_connection: DatabaseConnection):
        self.db = db_connection
    
    def find_by_id(self, symbol_id: str) -> Optional[Symbol]:
        """Find symbol by ID"""
        with self.db.get_cursor() as cursor:
            cursor.execute("""
                SELECT * FROM symbols WHERE id = %s
            """, (symbol_id,))
            result = cursor.fetchone()
            
            if result:
                return self._map_to_symbol(result)
            return None
    
    def find_all(self, market_type: MarketType = None) -> List[Symbol]:
        """Find all symbols with optional market type filter"""
        with self.db.get_cursor() as cursor:
            query = "SELECT * FROM symbols"
            params = []
            
            if market_type:
                query += " WHERE market_type = %s"
                params.append(market_type.value)
            
            query += " ORDER BY name"
            cursor.execute(query, params)
            results = cursor.fetchall()
            
            return [self._map_to_symbol(row) for row in results]
    
    def save(self, symbol: Symbol) -> Symbol:
        """Save or update symbol"""
        with self.db.get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO symbols (id, name, market_type, exchange, description)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    market_type = EXCLUDED.market_type,
                    exchange = EXCLUDED.exchange,
                    description = EXCLUDED.description
                RETURNING *
            """, (
                symbol.id,
                symbol.name,
                symbol.market_type.value,
                symbol.exchange,
                symbol.description
            ))
            result = cursor.fetchone()
            return self._map_to_symbol(result)
    
    def delete(self, symbol_id: str) -> bool:
        """Delete symbol by ID"""
        with self.db.get_cursor() as cursor:
            cursor.execute("""
                DELETE FROM symbols WHERE id = %s
            """, (symbol_id,))
            return cursor.rowcount > 0
    
    def _map_to_symbol(self, row: Dict) -> Symbol:
        """Map database row to Symbol entity"""
        return Symbol(
            id=row['id'],
            name=row['name'],
            market_type=MarketType(row['market_type']),
            exchange=row.get('exchange'),
            description=row.get('description')
        )


class OHLCVRepository(IRepository):
    """Repository for OHLCV data"""
    
    def __init__(self, db_connection: DatabaseConnection):
        self.db = db_connection
    
    def find_by_id(self, id: Any) -> Optional[OHLCV]:
        """Find single OHLCV data point"""
        # Not typically used for OHLCV data
        raise NotImplementedError("Use find_by_symbol_and_timeframe instead")
    
    def find_all(self, **filters) -> List[OHLCV]:
        """Find all OHLCV data with filters"""
        return self.find_by_symbol_and_timeframe(
            filters.get('symbol_id'),
            filters.get('timeframe', TimeFrame.D1),
            filters.get('limit', 1000)
        )
    
    def find_by_symbol_and_timeframe(
        self,
        symbol_id: str,
        timeframe: TimeFrame,
        limit: int = 1000,
        start_date: datetime = None,
        end_date: datetime = None,
        data_type: int = None
    ) -> List[OHLCV]:
        """Find OHLCV data for symbol and timeframe"""
        with self.db.get_cursor() as cursor:
            # Determine table based on market type
            table = self._get_table_for_timeframe(timeframe)
            
            query = f"""
                SELECT timestamp, open, high, low, close, volume, data_type
                FROM {table}
                WHERE symbol_id = %s
            """
            params = [symbol_id]
            
            if data_type is not None:
                query += " AND data_type = %s"
                params.append(data_type)
            
            if start_date:
                query += " AND timestamp >= %s"
                params.append(start_date)
            
            if end_date:
                query += " AND timestamp <= %s"
                params.append(end_date)
            
            query += " ORDER BY timestamp DESC LIMIT %s"
            params.append(limit)
            
            cursor.execute(query, params)
            results = cursor.fetchall()
            
            return [self._map_to_ohlcv(row) for row in reversed(results)]
    
    def save(self, entity: OHLCV) -> OHLCV:
        """Save OHLCV data"""
        # Implementation depends on your data ingestion strategy
        raise NotImplementedError("OHLCV data is typically batch imported")
    
    def delete(self, id: Any) -> bool:
        """Delete OHLCV data"""
        # Implementation depends on your data management strategy
        raise NotImplementedError("OHLCV data deletion requires special handling")
    
    def get_latest(self, symbol_id: str, data_type: int = None) -> Optional[OHLCV]:
        """Get latest OHLCV data for symbol"""
        with self.db.get_cursor() as cursor:
            query = """
                SELECT timestamp, open, high, low, close, volume, data_type
                FROM ohlcv_1d
                WHERE symbol_id = %s
            """
            params = [symbol_id]
            
            if data_type is not None:
                query += " AND data_type = %s"
                params.append(data_type)
            
            query += " ORDER BY timestamp DESC LIMIT 1"
            
            cursor.execute(query, params)
            result = cursor.fetchone()
            
            if result:
                return self._map_to_ohlcv(result)
            return None
    
    def get_ohlcv_data(self, symbol_id: str, start_date: datetime, end_date: datetime, 
                       timeframe: str = "1D", data_type: int = None, limit: int = None) -> List[Dict]:
        """Get OHLCV data with data type support (for PriceDataManager)"""
        with self.db.get_cursor() as cursor:
            # Map timeframe string to TimeFrame enum
            timeframe_map = {
                "1M": TimeFrame.M1, "5M": TimeFrame.M5, "15M": TimeFrame.M15, "30M": TimeFrame.M30,
                "1H": TimeFrame.H1, "4H": TimeFrame.H4, "1D": TimeFrame.D1, 
                "1W": TimeFrame.W1, "1Mo": TimeFrame.MN1
            }
            
            tf_enum = timeframe_map.get(timeframe, TimeFrame.D1)
            table = self._get_table_for_timeframe(tf_enum)
            
            query = f"""
                SELECT timestamp, open, high, low, close, volume, data_type
                FROM {table}
                WHERE symbol_id = %s AND timestamp >= %s AND timestamp <= %s
            """
            params = [symbol_id, start_date, end_date]
            
            if data_type is not None:
                query += " AND data_type = %s"
                params.append(data_type)
            
            query += " ORDER BY timestamp ASC"
            
            if limit:
                query += " LIMIT %s"
                params.append(limit)
            
            cursor.execute(query, params)
            return cursor.fetchall()
    
    def _get_table_for_timeframe(self, timeframe: TimeFrame) -> str:
        """Get table name for timeframe"""
        table_map = {
            TimeFrame.M1: "ohlcv_1m",
            TimeFrame.M5: "ohlcv_5m",
            TimeFrame.M15: "ohlcv_15m",
            TimeFrame.M30: "ohlcv_30m",
            TimeFrame.H1: "ohlcv_1h",
            TimeFrame.H4: "ohlcv_4h",
            TimeFrame.D1: "ohlcv_1d",
            TimeFrame.W1: "ohlcv_1w",
            TimeFrame.MN1: "ohlcv_1mo"
        }
        return table_map.get(timeframe, "ohlcv_1d")
    
    def _map_to_ohlcv(self, row: Dict) -> OHLCV:
        """Map database row to OHLCV entity"""
        from ..domain.models import DataType
        
        # Handle data_type field if present, default to UNADJUSTED
        data_type_value = row.get('data_type', 2)  # Default to UNADJUSTED (2)
        data_type = DataType(data_type_value)
        
        return OHLCV(
            timestamp=row['timestamp'],
            open=float(row['open']),
            high=float(row['high']),
            low=float(row['low']),
            close=float(row['close']),
            volume=float(row['volume']),
            data_type=data_type
        )


class MarketStatisticsRepository:
    """Repository for market statistics"""
    
    def __init__(self, db_connection: DatabaseConnection, ohlcv_repo: OHLCVRepository):
        self.db = db_connection
        self.ohlcv_repo = ohlcv_repo
    
    def get_statistics(self, symbol: Symbol) -> Optional[MarketStatistics]:
        """Get market statistics for symbol"""
        with self.db.get_cursor() as cursor:
            # Get latest data
            latest = self.ohlcv_repo.get_latest(symbol.id)
            if not latest:
                return None
            
            # Get previous close for change calculation
            cursor.execute("""
                SELECT close FROM ohlcv_1d
                WHERE symbol_id = %s AND timestamp < %s
                ORDER BY timestamp DESC
                LIMIT 1
            """, (symbol.id, latest.timestamp))
            prev_result = cursor.fetchone()
            prev_close = float(prev_result['close']) if prev_result else latest.open
            
            # Get 52-week high/low
            one_year_ago = latest.timestamp - timedelta(days=365)
            cursor.execute("""
                SELECT MAX(high) as high_52w, MIN(low) as low_52w
                FROM ohlcv_1d
                WHERE symbol_id = %s AND timestamp >= %s
            """, (symbol.id, one_year_ago))
            range_result = cursor.fetchone()
            
            # Calculate VWAP
            cursor.execute("""
                SELECT 
                    SUM(close * volume) / NULLIF(SUM(volume), 0) as vwap
                FROM ohlcv_1d
                WHERE symbol_id = %s 
                    AND timestamp >= %s::date
            """, (symbol.id, latest.timestamp.date()))
            vwap_result = cursor.fetchone()
            
            # Create statistics
            change = latest.close - prev_close
            change_pct = (change / prev_close * 100) if prev_close != 0 else 0
            
            return MarketStatistics(
                symbol=symbol,
                timestamp=latest.timestamp,
                open=latest.open,
                high=latest.high,
                low=latest.low,
                close=latest.close,
                volume=latest.volume,
                vwap=float(vwap_result['vwap']) if vwap_result['vwap'] else latest.close,
                change=change,
                change_percentage=change_pct,
                high_52w=float(range_result['high_52w']) if range_result else latest.high,
                low_52w=float(range_result['low_52w']) if range_result else latest.low
            )


class WatchlistRepository:
    """Repository for watchlist management"""
    
    def __init__(self, db_connection: DatabaseConnection):
        self.db = db_connection
    
    def add_to_watchlist(self, user_id: str, symbol_id: str, alert_price: float = None, notes: str = None):
        """Add symbol to user's watchlist"""
        with self.db.get_cursor() as cursor:
            cursor.execute("""
                INSERT INTO watchlist (user_id, symbol_id, alert_price, notes, added_at)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (user_id, symbol_id) DO UPDATE SET
                    alert_price = EXCLUDED.alert_price,
                    notes = EXCLUDED.notes
            """, (user_id, symbol_id, alert_price, notes, datetime.now()))
    
    def remove_from_watchlist(self, user_id: str, symbol_id: str):
        """Remove symbol from user's watchlist"""
        with self.db.get_cursor() as cursor:
            cursor.execute("""
                DELETE FROM watchlist 
                WHERE user_id = %s AND symbol_id = %s
            """, (user_id, symbol_id))
    
    def get_watchlist(self, user_id: str) -> List[Dict]:
        """Get user's watchlist"""
        with self.db.get_cursor() as cursor:
            cursor.execute("""
                SELECT w.*, s.name, s.market_type
                FROM watchlist w
                JOIN symbols s ON w.symbol_id = s.id
                WHERE w.user_id = %s
                ORDER BY w.added_at DESC
            """, (user_id,))
            return cursor.fetchall()