"""
Data Tables Window - Main window containing both currency and stock tables
"""
from PyQt5.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
                             QTabWidget, QMenuBar, QStatusBar, QAction, 
                             QMessageBox, QSplitter, QFrame)
from PyQt5.QtCore import Qt, pyqtSignal, pyqtSlot
from PyQt5.QtGui import QIcon, QKeySequence
import logging

from ..services.container import ServiceContainer
from .currency_table_page import CurrencyTablePage
from .stock_table_page import StockTablePage
from ..domain.models import DataType


class DataTablesWindow(QMainWindow):
    """Main data tables window with currency and stock tabs"""
    
    # Signal emitted when user wants to view stock chart
    view_stock_chart_requested = pyqtSignal(str, int)  # symbol, data_type
    
    def __init__(self, container: ServiceContainer, parent=None):
        super().__init__(parent)
        self.container = container
        self.logger = logging.getLogger(__name__)
        
        # Initialize pages
        self.currency_page = None
        self.stock_page = None
        
        self._setup_ui()
        self._setup_menu()
        self._setup_connections()
        
        # Set window properties
        self.setWindowTitle("📊 جداول داده‌های بازار - ارزها و سهام")
        self.setMinimumSize(1200, 800)
        self.resize(1400, 900)
    
    def _setup_ui(self):
        """Setup user interface"""
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        layout = QVBoxLayout()
        layout.setContentsMargins(8, 8, 8, 8)
        
        # Create tab widget
        self.tab_widget = QTabWidget()
        self.tab_widget.setTabPosition(QTabWidget.North)
        self.tab_widget.setTabsClosable(False)
        self.tab_widget.setMovable(False)
        
        # Currency tab
        self.currency_page = CurrencyTablePage(self.container)
        self.tab_widget.addTab(self.currency_page, "💱 ارزها")
        
        # Stock tab  
        self.stock_page = StockTablePage(self.container)
        self.tab_widget.addTab(self.stock_page, "📈 سهام")
        
        layout.addWidget(self.tab_widget)
        central_widget.setLayout(layout)
        
        # Status bar
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("آماده - انتخاب کنید: ارزها یا سهام", 5000)
        
        # Tab styling
        self.tab_widget.setStyleSheet("""
            QTabWidget::pane {
                border: 1px solid #444;
                background-color: #2d2d2d;
            }
            QTabWidget::tab-bar {
                alignment: right;
            }
            QTabBar::tab {
                background-color: #3a3a3a;
                color: #ffffff;
                padding: 8px 20px;
                margin-right: 2px;
                border: 1px solid #555;
                border-bottom: none;
                border-top-left-radius: 6px;
                border-top-right-radius: 6px;
                min-width: 120px;
            }
            QTabBar::tab:selected {
                background-color: #0d7377;
                color: white;
                border-color: #0d7377;
            }
            QTabBar::tab:hover {
                background-color: #4a4a4a;
            }
            QTabBar::tab:!selected {
                margin-top: 3px;
            }
        """)
    
    def _setup_menu(self):
        """Setup menu bar"""
        menubar = self.menuBar()
        
        # File menu
        file_menu = menubar.addMenu('فایل')
        
        # Refresh action
        refresh_action = QAction('🔄 بروزرسانی', self)
        refresh_action.setShortcut(QKeySequence.Refresh)
        refresh_action.triggered.connect(self._refresh_current_tab)
        file_menu.addAction(refresh_action)
        
        file_menu.addSeparator()
        
        # Export actions
        export_csv_action = QAction('📄 صادرات CSV', self)
        export_csv_action.triggered.connect(self._export_to_csv)
        file_menu.addAction(export_csv_action)
        
        export_excel_action = QAction('📊 صادرات Excel', self)
        export_excel_action.triggered.connect(self._export_to_excel)
        file_menu.addAction(export_excel_action)
        
        file_menu.addSeparator()
        
        # Close action
        close_action = QAction('❌ بستن', self)
        close_action.setShortcut(QKeySequence.Close)
        close_action.triggered.connect(self.close)
        file_menu.addAction(close_action)
        
        # View menu
        view_menu = menubar.addMenu('نمایش')
        
        # Switch to currency tab
        currency_action = QAction('💱 ارزها', self)
        currency_action.setShortcut('Ctrl+1')
        currency_action.triggered.connect(lambda: self.tab_widget.setCurrentIndex(0))
        view_menu.addAction(currency_action)
        
        # Switch to stock tab
        stock_action = QAction('📈 سهام', self)
        stock_action.setShortcut('Ctrl+2')
        stock_action.triggered.connect(lambda: self.tab_widget.setCurrentIndex(1))
        view_menu.addAction(stock_action)
        
        view_menu.addSeparator()
        
        # Data type actions for stock tab
        unadjusted_action = QAction('📊 قیمت تعدیل نشده', self)
        unadjusted_action.setShortcut('Ctrl+U')
        unadjusted_action.triggered.connect(lambda: self._set_stock_data_type(DataType.UNADJUSTED))
        view_menu.addAction(unadjusted_action)
        
        adjusted_action = QAction('📈 قیمت تعدیل شده', self)
        adjusted_action.setShortcut('Ctrl+A')
        adjusted_action.triggered.connect(lambda: self._set_stock_data_type(DataType.ADJUSTED))
        view_menu.addAction(adjusted_action)
        
        # Tools menu
        tools_menu = menubar.addMenu('ابزار')
        
        # Clear filters
        clear_filters_action = QAction('🧹 پاک کردن فیلترها', self)
        clear_filters_action.setShortcut('Ctrl+Shift+C')
        clear_filters_action.triggered.connect(self._clear_current_filters)
        tools_menu.addAction(clear_filters_action)
        
        # Statistics
        stats_action = QAction('📊 آمار کلی', self)
        stats_action.triggered.connect(self._show_statistics)
        tools_menu.addAction(stats_action)
        
        # Help menu
        help_menu = menubar.addMenu('راهنما')
        
        # About
        about_action = QAction('ℹ️ درباره', self)
        about_action.triggered.connect(self._show_about)
        help_menu.addAction(about_action)
        
        # Keyboard shortcuts
        shortcuts_action = QAction('⌨️ میانبرهای صفحه کلید', self)
        shortcuts_action.triggered.connect(self._show_shortcuts)
        help_menu.addAction(shortcuts_action)
    
    def _setup_connections(self):
        """Setup signal connections"""
        # Tab change
        self.tab_widget.currentChanged.connect(self._on_tab_changed)
        
        # Stock chart request
        if self.stock_page:
            self.stock_page.view_chart_requested.connect(self._on_view_chart_requested)
    
    @pyqtSlot(int)
    def _on_tab_changed(self, index: int):
        """Handle tab change"""
        if index == 0:
            self.status_bar.showMessage("💱 جدول ارزها - نمایش آخرین قیمت‌های ارزها", 3000)
        elif index == 1:
            self.status_bar.showMessage("📈 جدول سهام - نمایش سهام با قیمت‌های جوین شده", 3000)
    
    @pyqtSlot(str, int)
    def _on_view_chart_requested(self, symbol: str, data_type: int):
        """Handle chart view request from stock page"""
        self.view_stock_chart_requested.emit(symbol, data_type)
    
    def _refresh_current_tab(self):
        """Refresh data in current tab"""
        current_index = self.tab_widget.currentIndex()
        
        if current_index == 0 and self.currency_page:
            self.currency_page.refresh_data()
            self.status_bar.showMessage("💱 داده‌های ارز بروزرسانی شد", 2000)
        elif current_index == 1 and self.stock_page:
            self.stock_page.refresh_data()
            self.status_bar.showMessage("📈 داده‌های سهام بروزرسانی شد", 2000)
    
    def _clear_current_filters(self):
        """Clear filters in current tab"""
        current_index = self.tab_widget.currentIndex()
        
        if current_index == 0 and self.currency_page:
            self.currency_page._clear_filters()
            self.status_bar.showMessage("💱 فیلترهای ارز پاک شد", 2000)
        elif current_index == 1 and self.stock_page:
            self.stock_page._clear_filters()
            self.status_bar.showMessage("📈 فیلترهای سهام پاک شد", 2000)
    
    def _set_stock_data_type(self, data_type: DataType):
        """Set data type for stock tab"""
        if self.stock_page:
            self.stock_page.set_data_type(data_type)
            type_name = "تعدیل نشده" if data_type == DataType.UNADJUSTED else "تعدیل شده"
            self.status_bar.showMessage(f"📈 نوع داده سهام تغییر یافت: {type_name}", 2000)
    
    def _export_to_csv(self):
        """Export current tab data to CSV"""
        current_index = self.tab_widget.currentIndex()
        tab_name = "ارزها" if current_index == 0 else "سهام"
        
        QMessageBox.information(self, "صادرات CSV", 
                               f"قابلیت صادرات {tab_name} به CSV در نسخه بعدی اضافه خواهد شد.")
    
    def _export_to_excel(self):
        """Export current tab data to Excel"""
        current_index = self.tab_widget.currentIndex()
        tab_name = "ارزها" if current_index == 0 else "سهام"
        
        QMessageBox.information(self, "صادرات Excel", 
                               f"قابلیت صادرات {tab_name} به Excel در نسخه بعدی اضافه خواهد شد.")
    
    def _show_statistics(self):
        """Show general statistics"""
        try:
            # Get statistics from repositories
            currency_stats = {}
            stock_stats = {}
            
            if self.currency_page:
                currency_stats = self.currency_page.currency_repo.get_currency_stats()
            
            if self.stock_page:
                stock_stats = self.stock_page.stock_repo.get_stock_stats()
            
            # Format statistics message
            stats_msg = "📊 آمار کلی سیستم:\n\n"
            
            # Currency stats
            if currency_stats:
                stats_msg += "💱 ارزها:\n"
                stats_msg += f"• تعداد کل ارزها: {currency_stats.get('total_currencies', 0):,}\n"
                stats_msg += f"• ارزهای دارای قیمت: {currency_stats.get('currencies_with_prices', 0):,}\n"
                if currency_stats.get('avg_change_24h'):
                    stats_msg += f"• میانگین تغییر 24 ساعته: {currency_stats['avg_change_24h']:.2f}%\n"
                stats_msg += "\n"
            
            # Stock stats
            if stock_stats:
                stats_msg += "📈 سهام:\n"
                stats_msg += f"• تعداد کل سهام: {stock_stats.get('total_stocks', 0):,}\n"
                stats_msg += f"• سهام دارای قیمت: {stock_stats.get('stocks_with_prices', 0):,}\n"
                stats_msg += f"• تعداد بورس‌ها: {stock_stats.get('total_exchanges', 0)}\n"
                stats_msg += f"• تعداد بخش‌ها: {stock_stats.get('total_sectors', 0)}\n"
                if stock_stats.get('avg_price'):
                    stats_msg += f"• میانگین قیمت: {stock_stats['avg_price']:,.0f}\n"
            
            QMessageBox.information(self, "آمار کلی", stats_msg)
            
        except Exception as e:
            self.logger.error(f"Error getting statistics: {e}")
            QMessageBox.warning(self, "خطا", "خطا در دریافت آمار")
    
    def _show_about(self):
        """Show about dialog"""
        about_text = """
        <h3>📊 سیستم جداول داده‌های بازار</h3>
        <p>نسخه 1.0</p>
        <p>سیستم جامع نمایش و مدیریت داده‌های ارزها و سهام</p>
        
        <h4>ویژگی‌ها:</h4>
        <ul>
            <li>💱 نمایش ارزها با آخرین قیمت‌ها از currency_history</li>
            <li>📈 نمایش سهام با داده‌های جوین شده از stock_prices</li>
            <li>🔍 فیلترها و جستجوی پیشرفته</li>
            <li>📊 مرتب‌سازی بر اساس ستون‌های مختلف</li>
            <li>🎛️ تغییر نوع داده (تعدیل شده/نشده) برای سهام</li>
            <li>📈 دسترسی مستقیم به نمودار سهام</li>
        </ul>
        
        <p><small>توسعه یافته با PyQt5 و PostgreSQL</small></p>
        """
        
        QMessageBox.about(self, "درباره", about_text)
    
    def _show_shortcuts(self):
        """Show keyboard shortcuts"""
        shortcuts_text = """
        <h3>⌨️ میانبرهای صفحه کلید</h3>
        
        <h4>عمومی:</h4>
        <ul>
            <li><b>F5</b> - بروزرسانی</li>
            <li><b>Ctrl+W</b> - بستن پنجره</li>
        </ul>
        
        <h4>تب‌ها:</h4>
        <ul>
            <li><b>Ctrl+1</b> - جدول ارزها</li>
            <li><b>Ctrl+2</b> - جدول سهام</li>
        </ul>
        
        <h4>نوع داده (سهام):</h4>
        <ul>
            <li><b>Ctrl+U</b> - قیمت تعدیل نشده</li>
            <li><b>Ctrl+A</b> - قیمت تعدیل شده</li>
        </ul>
        
        <h4>ابزار:</h4>
        <ul>
            <li><b>Ctrl+Shift+C</b> - پاک کردن فیلترها</li>
        </ul>
        
        <h4>جدول:</h4>
        <ul>
            <li><b>Double Click</b> - نمودار سهم (در جدول سهام)</li>
            <li><b>Enter/Space</b> - انتخاب ردیف</li>
            <li><b>Arrow Keys</b> - حرکت در جدول</li>
        </ul>
        """
        
        QMessageBox.information(self, "میانبرهای صفحه کلید", shortcuts_text)
    
    def get_current_tab_type(self) -> str:
        """Get current tab type"""
        current_index = self.tab_widget.currentIndex()
        return "currency" if current_index == 0 else "stock"
    
    def switch_to_currency_tab(self):
        """Switch to currency tab"""
        self.tab_widget.setCurrentIndex(0)
    
    def switch_to_stock_tab(self):
        """Switch to stock tab"""
        self.tab_widget.setCurrentIndex(1)
    
    def get_currency_page(self) -> CurrencyTablePage:
        """Get currency page"""
        return self.currency_page
    
    def get_stock_page(self) -> StockTablePage:
        """Get stock page"""
        return self.stock_page