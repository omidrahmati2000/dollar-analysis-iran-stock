"""
Enhanced Candlestick Data Fetcher with date range and intelligent sync support
"""
import logging
import time
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import requests
import json
from iran_market_platform.config.config import Config

logger = logging.getLogger(__name__)


class CandlestickFetcher:
    """Fetcher for candlestick data with intelligent missing data detection"""
    
    def __init__(self, db_manager):
        self.db = db_manager
        self.config = Config()
        api_urls = self.config.get_api_urls()
        self.candlestick_api_url = api_urls['tsetmc_candlestick']  # History candle of each symbol
        self.session = requests.Session()
        self.session.headers.update(
            self.config.request_headers
        )
        # Disable SSL verification for API that has SSL issues
        self.session.verify = False
        # Suppress SSL warnings
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    def fetch_candlesticks(self, symbol: str, stock_id: int, data_type: int = 2) -> bool:
        """
        Fetch all candlestick data for a symbol
        
        Args:
            symbol: Stock symbol
            stock_id: Stock ID in database
            data_type: 2 for unadjusted, 3 for adjusted
        """
        try:
            logger.debug(f"Fetching candlesticks for {symbol} (type={data_type})")
            
            # Use the candlestick API with proper parameters
            params = {
                'key': self.config.BRSAPI_PRO_KEY,
                'l18': symbol,
                'type': data_type
            }
            
            response = self.session.get(self.candlestick_api_url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            # Different response keys for different data types
            if data_type == 2:
                candle_key = 'candle_daily'
            elif data_type == 3:
                candle_key = 'candle_daily_adjusted'
            else:
                candle_key = 'candle_daily'  # Default fallback
            
            if not data or candle_key not in data:
                logger.warning(f"No candlestick data returned for {symbol} (type={data_type}, expected key='{candle_key}')")
                return False
            
            # Save to database
            return self._save_candlesticks(stock_id, data[candle_key], data_type)
            
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed for {symbol}: {e}")
            return False
        except Exception as e:
            logger.error(f"Failed to fetch candlesticks for {symbol}: {e}")
            return False
    
    def fetch_candlestick_range(self, symbol: str, stock_id: int, 
                               start_date: datetime, end_date: datetime, 
                               data_type: int = 2) -> bool:
        """
        Fetch candlestick data for a specific date range
        
        Args:
            symbol: Stock symbol
            stock_id: Stock ID in database
            start_date: Start date
            end_date: End date
            data_type: 2 for unadjusted, 3 for adjusted
        """
        try:
            logger.debug(f"Fetching candlesticks for {symbol} from {start_date} to {end_date} (type={data_type})")
            
            # Check for existing data
            missing_dates = self._get_missing_dates(stock_id, start_date, end_date, data_type)
            
            if not missing_dates:
                logger.info(f"No missing dates for {symbol} (type={data_type})")
                return True
            
            logger.info(f"Found {len(missing_dates)} missing dates for {symbol} (type={data_type})")
            
            # Fetch data for missing dates
            candles = []
            for date in missing_dates:
                try:
                    # Use candlestick API with date parameter  
                    params = {
                        'key': self.config.BRSAPI_PRO_KEY,
                        'l18': symbol,
                        'type': data_type,
                        'date': date.strftime('%Y-%m-%d')
                    }
                    
                    response = self.session.get(self.candlestick_api_url, params=params, timeout=30)
                    
                    if response.status_code == 404:
                        logger.debug(f"No data for {symbol} on {date}")
                        continue
                    
                    response.raise_for_status()
                    candle_data = response.json()
                    
                    if candle_data:
                        candles.append(candle_data)
                    
                    # Small delay to avoid rate limiting
                    time.sleep(0.1)
                    
                except requests.exceptions.RequestException as e:
                    logger.warning(f"Failed to fetch {symbol} for {date}: {e}")
                    continue
            
            if candles:
                return self._save_candlesticks(stock_id, candles, data_type)
            
            return True  # No error, just no data
            
        except Exception as e:
            logger.error(f"Failed to fetch candlestick range for {symbol}: {e}")
            return False
    
    def _get_missing_dates(self, stock_id: int, start_date: datetime, 
                          end_date: datetime, data_type: int) -> List[datetime]:
        """Get list of missing dates for a stock and data type"""
        try:
            with self.db.get_connection() as conn:
                with conn.cursor() as cur:
                    # Get existing dates
                    cur.execute("""
                        SELECT DISTINCT date 
                        FROM candlestick_data 
                        WHERE symbol_id = %s 
                        AND data_type = %s
                        AND date >= %s 
                        AND date <= %s
                        ORDER BY date
                    """, (stock_id, data_type, start_date, end_date))
                    
                    existing_dates = {row[0] for row in cur.fetchall()}
                    
                    # Generate all business days in range
                    all_dates = []
                    current = start_date
                    while current <= end_date:
                        # Skip weekends (Thursday=3, Friday=4 in Iran)
                        if current.weekday() not in [3, 4]:
                            all_dates.append(current)
                        current += timedelta(days=1)
                    
                    # Find missing dates
                    missing_dates = [d for d in all_dates if d not in existing_dates]
                    return missing_dates
                    
        except Exception as e:
            logger.error(f"Failed to get missing dates: {e}")
            return []
    
    def get_symbols_needing_sync(self, target_dates: List[str], data_types: List[int]) -> List[Dict]:
        """
        Get symbols that need complete sync based on missing target dates
        Returns list of {'stock_id', 'symbol', 'name', 'data_type'} that need full sync
        """
        try:
            with self.db.get_connection() as conn:
                with conn.cursor() as cur:
                    symbols_to_sync = []
                    
                    # Get all active symbols
                    cur.execute("""
                        SELECT id, symbol, company_name as name 
                        FROM stock_symbols 
                        ORDER BY symbol
                    """)
                    all_symbols = cur.fetchall()
                    
                    for stock_id, symbol, name in all_symbols:
                        for data_type in data_types:
                            # Check if any target dates are missing for this symbol+data_type
                            placeholders = ','.join(['%s'] * len(target_dates))
                            cur.execute(f"""
                                SELECT COUNT(*) 
                                FROM candlestick_data 
                                WHERE symbol_id = %s 
                                AND data_type = %s 
                                AND date::text IN ({placeholders})
                            """, [stock_id, data_type] + target_dates)
                            
                            existing_count = cur.fetchone()[0]
                            
                            # If any dates are missing, we need to sync this symbol completely
                            if existing_count < len(target_dates):
                                symbols_to_sync.append({
                                    'stock_id': stock_id,
                                    'symbol': symbol, 
                                    'name': name,
                                    'data_type': data_type
                                })
                                logger.debug(f"{symbol} (type={data_type}): {existing_count}/{len(target_dates)} dates exist - needs sync")
                    
                    return symbols_to_sync
                    
        except Exception as e:
            logger.error(f"Failed to check symbols needing sync: {e}")
            return []
    
    def get_all_active_symbols(self) -> List[Dict]:
        """Get all active symbols for full sync"""
        try:
            with self.db.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT id, symbol, company_name as name 
                        FROM stock_symbols 
                        ORDER BY symbol
                    """)
                    symbols = cur.fetchall()
                    
                    # Create combinations for all data types
                    result = []
                    for stock_id, symbol, name in symbols:
                        for data_type in [2, 3]:  # Both data types
                            result.append({
                                'stock_id': stock_id,
                                'symbol': symbol,
                                'name': name,
                                'data_type': data_type
                            })
                    
                    return result
                    
        except Exception as e:
            logger.error(f"Failed to get active symbols: {e}")
            return []

    def _save_candlesticks(self, stock_id: int, candles: List[Dict], data_type: int) -> bool:
        """
        Save candlestick data to database with duplicate prevention
        Uses UNIQUE constraint on (stock_id, date, data_type)
        """
        try:
            with self.db.get_connection() as conn:
                with conn.cursor() as cur:
                    saved_count = 0
                    
                    for candle in candles:
                        try:
                            # Handle Persian date - map to valid Gregorian date for storage
                            if 'date' in candle:
                                persian_date = candle['date']  # Persian date like '1404-04-31'
                                try:
                                    year, month, day = map(int, persian_date.split('-'))
                                    
                                    # Map Persian calendar days to valid Gregorian calendar days
                                    # Persian months 1-6 have 31 days, but not all Gregorian months do
                                    max_days_in_gregorian_month = {
                                        1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30,
                                        7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31
                                    }
                                    
                                    # Adjust day if it exceeds the Gregorian month limit
                                    max_day = max_days_in_gregorian_month.get(month, 31)
                                    adjusted_day = min(day, max_day)
                                    
                                    # Create the adjusted date string
                                    date = f"{year:04d}-{month:02d}-{adjusted_day:02d}"
                                    
                                    if adjusted_day != day:
                                        logger.debug(f"Adjusted Persian date {persian_date} to {date} for Gregorian compatibility")
                                        
                                except (ValueError, IndexError) as e:
                                    logger.warning(f"Failed to parse Persian date {persian_date}: {e}")
                                    continue
                                    
                            elif 'timestamp' in candle:
                                date = datetime.fromtimestamp(candle['timestamp']).date()
                            else:
                                continue
                            
                            # Insert with duplicate prevention
                            # The UNIQUE constraint on (stock_id, date, data_type) prevents duplicates
                            # Date is stored in Persian format (e.g., 1404-06-09)
                            cur.execute("""
                                INSERT INTO candlestick_data (
                                    symbol_id, date, time, open_price, high_price, 
                                    low_price, close_price, volume, data_type
                                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                                ON CONFLICT (symbol_id, data_type, date, time) 
                                DO UPDATE SET
                                    open_price = EXCLUDED.open_price,
                                    high_price = EXCLUDED.high_price,
                                    low_price = EXCLUDED.low_price,
                                    close_price = EXCLUDED.close_price,
                                    volume = EXCLUDED.volume
                            """, (
                                stock_id,
                                date,
                                candle.get('time', '00:00:00'),  # Default time if not provided
                                candle.get('open', 0),
                                candle.get('high', 0),
                                candle.get('low', 0),
                                candle.get('close', 0),
                                candle.get('volume', 0),
                                data_type
                            ))
                            
                            saved_count += 1
                            
                        except Exception as e:
                            logger.warning(f"Failed to save candle: {e}")
                            continue
                    
                    conn.commit()
                    logger.info(f"Saved {saved_count} candlesticks (duplicates handled by constraint)")
                    return saved_count > 0
                    
        except Exception as e:
            logger.error(f"Failed to save candlesticks: {e}")
            return False