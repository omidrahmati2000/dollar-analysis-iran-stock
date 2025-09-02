"""
Command Line Interface for Iran Market Platform
Refactored from original main.py following clean architecture
"""
import sys
import argparse
import logging
from pathlib import Path
from typing import Dict, Any

from ..config.manager import config_manager
from .commands import (
    InitDatabaseCommand,
    FetchStocksCommand, 
    FetchCandlesticksCommand,
    FetchCurrenciesCommand,
    TestCommand,
    StatusCommand
)


def setup_logging() -> None:
    """Setup logging configuration"""
    log_config = config_manager.get_log_config()
    
    # Create logs directory
    log_file = Path(log_config['file_path'])
    log_file.parent.mkdir(parents=True, exist_ok=True)
    
    logging.basicConfig(
        level=getattr(logging, log_config['level']),
        format=log_config['format'],
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(log_file) if log_config['file_enabled'] else logging.NullHandler()
        ]
    )


def display_banner():
    """Display application banner"""
    settings = config_manager.settings
    db_config = settings.database
    
    print("=" * 70)
    print(f"🇮🇷 {settings.app_name} v{settings.app_version}")
    print("=" * 70)
    print(f"Environment: {settings.environment}")
    print(f"Database: {db_config.name}@{db_config.host}:{db_config.port}")
    print(f"API Batch Size: {settings.api.batch_size}")
    print(f"API Delay: {settings.api.delay_seconds} seconds")
    print("=" * 70)
    print()


class CLIApplication:
    """Main CLI application class"""
    
    def __init__(self):
        self.logger = logging.getLogger("cli.main")
        self.commands = {
            'init': InitDatabaseCommand(),
            'stocks': FetchStocksCommand(),
            'candles': FetchCandlesticksCommand(), 
            'currencies': FetchCurrenciesCommand(),
            'test': TestCommand(),
            'status': StatusCommand()
        }
    
    def create_parser(self) -> argparse.ArgumentParser:
        """Create the argument parser"""
        parser = argparse.ArgumentParser(
            description='Iran Market Data Platform - Comprehensive market data fetcher and analyzer',
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
Examples:
  python -m iran_market_platform.cli test                    # Run test mode (recommended first run)
  python -m iran_market_platform.cli init                    # Initialize database
  python -m iran_market_platform.cli stocks                  # Fetch all stock symbols
  python -m iran_market_platform.cli candles --parallel 5    # Fetch candlestick data with 5 workers
  python -m iran_market_platform.cli currencies              # Fetch currency rates
  python -m iran_market_platform.cli status                  # Check system status

For more information, visit: https://github.com/iran-market-platform
            """
        )
        
        # Add subcommands
        subparsers = parser.add_subparsers(
            dest='command',
            help='Available commands',
            metavar='{test,init,stocks,candles,currencies,status}'
        )
        
        # Register command parsers
        for name, command in self.commands.items():
            command.register_parser(subparsers)
        
        # Global options
        parser.add_argument(
            '--debug',
            action='store_true',
            help='Enable debug logging'
        )
        
        parser.add_argument(
            '--config',
            type=str,
            help='Path to configuration file'
        )
        
        parser.add_argument(
            '--no-banner',
            action='store_true',
            help='Skip banner display'
        )
        
        return parser
    
    def run(self, args: argparse.Namespace) -> int:
        """
        Run the CLI application
        
        Args:
            args: Parsed command line arguments
            
        Returns:
            Exit code (0 for success, non-zero for error)
        """
        try:
            # Setup configuration
            if args.config:
                # TODO: Load custom config file
                pass
            
            if args.debug:
                logging.getLogger().setLevel(logging.DEBUG)
            
            # Display banner
            if not args.no_banner:
                display_banner()
            
            # Execute command
            if args.command in self.commands:
                return self.commands[args.command].execute(args)
            else:
                self.logger.error("No command specified. Use --help for usage information.")
                return 1
                
        except KeyboardInterrupt:
            self.logger.info("Operation cancelled by user")
            return 130
        
        except Exception as e:
            self.logger.error(f"Unexpected error: {e}")
            if args.debug:
                import traceback
                traceback.print_exc()
            return 1


def main_cli():
    """Main CLI entry point"""
    # Setup logging first
    setup_logging()
    
    # Create and run CLI application
    app = CLIApplication()
    parser = app.create_parser()
    args = parser.parse_args()
    
    # If no command provided, show help
    if not args.command:
        parser.print_help()
        return 1
    
    return app.run(args)


if __name__ == "__main__":
    sys.exit(main_cli())