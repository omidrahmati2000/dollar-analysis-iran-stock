"""
Main application entry point
Following SOLID principles and clean architecture
"""
import sys
from PyQt5.QtWidgets import QApplication
from typing import Dict, Any

from .services.container import ServiceContainer
from .core.events import EventBus
from .data.repositories import DatabaseConnection, SymbolRepository, OHLCVRepository
from .data.currency_repository import CurrencyRepository
from .data.stock_repository import StockRepository
from .indicators.factory import IndicatorFactory
from .indicators.presets import IndicatorPresets
from .indicators.strategies import StrategyManager
from .indicators.custom_builder import CustomIndicatorBuilder, CustomIndicatorFactory
from .services.indicator_service import IndicatorService
from .services.signal_service import SignalService
from .services.calculation_engine import RealTimeCalculationEngine
from .services.data_alignment_service import DataAlignmentService
from .services.expression_engine import ExpressionEngine
from .services.composite_chart_service import CompositeChartService
from .services.backtest_service import BacktestService
from .services.price_data_manager import PriceDataManager
from .ui.main_window import MainWindow
from .config import AppConfig


class TradingPlatformApp:
    """Main application class"""
    
    def __init__(self, config: AppConfig):
        self.config = config
        self.container = ServiceContainer()
        self._setup_services()
    
    def _setup_services(self):
        """Setup and register all services"""
        
        # Register configuration
        self.container.register('config', self.config)
        
        # Register event bus
        event_bus = EventBus()
        self.container.register('event_bus', event_bus)
        
        # Register database connection
        db_config = {
            'host': self.config.DB_HOST,
            'port': self.config.DB_PORT,
            'database': self.config.DB_NAME,
            'user': self.config.DB_USER,
            'password': self.config.DB_PASSWORD
        }
        db_connection = DatabaseConnection(db_config)
        self.container.register('db_connection', db_connection)
        
        # Register repositories
        symbol_repo = SymbolRepository(db_connection)
        ohlcv_repo = OHLCVRepository(db_connection)
        currency_repo = CurrencyRepository(db_connection)
        stock_repo = StockRepository(db_connection)
        
        self.container.register('symbol_repository', symbol_repo)
        self.container.register('ohlcv_repository', ohlcv_repo)
        self.container.register('currency_repository', currency_repo)
        self.container.register('stock_repository', stock_repo)
        
        # Register indicator system
        indicator_factory = IndicatorFactory()
        indicator_presets = IndicatorPresets()
        strategy_manager = StrategyManager()
        custom_indicator_factory = CustomIndicatorFactory()
        
        self.container.register('indicator_factory', indicator_factory)
        self.container.register('indicator_presets', indicator_presets)
        self.container.register('strategy_manager', strategy_manager)
        self.container.register('custom_indicator_factory', custom_indicator_factory)
        
        # Register advanced services
        indicator_service = IndicatorService(
            indicator_factory=indicator_factory,
            presets_manager=indicator_presets,
            strategy_manager=strategy_manager,
            event_bus=event_bus
        )
        
        signal_service = SignalService(
            indicator_service=indicator_service,
            event_bus=event_bus
        )
        
        calculation_engine = RealTimeCalculationEngine(
            indicator_service=indicator_service,
            signal_service=signal_service,
            ohlcv_repository=ohlcv_repo,
            event_bus=event_bus
        )
        
        self.container.register('indicator_service', indicator_service)
        self.container.register('signal_service', signal_service)
        self.container.register('calculation_engine', calculation_engine)
        
        # Register advanced data services
        data_alignment_service = DataAlignmentService(ohlcv_repo)
        expression_engine = ExpressionEngine(data_alignment_service)
        composite_chart_service = CompositeChartService(data_alignment_service, event_bus)
        backtest_service = BacktestService(indicator_service)
        price_data_manager = PriceDataManager(ohlcv_repo, event_bus)
        
        self.container.register('data_alignment_service', data_alignment_service)
        self.container.register('expression_engine', expression_engine)
        self.container.register('composite_chart_service', composite_chart_service)
        self.container.register('backtest_service', backtest_service)
        self.container.register('price_data_manager', price_data_manager)
    
    def run(self):
        """Run the application"""
        app = QApplication(sys.argv)
        app.setStyle('Fusion')
        
        # Apply dark theme
        app.setStyleSheet(self._get_dark_theme_stylesheet())
        
        # Create and show main window
        main_window = MainWindow(self.container)
        main_window.show()
        
        # Start event loop
        sys.exit(app.exec_())
    
    def _get_dark_theme_stylesheet(self) -> str:
        """Get dark theme stylesheet"""
        return """
        QMainWindow {
            background-color: #1e1e1e;
        }
        QWidget {
            background-color: #2d2d2d;
            color: #ffffff;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 12px;
        }
        QPushButton {
            background-color: #3a3a3a;
            border: 1px solid #555;
            padding: 6px 12px;
            border-radius: 4px;
            font-weight: 500;
        }
        QPushButton:hover {
            background-color: #4a4a4a;
            border-color: #666;
        }
        QPushButton:pressed {
            background-color: #2a2a2a;
        }
        QPushButton:checked {
            background-color: #0d7377;
            border-color: #0d7377;
        }
        QComboBox {
            background-color: #3a3a3a;
            border: 1px solid #555;
            padding: 5px;
            border-radius: 4px;
            min-width: 100px;
        }
        QComboBox::drop-down {
            border: none;
        }
        QComboBox::down-arrow {
            image: none;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-top: 5px solid #888;
            margin-right: 5px;
        }
        QLineEdit {
            background-color: #3a3a3a;
            border: 1px solid #555;
            padding: 6px;
            border-radius: 4px;
        }
        QLineEdit:focus {
            border-color: #0d7377;
        }
        QTableWidget {
            background-color: #2d2d2d;
            gridline-color: #444;
            border: 1px solid #444;
        }
        QHeaderView::section {
            background-color: #3a3a3a;
            color: #ffffff;
            padding: 6px;
            border: none;
            border-right: 1px solid #555;
            border-bottom: 1px solid #555;
        }
        QTabWidget::pane {
            background-color: #2d2d2d;
            border: 1px solid #444;
        }
        QTabBar::tab {
            background-color: #3a3a3a;
            color: #ffffff;
            padding: 8px 16px;
            margin-right: 2px;
        }
        QTabBar::tab:selected {
            background-color: #0d7377;
        }
        QTabBar::tab:hover {
            background-color: #4a4a4a;
        }
        QListWidget {
            background-color: #2d2d2d;
            border: 1px solid #444;
            outline: none;
        }
        QListWidget::item {
            padding: 5px;
            border-bottom: 1px solid #3a3a3a;
        }
        QListWidget::item:selected {
            background-color: #0d7377;
        }
        QListWidget::item:hover {
            background-color: #3a3a3a;
        }
        QGroupBox {
            border: 1px solid #444;
            border-radius: 4px;
            margin-top: 8px;
            padding-top: 8px;
            font-weight: bold;
        }
        QGroupBox::title {
            subcontrol-origin: margin;
            left: 10px;
            padding: 0 5px 0 5px;
        }
        QScrollBar:vertical {
            background-color: #2d2d2d;
            width: 12px;
            border: none;
        }
        QScrollBar::handle:vertical {
            background-color: #555;
            border-radius: 6px;
            min-height: 20px;
        }
        QScrollBar::handle:vertical:hover {
            background-color: #666;
        }
        QSplitter::handle {
            background-color: #444;
        }
        QSplitter::handle:horizontal {
            width: 2px;
        }
        QSplitter::handle:vertical {
            height: 2px;
        }
        QToolBar {
            background-color: #2d2d2d;
            border: none;
            border-bottom: 1px solid #444;
            padding: 2px;
        }
        QToolBar::separator {
            background-color: #444;
            width: 1px;
            margin: 5px;
        }
        QStatusBar {
            background-color: #2d2d2d;
            border-top: 1px solid #444;
        }
        QMenu {
            background-color: #2d2d2d;
            border: 1px solid #444;
        }
        QMenu::item {
            padding: 5px 20px;
        }
        QMenu::item:selected {
            background-color: #0d7377;
        }
        """


def main():
    """Main entry point"""
    from .config import AppConfig
    
    # Load configuration
    config = AppConfig()
    
    # Create and run application
    app = TradingPlatformApp(config)
    app.run()


if __name__ == '__main__':
    main()