"""
Stock Symbol Fetcher
"""
import logging
from typing import List, Dict, Any
import requests
import json
from iran_market_platform.config.config import Config

logger = logging.getLogger(__name__)


class StockFetcher:
    """Fetcher for stock symbols"""
    
    def __init__(self, db_manager):
        self.db = db_manager
        self.config = Config()
        api_urls = self.config.get_api_urls()
        self.stocks_api_url = api_urls['tsetmc_all_symbols']  # Get all symbols
        self.session = requests.Session()
        # Set proper headers from config
        headers = self.config.request_headers
        self.session.headers.update(headers)
        # Disable SSL verification for API that has SSL issues
        self.session.verify = False
        # Suppress SSL warnings
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        
        logger.info(f"Session initialized with headers: {dict(self.session.headers)}")
    
    def fetch_all_stocks(self) -> List[Dict]:
        """
        Fetch all stock symbols and their basic information
        """
        try:
            logger.info("Fetching stock symbols...")
            logger.info(f"API URL: {self.stocks_api_url}")
            logger.info(f"Headers: {dict(self.session.headers)}")
            
            # Use the stocks API directly to get all symbols
            params = {'key': self.config.BRSAPI_PRO_KEY}
            response = self.session.get(self.stocks_api_url, params=params, timeout=30)
            response.raise_for_status()
            
            stocks = response.json()
            logger.info(f"API returned {len(stocks) if isinstance(stocks, list) else 'non-list'} items")
            
            if not stocks:
                logger.warning("No stocks returned from API")
                return []
            
            # Log first item structure for debugging
            if isinstance(stocks, list) and len(stocks) > 0:
                logger.info(f"First stock item keys: {list(stocks[0].keys()) if isinstance(stocks[0], dict) else 'Not a dict'}")
                logger.info(f"First stock sample: {stocks[0]}")
            
            # Save to database
            saved_count = self._save_stocks(stocks)
            logger.info(f"Saved {saved_count} stock symbols")
            
            return stocks
            
        except requests.exceptions.RequestException as e:
            logger.error(f"API request failed for stock list: {e}")
            return []
        except Exception as e:
            logger.error(f"Failed to fetch stock list: {e}")
            return []
    
    def _save_stocks(self, stocks: List[Dict]) -> int:
        """Save stock symbols to database"""
        try:
            with self.db.get_connection() as conn:
                with conn.cursor() as cur:
                    saved_count = 0
                    
                    for stock in stocks:
                        try:
                            cur.execute("""
                                INSERT INTO stock_symbols (
                                    symbol, company_name, isin, internal_id,
                                    industry_group, industry_group_id, total_shares,
                                    base_volume, market_value, eps, pe_ratio
                                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                                ON CONFLICT (symbol) 
                                DO UPDATE SET
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
                                RETURNING id
                            """, (
                                stock.get('l18'),  # symbol
                                stock.get('l30'),  # company_name
                                stock.get('isin'),
                                str(stock.get('id')),   # internal_id (convert to string)
                                stock.get('cs'),   # industry_group
                                stock.get('cs_id'), # industry_group_id
                                None,  # total_shares (not in API response)
                                stock.get('bvol'),  # base_volume
                                stock.get('mv'),    # market_value
                                stock.get('eps'),
                                stock.get('pe')     # pe_ratio
                            ))
                            
                            saved_count += 1
                            
                        except Exception as e:
                            logger.warning(f"Failed to save stock {stock.get('l18')}: {e}")
                            continue
                    
                    conn.commit()
                    return saved_count
                    
        except Exception as e:
            logger.error(f"Failed to save stocks: {e}")
            return 0