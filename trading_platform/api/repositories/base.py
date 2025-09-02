"""
Base Repository with common database operations
"""
from typing import Optional, Dict, Any
from contextlib import contextmanager

# Optional PostgreSQL support
try:
    import psycopg2
    import psycopg2.extras
    HAS_POSTGRES = True
except ImportError:
    HAS_POSTGRES = False
    print("Warning: PostgreSQL support not available. Install with: pip install psycopg2-binary")


class BaseRepository:
    """Base repository with database connection management"""
    
    def __init__(self, db_config: Dict[str, Any]):
        self.db_config = db_config
        
    @contextmanager
    def get_connection(self):
        """Context manager for database connections"""
        if not HAS_POSTGRES:
            raise ImportError("PostgreSQL support not available. Install with: pip install psycopg2-binary")
        
        conn = None
        try:
            conn = psycopg2.connect(**self.db_config)
            yield conn
        except psycopg2.Error as e:
            if conn:
                conn.rollback()
            raise e
        finally:
            if conn:
                conn.close()
    
    @contextmanager
    def get_cursor(self, connection=None):
        """Context manager for database cursors"""
        if not HAS_POSTGRES:
            raise ImportError("PostgreSQL support not available. Install with: pip install psycopg2-binary")
            
        if connection:
            cursor = connection.cursor(cursor_factory=psycopg2.extras.DictCursor)
            try:
                yield cursor
            finally:
                cursor.close()
        else:
            with self.get_connection() as conn:
                cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
                try:
                    yield cursor
                    conn.commit()
                finally:
                    cursor.close()
    
    def execute_query(self, query: str, params: tuple = None) -> list:
        """Execute a SELECT query and return results"""
        with self.get_cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchall()
    
    def execute_one(self, query: str, params: tuple = None) -> Optional[dict]:
        """Execute a SELECT query and return single result"""
        with self.get_cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchone()
    
    def execute_update(self, query: str, params: tuple = None) -> int:
        """Execute an UPDATE/INSERT/DELETE query and return affected rows"""
        with self.get_cursor() as cursor:
            cursor.execute(query, params)
            return cursor.rowcount
    
    def test_connection(self) -> bool:
        """Test if database connection works"""
        if not HAS_POSTGRES:
            return False
        try:
            with self.get_connection() as conn:
                return conn is not None
        except:
            return False