import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
import logging
from iran_market_platform.config.config import Config
from utils.date_utils import normalize_persian_date

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self):
        self.config = Config()
        
    @contextmanager
    def get_connection(self):
        """Context manager for database connections"""
        conn = None
        try:
            conn = psycopg2.connect(
                host=self.config.DB_HOST,
                port=self.config.DB_PORT,
                database=self.config.DB_NAME,
                user=self.config.DB_USER,
                password=self.config.DB_PASSWORD
            )
            yield conn
            conn.commit()
        except Exception as e:
            if conn:
                conn.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    def execute_sql_file(self, filepath):
        """Execute SQL file"""
        with open(filepath, 'r', encoding='utf-8') as f:
            sql = f.read()
        
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(sql)
                logger.info(f"Successfully executed SQL file: {filepath}")
    
    def insert_stock_symbol(self, symbol_data):
        """Insert or update stock symbol"""
        query = """
            INSERT INTO stock_symbols (
                symbol, company_name, isin, internal_id, 
                industry_group, industry_group_id, total_shares, 
                base_volume, market_value, eps, pe_ratio
            ) VALUES (
                %(l18)s, %(l30)s, %(isin)s, %(id)s,
                %(cs)s, %(cs_id)s, %(z)s,
                %(bvol)s, %(mv)s, %(eps)s, %(pe)s
            )
            ON CONFLICT (symbol) DO UPDATE SET
                company_name = EXCLUDED.company_name,
                isin = EXCLUDED.isin,
                internal_id = EXCLUDED.internal_id,
                industry_group = EXCLUDED.industry_group,
                industry_group_id = EXCLUDED.industry_group_id,
                total_shares = EXCLUDED.total_shares,
                base_volume = EXCLUDED.base_volume,
                market_value = EXCLUDED.market_value,
                eps = EXCLUDED.eps,
                pe_ratio = EXCLUDED.pe_ratio,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id;
        """
        
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query, symbol_data)
                return cursor.fetchone()[0]
    
    def insert_stock_price(self, symbol_id, price_data):
        """Insert stock price data"""
        query = """
            INSERT INTO stock_prices (
                symbol_id, time_recorded, threshold_min, threshold_max,
                min_price, max_price, yesterday_price, first_price,
                last_price, last_price_change, last_price_change_percent,
                closing_price, closing_price_change, closing_price_change_percent,
                trade_count, trade_volume, trade_value,
                buy_count_individual, buy_count_legal,
                sell_count_individual, sell_count_legal,
                buy_volume_individual, buy_volume_legal,
                sell_volume_individual, sell_volume_legal
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s
            );
        """
        
        values = (
            symbol_id,
            price_data.get('time'),
            price_data.get('tmin'),
            price_data.get('tmax'),
            price_data.get('pmin'),
            price_data.get('pmax'),
            price_data.get('py'),
            price_data.get('pf'),
            price_data.get('pl'),
            price_data.get('plc'),
            price_data.get('plp'),
            price_data.get('pc'),
            price_data.get('pcc'),
            price_data.get('pcp'),
            price_data.get('tno'),
            price_data.get('tvol'),
            price_data.get('tval'),
            price_data.get('Buy_CountI'),
            price_data.get('Buy_CountN'),
            price_data.get('Sell_CountI'),
            price_data.get('Sell_CountN'),
            price_data.get('Buy_I_Volume'),
            price_data.get('Buy_N_Volume'),
            price_data.get('Sell_I_Volume'),
            price_data.get('Sell_N_Volume')
        )
        
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query, values)
    
    def insert_order_book(self, symbol_id, order_data):
        """Insert order book data"""
        query = """
            INSERT INTO order_book (
                symbol_id, side, level, count, volume, price
            ) VALUES (%s, %s, %s, %s, %s, %s);
        """
        
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                # Insert buy orders
                for i in range(1, 6):
                    if f'zd{i}' in order_data and f'qd{i}' in order_data and f'pd{i}' in order_data:
                        cursor.execute(query, (
                            symbol_id, 'buy', i,
                            order_data.get(f'zd{i}'),
                            order_data.get(f'qd{i}'),
                            order_data.get(f'pd{i}')
                        ))
                
                # Insert sell orders
                for i in range(1, 6):
                    if f'zo{i}' in order_data and f'qo{i}' in order_data and f'po{i}' in order_data:
                        cursor.execute(query, (
                            symbol_id, 'sell', i,
                            order_data.get(f'zo{i}'),
                            order_data.get(f'qo{i}'),
                            order_data.get(f'po{i}')
                        ))
    
    def insert_candlestick(self, symbol_id, candle_data):
        """Insert candlestick data"""
        # Validate and normalize date
        date_str = candle_data.get('date')
        normalized_date = normalize_persian_date(date_str)
        
        if not normalized_date:
            logger.warning(f"Invalid date {date_str}, skipping candlestick record")
            return
        
        query = """
            INSERT INTO candlestick_data (
                symbol_id, data_type, date, time,
                open_price, high_price, low_price, close_price, volume
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (symbol_id, data_type, date, time) DO UPDATE SET
                open_price = EXCLUDED.open_price,
                high_price = EXCLUDED.high_price,
                low_price = EXCLUDED.low_price,
                close_price = EXCLUDED.close_price,
                volume = EXCLUDED.volume;
        """
        
        values = (
            symbol_id,
            candle_data.get('type'),
            normalized_date,
            candle_data.get('time'),
            candle_data.get('open'),
            candle_data.get('high'),
            candle_data.get('low'),
            candle_data.get('close'),
            candle_data.get('volume')
        )
        
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                try:
                    cursor.execute(query, values)
                except Exception as e:
                    # Skip dates that PostgreSQL can't handle (Persian dates that don't convert to valid Gregorian)
                    logger.debug(f"Skipping problematic candlestick date {normalized_date} for symbol {symbol_id}: {e}")
                    return
    
    def insert_currency(self, currency_data):
        """Insert or update currency"""
        query = """
            INSERT INTO currencies (
                symbol, name, sign, unit, icon_base_url, icon_path
            ) VALUES (
                %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (symbol) DO UPDATE SET
                name = EXCLUDED.name,
                sign = EXCLUDED.sign,
                unit = EXCLUDED.unit,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id;
        """
        
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query, (
                    currency_data.get('symbol'),
                    currency_data.get('name'),  # Persian name
                    currency_data.get('name_en', ''),  # English name as sign
                    currency_data.get('unit'),
                    None,  # icon_base_url
                    None   # icon_path
                ))
                return cursor.fetchone()[0]
    
    def insert_currency_history(self, currency_id, history_data):
        """Insert currency historical data"""
        # Validate and normalize date
        date_str = history_data.get('date', '')
        normalized_date = normalize_persian_date(date_str)
        
        if not normalized_date:
            logger.warning(f"Invalid date {date_str}, skipping currency history record")
            return
        
        query = """
            INSERT INTO currency_history (
                currency_id, date, open_price, high_price, low_price, close_price
            ) VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (currency_id, date) DO UPDATE SET
                open_price = EXCLUDED.open_price,
                high_price = EXCLUDED.high_price,
                low_price = EXCLUDED.low_price,
                close_price = EXCLUDED.close_price;
        """
        
        values = (
            currency_id,
            normalized_date,
            history_data.get('open'),
            history_data.get('high'),
            history_data.get('low'),
            history_data.get('close')
        )
        
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                try:
                    cursor.execute(query, values)
                except Exception as e:
                    # Skip dates that PostgreSQL can't handle (Persian dates that don't convert to valid Gregorian)
                    logger.debug(f"Skipping problematic date {normalized_date}: {e}")
                    return
    
    def get_symbol_id(self, symbol):
        """Get symbol ID from database"""
        query = "SELECT id FROM stock_symbols WHERE symbol = %s;"
        
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query, (symbol,))
                result = cursor.fetchone()
                return result[0] if result else None
    
    def get_currency_id(self, symbol):
        """Get currency ID from database"""
        query = "SELECT id FROM currencies WHERE symbol = %s;"
        
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(query, (symbol,))
                result = cursor.fetchone()
                return result[0] if result else None