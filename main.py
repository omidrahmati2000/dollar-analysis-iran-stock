#!/usr/bin/env python3
"""
Main entry point for Iran Market Data Fetcher
Enhanced version with date range support and intelligent sync
"""
import sys
import os
import argparse
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Tuple
import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

# Setup path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database.db_manager import DatabaseManager
from data_fetchers.stock_fetcher import StockFetcher
from data_fetchers.candlestick_fetcher import CandlestickFetcher
from data_fetchers.currency_fetcher import CurrencyFetcher

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('sync.log')
    ]
)
logger = logging.getLogger(__name__)


class IntelligentDataSyncer:
    """Enhanced data syncer with date range and intelligent missing data detection"""
    
    def __init__(self):
        self.db = DatabaseManager()
        self.stock_fetcher = StockFetcher(self.db)
        self.candlestick_fetcher = CandlestickFetcher(self.db)
        self.currency_fetcher = CurrencyFetcher(self.db)
    
    def parse_date(self, date_str: str) -> datetime:
        """Parse date string in format YYYY-MM-DD (e.g., 1380-01-05)"""
        try:
            return datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            logger.error(f"Invalid date format: {date_str}. Use YYYY-MM-DD format (e.g., 1380-01-05)")
            raise
    
    def check_missing_data_for_symbols(self, target_dates: List[str], data_types: List[int]) -> Dict:
        """
        Check which symbols need complete sync for given dates and data types
        Returns dict with symbols that need full sync for each data_type
        """
        return self.candlestick_fetcher.get_symbols_needing_sync(target_dates, data_types)
    
    def sync_stocks(self) -> bool:
        """Sync stock symbols"""
        logger.info("Starting stock symbols synchronization...")
        try:
            stocks = self.stock_fetcher.fetch_all_stocks()
            logger.info(f"✅ Successfully synced {len(stocks)} stock symbols")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to sync stocks: {e}")
            return False
    
    def sync_candlesticks_sequential(self, target_dates: Optional[List[str]] = None,
                                    data_types: Optional[List[int]] = None, 
                                    dry_run: bool = False) -> bool:
        """
        Sync candlestick data sequentially with intelligent missing data detection
        
        Args:
            target_dates: List of dates to check (e.g., ['1403-01-01', '1403-01-02'])
            data_types: List of data types to sync (e.g., [2, 3] for both unadjusted and adjusted)
            dry_run: If True, only show symbols that need sync without syncing
        """
        logger.info("Starting candlestick data synchronization (sequential)...")
        
        # Default data types if not specified
        if data_types is None:
            data_types = [2, 3]  # Both unadjusted (2) and adjusted (3)
        
        try:
            if target_dates:
                # Get symbols that need sync for the target dates
                symbols_to_sync = self.check_missing_data_for_symbols(target_dates, data_types)
                logger.info(f"Found symbols needing sync: {len(symbols_to_sync)} combinations")
            else:
                # Full sync - get all active symbols
                symbols_to_sync = self.candlestick_fetcher.get_all_active_symbols()
                logger.info("Performing full sync for all symbols")
            
            # If dry-run, just show the symbols and return
            if dry_run:
                self._show_symbols_to_sync(symbols_to_sync, target_dates)
                return True
            
            total_synced = 0
            failed_count = 0
            
            for symbol_info in symbols_to_sync:
                symbol_id = symbol_info['stock_id']
                symbol = symbol_info['symbol']
                name = symbol_info['name']
                data_type = symbol_info['data_type']
                
                logger.info(f"🔄 Syncing {symbol} - {name} (type={data_type})")
                
                try:
                    # Full sync for this symbol and data type
                    success = self.candlestick_fetcher.fetch_candlesticks(
                        symbol, symbol_id, data_type
                    )
                    
                    if success:
                        total_synced += 1
                        logger.info(f"  ✅ {symbol} (type={data_type}): Success")
                    else:
                        failed_count += 1
                        logger.warning(f"  ⚠️ {symbol} (type={data_type}): No data fetched")
                        
                except Exception as e:
                    logger.error(f"  ❌ Error syncing {symbol} (type={data_type}): {e}")
                    failed_count += 1
                
                # Small delay to avoid overwhelming the API
                time.sleep(0.5)
            
            logger.info(f"✅ Candlestick sync completed: {total_synced} successful, {failed_count} failed")
            return failed_count == 0
            
        except Exception as e:
            logger.error(f"❌ Candlestick sync failed: {e}")
            return False
    
    def sync_candlesticks_parallel(self, target_dates: Optional[List[str]] = None,
                                  data_types: Optional[List[int]] = None,
                                  max_workers: int = 5, dry_run: bool = False) -> bool:
        """
        Sync candlestick data in parallel with intelligent missing data detection
        
        Args:
            target_dates: List of dates to check (e.g., ['1403-01-01', '1403-01-02'])
            data_types: List of data types to sync (e.g., [2, 3] for both unadjusted and adjusted)
            max_workers: Number of parallel workers
            dry_run: If True, only show symbols that need sync without syncing
        """
        logger.info(f"Starting candlestick data synchronization (parallel with {max_workers} workers)...")
        
        # Default data types if not specified
        if data_types is None:
            data_types = [2, 3]
        
        try:
            if target_dates:
                # Get symbols that need sync for the target dates
                symbols_to_sync = self.check_missing_data_for_symbols(target_dates, data_types)
                logger.info(f"Found symbols needing sync: {len(symbols_to_sync)} combinations")
            else:
                # Full sync - get all active symbols
                symbols_to_sync = self.candlestick_fetcher.get_all_active_symbols()
                logger.info("Performing full sync for all symbols")
            
            if not symbols_to_sync:
                logger.info("✅ No missing data to sync!")
                return True
            
            # If dry-run, just show the symbols and return
            if dry_run:
                self._show_symbols_to_sync(symbols_to_sync, target_dates)
                return True
            
            logger.info(f"📋 Total sync tasks: {len(symbols_to_sync)}")
            
            # Execute tasks in parallel
            total_synced = 0
            failed_count = 0
            
            def sync_single_symbol(symbol_info):
                symbol_id = symbol_info['stock_id']
                symbol = symbol_info['symbol']
                name = symbol_info['name']
                data_type = symbol_info['data_type']
                
                try:
                    logger.info(f"🔄 Syncing {symbol} (type={data_type})...")
                    
                    # Full sync for this symbol and data type
                    success = self.candlestick_fetcher.fetch_candlesticks(
                        symbol, symbol_id, data_type
                    )
                    
                    if success:
                        logger.info(f"✅ {symbol} (type={data_type}): Success")
                        return True
                    else:
                        logger.warning(f"⚠️ {symbol} (type={data_type}): No data fetched")
                        return False
                        
                except Exception as e:
                    logger.error(f"❌ {symbol} (type={data_type}): {e}")
                    return False
            
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_to_symbol = {executor.submit(sync_single_symbol, symbol_info): symbol_info for symbol_info in symbols_to_sync}
                
                for future in as_completed(future_to_symbol):
                    symbol_info = future_to_symbol[future]
                    try:
                        result = future.result()
                        if result:
                            total_synced += 1
                        else:
                            failed_count += 1
                    except Exception as e:
                        logger.error(f"Task failed: {e}")
                        failed_count += 1
            
            logger.info(f"✅ Parallel candlestick sync completed: {total_synced} successful, {failed_count} failed")
            return failed_count == 0
            
        except Exception as e:
            logger.error(f"❌ Parallel candlestick sync failed: {e}")
            return False
    
    def sync_currencies_list(self) -> bool:
        """Sync currency list (discover new currencies)"""
        logger.info("Starting currency list synchronization...")
        try:
            currencies = self.currency_fetcher.fetch_currency_list()
            logger.info(f"✅ Successfully synced {len(currencies)} currencies")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to sync currency list: {e}")
            return False
    
    def sync_currency_prices(self, target_dates: Optional[List[str]] = None, dry_run: bool = False) -> bool:
        """
        Sync currency price history with target dates support
        
        Args:
            target_dates: List of dates to check (e.g., ['1403-01-01', '1403-01-02'])
            dry_run: If True, only show currencies that need sync without syncing
        """
        logger.info("Starting currency price history synchronization...")
        
        try:
            if target_dates:
                # Get currencies that need sync for the target dates
                currencies_to_sync = self.currency_fetcher.get_currencies_needing_sync(target_dates)
                logger.info(f"Found currencies needing sync: {len(currencies_to_sync)} currencies")
            else:
                # Full sync - get all active currencies
                currencies_to_sync = self.currency_fetcher.get_all_active_currencies()
                logger.info("Performing full sync for all currencies")
            
            # If dry-run, just show the currencies and return
            if dry_run:
                self._show_currencies_to_sync(currencies_to_sync, target_dates)
                return True
            
            total_synced = 0
            failed_count = 0
            
            for currency_info in currencies_to_sync:
                currency_id = currency_info['currency_id']
                symbol = currency_info['symbol']
                name = currency_info['name']
                
                logger.info(f"🔄 Syncing {symbol} - {name}")
                
                try:
                    # Full sync for this currency
                    success = self.currency_fetcher.fetch_currency_history(symbol, currency_id)
                    
                    if success:
                        total_synced += 1
                        logger.info(f"  ✅ {symbol}: Success")
                    else:
                        failed_count += 1
                        logger.warning(f"  ⚠️ {symbol}: No data fetched")
                        
                except Exception as e:
                    logger.error(f"  ❌ Error syncing {symbol}: {e}")
                    failed_count += 1
                
                # Small delay to avoid overwhelming the API
                time.sleep(0.5)
            
            logger.info(f"✅ Currency price sync completed: {total_synced} successful, {failed_count} failed")
            return failed_count == 0
            
        except Exception as e:
            logger.error(f"❌ Currency price sync failed: {e}")
            return False
    
    def sync_currencies(self, target_dates: Optional[List[str]] = None, dry_run: bool = False) -> bool:
        """Combined currency sync: list + prices"""
        logger.info("Starting full currency synchronization...")
        
        # If dry-run, just show price sync info (skip currency list sync)
        if dry_run:
            return self.sync_currency_prices(target_dates, dry_run)
        
        # First sync currency list
        if not self.sync_currencies_list():
            logger.warning("Currency list sync failed, continuing with price sync...")
        
        # Then sync price history
        return self.sync_currency_prices(target_dates, dry_run)
    
    def _show_symbols_to_sync(self, symbols_to_sync: List[Dict], target_dates: Optional[List[str]] = None):
        """Display symbols that need sync in a formatted table"""
        print("\n📋 SYMBOLS THAT NEED SYNC")
        print("=" * 80)
        
        if target_dates:
            date_info = f" for dates: {', '.join(target_dates)}"
        else:
            date_info = " (full sync)"
        
        print(f"Found {len(symbols_to_sync)} symbol-datatype combinations{date_info}")
        print()
        
        # Group by data type for better display
        by_data_type = {}
        for symbol_info in symbols_to_sync:
            data_type = symbol_info['data_type']
            if data_type not in by_data_type:
                by_data_type[data_type] = []
            by_data_type[data_type].append(symbol_info)
        
        data_type_names = {2: "Unadjusted", 3: "Adjusted"}
        
        for data_type in sorted(by_data_type.keys()):
            symbols = by_data_type[data_type]
            type_name = data_type_names.get(data_type, f"Type {data_type}")
            
            print(f"\n📊 {type_name} Data (type={data_type}): {len(symbols)} symbols")
            print("-" * 60)
            
            # Show in columns
            symbols_per_row = 4
            for i in range(0, len(symbols), symbols_per_row):
                row_symbols = symbols[i:i + symbols_per_row]
                row_text = "  ".join([f"{s['symbol']:<12}" for s in row_symbols])
                print(f"  {row_text}")
            
            # Show a few example names
            if symbols:
                print(f"  Examples: {', '.join([s['name'][:20] + ('...' if len(s['name']) > 20 else '') for s in symbols[:3]])}")
        
        print("\n" + "=" * 80)
        print(f"💡 To sync these symbols, remove the --dry-run flag")
        print("=" * 80)
    
    def _show_currencies_to_sync(self, currencies_to_sync: List[Dict], target_dates: Optional[List[str]] = None):
        """Display currencies that need sync in a formatted table"""
        print("\n💱 CURRENCIES THAT NEED SYNC")
        print("=" * 80)
        
        if target_dates:
            date_info = f" for dates: {', '.join(target_dates)}"
        else:
            date_info = " (full sync)"
        
        print(f"Found {len(currencies_to_sync)} currencies{date_info}")
        print()
        
        if currencies_to_sync:
            print("📊 Currency List:")
            print("-" * 60)
            
            # Show currencies in columns
            currencies_per_row = 4
            for i in range(0, len(currencies_to_sync), currencies_per_row):
                row_currencies = currencies_to_sync[i:i + currencies_per_row]
                row_text = "  ".join([f"{c['symbol']:<12}" for c in row_currencies])
                print(f"  {row_text}")
            
            # Show some example names
            print(f"\n  Examples:")
            for i, currency in enumerate(currencies_to_sync[:5]):
                symbol = currency['symbol']
                name = currency['name']
                print(f"    {symbol:<8} - {name}")
                if i >= 4:  # Show max 5 examples
                    if len(currencies_to_sync) > 5:
                        print(f"    ... and {len(currencies_to_sync) - 5} more")
                    break
        else:
            print("✅ No currencies need sync!")
        
        print("\n" + "=" * 80)
        if currencies_to_sync:
            print(f"💡 To sync these currencies, remove the --dry-run flag")
        print("=" * 80)


def show_status():
    """Show database status"""
    print("\n📊 Database Status")
    print("-" * 60)
    
    try:
        db = DatabaseManager()
        
        with db.get_connection() as conn:
            with conn.cursor() as cur:
                # Check each table
                tables = [
                    ('Stock Symbols', 'stock_symbols'),
                    ('Stock Prices', 'stock_prices'), 
                    ('Candlestick Data', 'candlestick_data'),
                    ('Currencies', 'currencies'),
                    ('Currency History', 'currency_history')
                ]
                
                print(f"{'Data Type':<20} {'Count':<10} {'Last Update'}")
                print("-" * 60)
                
                for name, table in tables:
                    try:
                        cur.execute(f"SELECT COUNT(*), MAX(created_at) FROM {table}")
                        count, last_update = cur.fetchone()
                        last_update = last_update or "N/A"
                        print(f"{name:<20} {count:<10} {last_update}")
                    except Exception as e:
                        print(f"{name:<20} {'ERROR':<10} {str(e)[:30]}")
                        
    except Exception as e:
        print(f"Error getting status: {e}")
        print("Database might not be initialized yet.")


def sync_all():
    """Sync all data types"""
    print("🚀 Starting full data synchronization...")
    
    syncer = IntelligentDataSyncer()
    success_count = 0
    total_count = 3
    
    tasks = [
        ("Stock Symbols", lambda: syncer.sync_stocks()),
        ("Candlestick Data (Parallel)", lambda: syncer.sync_candlesticks_parallel()),
        ("Currency Data", lambda: syncer.sync_currencies())
    ]
    
    for task_name, task_func in tasks:
        print(f"\n🔄 {task_name}...")
        print("-" * 60)
        start_time = time.time()
        
        try:
            success = task_func()
            elapsed = time.time() - start_time
            
            if success:
                print(f"✅ {task_name} completed successfully!")
                print(f"⏱️  Duration: {elapsed:.1f} seconds")
                success_count += 1
            else:
                print(f"❌ {task_name} failed!")
                print(f"⏱️  Duration: {elapsed:.1f} seconds")
                
        except Exception as e:
            elapsed = time.time() - start_time
            print(f"❌ {task_name} failed with error!")
            print(f"⏱️  Duration: {elapsed:.1f} seconds")
            print(f"🔍 Error: {e}")
    
    print("\n" + "=" * 60)
    print("📊 FULL SYNC SUMMARY")
    print("=" * 60)
    print(f"✅ Successful: {success_count}/{total_count}")
    print(f"❌ Failed: {total_count - success_count}/{total_count}")
    
    if success_count == total_count:
        print("🎉 All data synchronized successfully!")
        return True
    else:
        print("⚠️  Some synchronization tasks failed. Check logs above.")
        return False


def main():
    """Main entry point with enhanced UI and argument parsing"""
    parser = argparse.ArgumentParser(
        description='🚀 Iran Market Data Fetcher - Enhanced Management Interface',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Basic operations
  python main.py stocks                          # Sync stock symbols
  python main.py candlesticks                    # Sync all candlesticks (sequential)
  python main.py candlesticks-parallel           # Sync all candlesticks (parallel)
  python main.py currencies                      # Sync currencies (list + prices)
  python main.py currencies-list                 # Sync currency list only
  python main.py currency-prices                 # Sync currency prices only
  
  # With specific dates (format: YYYY-MM-DD)
  python main.py candlesticks --dates 1403-01-01,1403-01-02,1403-01-03
  python main.py candlesticks-parallel --dates 1403-01-15,1403-01-16 --data-types 3
  python main.py currency-prices --dates 1403-01-01,1403-01-02
  
  # Dry-run mode (show what needs sync without syncing)
  python main.py candlesticks --dates 1404-01-05 --dry-run
  python main.py candlesticks-parallel --dates 1404-01-05 --dry-run
  python main.py currencies --dates 1404-01-05 --dry-run
  python main.py currency-prices --dates 1404-01-05 --dry-run
  
  # Other options
  python main.py candlesticks --data-types 2,3   # Sync both adjusted and unadjusted
  python main.py candlesticks-parallel --max-workers 10  # Use 10 parallel workers
  python main.py all                             # Sync everything
  python main.py status                          # Show database status
        """
    )
    
    parser.add_argument(
        'command',
        choices=[
            'stocks', 
            'candlesticks', 
            'candlesticks-parallel',
            'currencies',
            'currencies-list',
            'currency-prices',
            'all',
            'status'
        ],
        help='Synchronization command to execute'
    )
    
    parser.add_argument(
        '--dates',
        type=str,
        help='Comma-separated dates to check in YYYY-MM-DD format (e.g., 1403-01-01,1403-01-02,1403-01-03)'
    )
    
    parser.add_argument(
        '--data-types',
        type=str,
        default='2,3',
        help='Comma-separated data types for candlesticks (2=unadjusted, 3=adjusted). Default: 2,3'
    )
    
    parser.add_argument(
        '--max-workers',
        type=int,
        default=5,
        help='Maximum number of parallel workers (default: 5)'
    )
    
    parser.add_argument(
        '--debug',
        action='store_true',
        help='Enable debug logging'
    )
    
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show symbols that need sync without actually syncing them'
    )
    
    # Show help if no arguments provided
    if len(sys.argv) == 1:
        print("🚀 Iran Market Data Fetcher - Enhanced Management Interface")
        print("=" * 60)
        print("Available commands:")
        print("  stocks                 - Sync stock symbols")
        print("  candlesticks          - Sync candlestick data (sequential)")
        print("  candlesticks-parallel - Sync candlestick data (parallel - faster)")
        print("  currencies            - Sync currencies (list + prices)")
        print("  currencies-list       - Sync currency list only")
        print("  currency-prices       - Sync currency prices only")
        print("  all                   - Sync all data types")
        print("  status                - Show database status")
        print()
        print("Usage: python main.py <command> [options]")
        print("Example: python main.py candlesticks-parallel --dates 1403-01-01,1403-01-02,1403-01-03")
        print("Dry-run: python main.py candlesticks --dates 1404-01-05 --dry-run")
        print("         python main.py currencies --dates 1404-01-05 --dry-run")
        return 0
    
    args = parser.parse_args()
    
    # Configure logging level
    if args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Parse target dates if provided
    target_dates = None
    if args.dates:
        try:
            target_dates = [date.strip() for date in args.dates.split(',')]
            # Validate date format
            for date in target_dates:
                datetime.strptime(date, '%Y-%m-%d')
        except ValueError:
            print("❌ Error: Invalid date format. Use YYYY-MM-DD (e.g., 1403-01-01,1403-01-02)")
            return 1
    
    # Enhanced banner
    print("🚀 Iran Market Data Fetcher - Enhanced Management Interface")
    print("=" * 60)
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    if target_dates:
        print(f"📅 Target dates: {', '.join(target_dates)}")
    
    # Handle status command
    if args.command == 'status':
        show_status()
        print(f"\n⏰ Finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        return 0
    
    # Handle all command
    if args.command == 'all':
        success = sync_all()
        print(f"\n⏰ Finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        return 0 if success else 1
    
    # Parse data types for candlestick commands
    data_types = None
    if args.command in ['candlesticks', 'candlesticks-parallel']:
        try:
            data_types = [int(x.strip()) for x in args.data_types.split(',')]
            print(f"📊 Data types to sync: {data_types}")
        except ValueError:
            print("❌ Invalid data-types format. Use comma-separated integers (e.g., 2,3)")
            return 1
    
    # Initialize syncer
    syncer = IntelligentDataSyncer()
    
    # Execute command with enhanced UI
    success = False
    command_descriptions = {
        'stocks': 'Stock Symbols Sync',
        'candlesticks': 'Candlestick Data Sync (Sequential)',
        'candlesticks-parallel': f'Candlestick Data Sync (Parallel - {args.max_workers} workers)',
        'currencies': 'Full Currency Sync',
        'currencies-list': 'Currency List Sync',
        'currency-prices': 'Currency Price History Sync'
    }
    
    description = command_descriptions.get(args.command, args.command.title())
    if target_dates:
        if len(target_dates) <= 3:
            description += f" [{', '.join(target_dates)}]"
        else:
            description += f" [{len(target_dates)} dates]"
    
    print(f"\n🔄 {description}...")
    print("-" * 60)
    
    start_time = time.time()
    
    try:
        if args.command == 'stocks':
            success = syncer.sync_stocks()
            
        elif args.command == 'candlesticks':
            success = syncer.sync_candlesticks_sequential(
                target_dates, data_types, args.dry_run
            )
            
        elif args.command == 'candlesticks-parallel':
            success = syncer.sync_candlesticks_parallel(
                target_dates, data_types, args.max_workers, args.dry_run
            )
            
        elif args.command == 'currencies':
            success = syncer.sync_currencies(target_dates, args.dry_run)
            
        elif args.command == 'currencies-list':
            success = syncer.sync_currencies_list()
            
        elif args.command == 'currency-prices':
            success = syncer.sync_currency_prices(target_dates, args.dry_run)
        
        elapsed_time = time.time() - start_time
        
        print("-" * 60)
        if success:
            print(f"✅ {description} completed successfully!")
            print(f"⏱️  Duration: {elapsed_time:.1f} seconds")
        else:
            print(f"❌ {description} failed!")
            print(f"⏱️  Duration: {elapsed_time:.1f} seconds")
        
    except Exception as e:
        elapsed_time = time.time() - start_time
        print("-" * 60)
        print(f"❌ {description} failed with error!")
        print(f"⏱️  Duration: {elapsed_time:.1f} seconds")
        print(f"🔍 Error: {e}")
        success = False
    
    print(f"\n⏰ Finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())