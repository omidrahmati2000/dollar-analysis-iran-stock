"""
Clean database migration - drops all tables and recreates them
"""
import logging
from database.db_manager import DatabaseManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def clean_migrate_database():
    """Drop all tables and recreate fresh database"""
    db = DatabaseManager()
    
    logger.info("Starting clean database migration...")
    
    # Drop all tables in correct order (respecting foreign keys)
    drop_queries = [
        "DROP TABLE IF EXISTS currency_history CASCADE;",
        "DROP TABLE IF EXISTS candlestick_data CASCADE;", 
        "DROP TABLE IF EXISTS order_book CASCADE;",
        "DROP TABLE IF EXISTS stock_prices CASCADE;",
        "DROP TABLE IF EXISTS stock_symbols CASCADE;",
        "DROP TABLE IF EXISTS currencies CASCADE;"
    ]
    
    logger.info("Dropping existing tables...")
    with db.get_connection() as conn:
        with conn.cursor() as cursor:
            for query in drop_queries:
                try:
                    cursor.execute(query)
                    table_name = query.split()[4] if len(query.split()) > 4 else "unknown"
                    logger.info(f"✓ Dropped table: {table_name}")
                except Exception as e:
                    logger.warning(f"Warning dropping table: {e}")
    
    logger.info("Creating fresh tables...")
    try:
        db.execute_sql_file('database/create_tables.sql')
        logger.info("✓ Fresh database schema created successfully")
    except Exception as e:
        logger.error(f"Error creating tables: {e}")
        return False
    
    # Verify tables were created
    logger.info("Verifying table creation...")
    with db.get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT tablename 
                FROM pg_tables 
                WHERE schemaname = 'public' 
                ORDER BY tablename;
            """)
            tables = [row[0] for row in cursor.fetchall()]
            logger.info(f"✓ Created tables: {', '.join(tables)}")
    
    logger.info("✅ Clean database migration completed successfully!")
    return True

if __name__ == "__main__":
    clean_migrate_database()