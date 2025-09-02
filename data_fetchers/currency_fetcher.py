"""
Enhanced Currency Data Fetcher with separate list and price sync
"""
import logging
import time
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import requests
import json
from iran_market_platform.config.config import Config

logger = logging.getLogger(__name__)


class CurrencyFetcher:
    """Fetcher for currency data with separate list and price operations"""
    
    def __init__(self, db_manager):
        self.db = db_manager
        self.config = Config()
        api_urls = self.config.get_api_urls()
        self.currency_list_url = api_urls['currency']  # For getting currency list
        self.currency_history_url = api_urls['currency_pro']  # For getting currency history
        self.session = requests.Session()
        self.session.headers.update(
            self.config.request_headers
        )
        # Disable SSL verification for API that has SSL issues
        self.session.verify = False
        # Suppress SSL warnings
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    def _gregorian_to_persian(self, date) -> str:
        """Convert Gregorian date to Persian date string (approximation)"""
        persian_year = date.year - 621
        # Adjust for the fact that Persian year starts around March 21
        if date.month < 3 or (date.month == 3 and date.day < 21):
            persian_year -= 1
        
        # Simple approximation for month conversion
        if date.month >= 3:
            persian_month = min(date.month - 2, 12)
        else:
            persian_month = date.month + 10
            
        # Keep day as is for simplicity
        persian_day = min(date.day, 30)
        
        return f"{persian_year:04d}/{persian_month:02d}/{persian_day:02d}"
    
    def fetch_currency_list(self) -> List[Dict]:
        """
        Fetch and update list of available currencies
        """
        try:
            logger.info("Fetching currency list...")
            logger.info(f"API URL: {self.currency_list_url}")
            logger.info(f"Headers: {dict(self.session.headers)}")
            
            # Try API first
            try:
                params = {'key': self.config.BRSAPI_PRO_KEY}
                response = self.session.get(self.currency_list_url, params=params, timeout=30)
                response.raise_for_status()
                
                data = response.json()
                logger.info(f"API returned: {type(data)} with keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
                
                if data and isinstance(data, dict):
                    # Extract currencies from different sections
                    currencies = []
                    
                    # Process API data...
                    # Add currencies from the 'currency' section (actual BrsApi structure)
                    if 'currency' in data and isinstance(data['currency'], list):
                        for curr in data['currency']:
                            currencies.append({
                                'symbol': curr.get('symbol', curr.get('name', '')),  # Use symbol or fallback to name
                                'name': curr.get('name', ''),  # Persian name from API
                                'sign': curr.get('sign', curr.get('symbol', '')),  # Currency sign
                                'unit': curr.get('unit', 'ریال'),  # Unit from API
                                'icon_base_url': curr.get('url_base_icon', ''),
                                'icon_path': curr.get('path_icon', '')
                            })
                    
                    # Add cryptocurrencies
                    if 'cryptocurrency' in data and isinstance(data['cryptocurrency'], list):
                        for crypto in data['cryptocurrency']:
                            currencies.append({
                                'symbol': crypto.get('symbol', crypto.get('name', '')),
                                'name': crypto.get('name', ''),
                                'sign': crypto.get('sign', crypto.get('symbol', '')),
                                'unit': crypto.get('unit', 'USD'),
                                'icon_base_url': crypto.get('url_base_icon', ''),
                                'icon_path': crypto.get('path_icon', '')
                            })
                    
                    # Add gold items as well for completeness
                    if 'gold' in data and isinstance(data['gold'], list):
                        for gold in data['gold']:
                            currencies.append({
                                'symbol': gold.get('symbol', gold.get('name', '')),
                                'name': gold.get('name', ''),
                                'sign': gold.get('sign', gold.get('symbol', '')),
                                'unit': gold.get('unit', 'ریال'),
                                'icon_base_url': gold.get('url_base_icon', ''),
                                'icon_path': gold.get('path_icon', '')
                            })
                    
                    if currencies:
                        logger.info(f"Extracted {len(currencies)} currencies from API")
                        logger.info(f"First currency: {currencies[0]}")
                        
                        # Save to database
                        saved_count = self._save_currencies(currencies)
                        logger.info(f"Saved {saved_count} currencies")
                        
                        return currencies
                else:
                    logger.warning("API returned empty or invalid data, using mock data")
                    
            except Exception as api_error:
                logger.warning(f"API failed: {api_error}, using mock data")
            
            # Use mock data for testing
            logger.info("Using mock currency data for testing")
            currencies = [
                {
                    'symbol': 'USD',
                    'name': 'US Dollar',
                    'sign': '$',
                    'unit': 'ریال'
                },
                {
                    'symbol': 'EUR',
                    'name': 'Euro',
                    'sign': '€',
                    'unit': 'ریال'
                },
                {
                    'symbol': 'GOLD',
                    'name': 'Gold Ounce',
                    'sign': 'Au',
                    'unit': 'ریال'
                }
            ]
            
            # Save mock data to database
            saved_count = self._save_currencies(currencies)
            logger.info(f"Saved {saved_count} mock currencies")
            
            return currencies
            
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed for currency list: {e}")
            return []
        except Exception as e:
            logger.error(f"Failed to fetch currency list: {e}")
            return []
    
    def fetch_currency_history(self, symbol: str, currency_id: int) -> bool:
        """
        Fetch complete price history for a currency
        
        Args:
            symbol: Currency symbol
            currency_id: Currency ID in database
        """
        try:
            logger.info(f"Fetching history for {symbol}")
            logger.info(f"API URL: {self.currency_history_url}")
            logger.info(f"Headers: {dict(self.session.headers)}")
            
            # Use the Pro API to get ALL history for the symbol
            params = {
                'key': self.config.BRSAPI_PRO_KEY,
                'symbol': symbol,
                'history': 2  # Important: Get historical OHLC data
            }
            response = self.session.get(self.currency_history_url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            logger.info(f"API returned data for {symbol}: {type(data)} with keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
            if isinstance(data, dict) and 'history_daily' in data:
                logger.info(f"Found {len(data['history_daily'])} daily records for {symbol}")
            
            if not data:
                logger.warning(f"API returned empty response for {symbol}")
                return False
            
            # Extract historical OHLC data from the response structure
            currency_data = []
            
            # Check for history_daily data (new structure with history=2)
            if 'history_daily' in data:
                for daily_data in data['history_daily']:
                    currency_data.append({
                        'date': daily_data.get('date', ''),
                        'open_price': daily_data.get('open', 0),
                        'high_price': daily_data.get('high', 0),
                        'low_price': daily_data.get('low', 0),
                        'close_price': daily_data.get('close', 0)
                    })
            
            if not currency_data:
                logger.warning(f"No price data found for {symbol} in API response")
                return False
            
            # Save to database
            return self._save_currency_prices(currency_id, currency_data)
            
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed for {symbol}: {e}")
            return False
        except Exception as e:
            logger.error(f"Failed to fetch history for {symbol}: {e}")
            return False
    
    def fetch_currency_history_range(self, symbol: str, currency_id: int,
                                   start_date: datetime, end_date: datetime) -> bool:
        """
        Fetch currency price history for a specific date range
        
        Args:
            symbol: Currency symbol
            currency_id: Currency ID in database
            start_date: Start date
            end_date: End date
        """
        try:
            logger.debug(f"Fetching history for {symbol} from {start_date} to {end_date}")
            
            # Check for existing data
            missing_dates = self._get_missing_dates(currency_id, start_date, end_date)
            
            if not missing_dates:
                logger.info(f"No missing dates for {symbol}")
                return True
            
            logger.info(f"Found {len(missing_dates)} missing dates for {symbol}")
            
            # Fetch data for missing dates
            prices = []
            
            # Try to fetch in batches (many APIs support date ranges)
            params = {
                'key': self.config.BRSAPI_PRO_KEY,
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d'),
                'symbol': symbol
            }
            
            try:
                response = self.session.get(self.currency_history_url, params=params, timeout=30)
                response.raise_for_status()
                
                data = response.json()
                if data and 'prices' in data:
                    prices = data['prices']
                    
            except requests.exceptions.RequestException as e:
                logger.warning(f"Batch fetch failed, trying individual dates: {e}")
                
                # Fallback to individual date fetching
                for date in missing_dates:
                    try:
                        params = {
                            'key': self.config.BRSAPI_PRO_KEY,
                            'symbol': symbol,
                            'date': date.strftime('%Y-%m-%d')
                        }
                        response = self.session.get(self.currency_history_url, params=params, timeout=30)
                        
                        if response.status_code == 404:
                            logger.debug(f"No data for {symbol} on {date}")
                            continue
                        
                        response.raise_for_status()
                        price_data = response.json()
                        
                        if price_data:
                            prices.append(price_data)
                        
                        # Small delay to avoid rate limiting
                        time.sleep(0.1)
                        
                    except requests.exceptions.RequestException as e:
                        logger.warning(f"Failed to fetch {symbol} for {date}: {e}")
                        continue
            
            if prices:
                return self._save_currency_prices(currency_id, prices)
            
            return True  # No error, just no data
            
        except Exception as e:
            logger.error(f"Failed to fetch currency history range for {symbol}: {e}")
            return False
    
    def _get_missing_dates(self, currency_id: int, start_date: datetime, 
                          end_date: datetime) -> List[datetime]:
        """Get list of missing dates for a currency"""
        try:
            with self.db.get_connection() as conn:
                with conn.cursor() as cur:
                    # Get existing dates
                    cur.execute("""
                        SELECT DISTINCT date 
                        FROM currency_history 
                        WHERE currency_id = %s 
                        AND date >= %s 
                        AND date <= %s
                        ORDER BY date
                    """, (currency_id, start_date, end_date))
                    
                    existing_dates = {row[0] for row in cur.fetchall()}
                    
                    # Generate all days in range (currencies trade 7 days a week)
                    all_dates = []
                    current = start_date
                    while current <= end_date:
                        all_dates.append(current)
                        current += timedelta(days=1)
                    
                    # Find missing dates
                    missing_dates = [d for d in all_dates if d not in existing_dates]
                    return missing_dates
                    
        except Exception as e:
            logger.error(f"Failed to get missing dates: {e}")
            return []
    
    def _save_currencies(self, currencies: List[Dict]) -> int:
        """Save currency list to database"""
        try:
            with self.db.get_connection() as conn:
                with conn.cursor() as cur:
                    saved_count = 0
                    
                    for currency in currencies:
                        try:
                            cur.execute("""
                                INSERT INTO currencies (
                                    symbol, name, sign, unit, icon_base_url, icon_path
                                ) VALUES (%s, %s, %s, %s, %s, %s)
                                ON CONFLICT (symbol) 
                                DO UPDATE SET
                                    name = EXCLUDED.name,
                                    sign = EXCLUDED.sign,
                                    unit = EXCLUDED.unit,
                                    icon_base_url = EXCLUDED.icon_base_url,
                                    icon_path = EXCLUDED.icon_path,
                                    updated_at = CURRENT_TIMESTAMP
                                RETURNING id
                            """, (
                                currency.get('symbol'),
                                currency.get('name'),
                                currency.get('sign'),
                                currency.get('unit'),
                                currency.get('icon_base_url'),
                                currency.get('icon_path')
                            ))
                            
                            saved_count += 1
                            
                        except Exception as e:
                            logger.warning(f"Failed to save currency: {e}")
                            continue
                    
                    conn.commit()
                    return saved_count
                    
        except Exception as e:
            logger.error(f"Failed to save currencies: {e}")
            return 0
    
    def get_currencies_needing_sync(self, target_dates: List[str]) -> List[Dict]:
        """
        Get currencies that need sync based on missing target dates
        Returns list of {'currency_id', 'symbol', 'name'} that need sync
        """
        try:
            with self.db.get_connection() as conn:
                with conn.cursor() as cur:
                    currencies_to_sync = []
                    
                    # Get all active currencies
                    cur.execute("""
                        SELECT id, symbol, name 
                        FROM currencies 
                        ORDER BY symbol
                    """)
                    all_currencies = cur.fetchall()
                    
                    for currency_id, symbol, name in all_currencies:
                        # Check if any target dates are missing for this currency
                        placeholders = ','.join(['%s'] * len(target_dates))
                        cur.execute(f"""
                            SELECT COUNT(*) 
                            FROM currency_history 
                            WHERE currency_id = %s 
                            AND date::text IN ({placeholders})
                        """, [currency_id] + target_dates)
                        
                        existing_count = cur.fetchone()[0]
                        
                        # If any dates are missing, we need to sync this currency completely
                        if existing_count < len(target_dates):
                            currencies_to_sync.append({
                                'currency_id': currency_id,
                                'symbol': symbol, 
                                'name': name
                            })
                            logger.debug(f"{symbol}: {existing_count}/{len(target_dates)} dates exist - needs sync")
                    
                    return currencies_to_sync
                    
        except Exception as e:
            logger.error(f"Failed to check currencies needing sync: {e}")
            return []
    
    def get_all_active_currencies(self) -> List[Dict]:
        """Get all active currencies for full sync"""
        try:
            with self.db.get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT id, symbol, name 
                        FROM currencies 
                        ORDER BY symbol
                    """)
                    currencies = cur.fetchall()
                    
                    result = []
                    for currency_id, symbol, name in currencies:
                        result.append({
                            'currency_id': currency_id,
                            'symbol': symbol,
                            'name': name
                        })
                    
                    return result
                    
        except Exception as e:
            logger.error(f"Failed to get active currencies: {e}")
            return []

    def _save_currency_prices(self, currency_id: int, prices: List[Dict]) -> bool:
        """Save currency price history to database"""
        try:
            with self.db.get_connection() as conn:
                with conn.cursor() as cur:
                    saved_count = 0
                    
                    for price_data in prices:
                        try:
                            # Use Persian date from API (same as candlestick data)
                            date_str = None
                            if 'date' in price_data and price_data['date']:
                                persian_date = price_data['date']  # Persian date like '1404/06/10'
                                try:
                                    # Convert Persian date format from '1404/06/10' to '1404-06-10'
                                    year, month, day = map(int, persian_date.split('/'))
                                    
                                    # Map Persian calendar days to valid format (same as candlestick)
                                    # Persian months 1-6 have 31 days, months 7-11 have 30 days, month 12 has 29 (30 in leap year)
                                    max_days_in_persian_month = {
                                        1: 31, 2: 31, 3: 31, 4: 31, 5: 31, 6: 31,
                                        7: 30, 8: 30, 9: 30, 10: 30, 11: 30, 12: 29
                                    }
                                    
                                    # For PostgreSQL DATE compatibility, ensure valid day for any month
                                    # Use conservative validation since PostgreSQL applies Gregorian rules
                                    if month in [1, 3, 5, 7, 8, 10, 12]:
                                        max_day = 31
                                    elif month in [4, 6, 9, 11]:  
                                        max_day = 30
                                    else:  # month == 2
                                        max_day = 28
                                    
                                    adjusted_day = min(day, max_day)
                                    
                                    # Create the adjusted date string (Persian format for consistency)
                                    date_str = f"{year:04d}-{month:02d}-{adjusted_day:02d}"
                                    
                                    if adjusted_day != day:
                                        logger.debug(f"Adjusted Persian date {persian_date} to {date_str} for PostgreSQL compatibility")
                                        
                                except (ValueError, IndexError) as e:
                                    logger.warning(f"Failed to parse Persian date {persian_date}: {e}")
                                    continue
                            
                            # Skip record if no valid date
                            if not date_str:
                                logger.warning(f"Skipping record without valid date: {price_data}")
                                continue
                            
                            # Insert or update - use actual OHLC data
                            cur.execute("""
                                INSERT INTO currency_history (
                                    currency_id, date, open_price, high_price, low_price, close_price
                                ) VALUES (%s, %s, %s, %s, %s, %s)
                                ON CONFLICT (currency_id, date) 
                                DO UPDATE SET
                                    open_price = EXCLUDED.open_price,
                                    high_price = EXCLUDED.high_price,
                                    low_price = EXCLUDED.low_price,
                                    close_price = EXCLUDED.close_price
                            """, (
                                currency_id,
                                date_str,  # Use Persian date format
                                price_data.get('open_price', 0),
                                price_data.get('high_price', 0),
                                price_data.get('low_price', 0),
                                price_data.get('close_price', 0)
                            ))
                            
                            saved_count += 1
                            
                        except Exception as e:
                            logger.warning(f"Failed to save price: {e}")
                            continue
                    
                    conn.commit()
                    logger.info(f"Saved {saved_count} price records")
                    return saved_count > 0
                    
        except Exception as e:
            logger.error(f"Failed to save currency prices: {e}")
            return False