"""
Main Window for the Trading Platform
"""
from PyQt5.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
                             QMenuBar, QStatusBar, QAction, QMessageBox, 
                             QPushButton, QLabel, QFrame, QSplitter, QTabWidget)
from PyQt5.QtCore import Qt, pyqtSignal, pyqtSlot
from PyQt5.QtGui import QIcon, QKeySequence, QFont
import logging

from ..services.container import ServiceContainer
from .data_tables_window import DataTablesWindow
from .composite_chart_panel import CompositeChartPanel
from .indicator_panel import IndicatorPanel
from .backtest_panel import BacktestPanel


class MainWindow(QMainWindow):
    """Main application window"""
    
    def __init__(self, container: ServiceContainer, parent=None):
        super().__init__(parent)
        self.container = container
        self.logger = logging.getLogger(__name__)
        
        # Sub-windows
        self.data_tables_window = None
        
        self._setup_ui()
        self._setup_menu()
        self._setup_connections()
        
        # Set window properties
        self.setWindowTitle("🚀 پلتفرم معاملاتی - تحلیل دلار و بورس ایران")
        self.setMinimumSize(1000, 700)
        self.resize(1400, 900)
    
    def _setup_ui(self):
        """Setup user interface"""
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        layout = QVBoxLayout()
        layout.setContentsMargins(8, 8, 8, 8)
        
        # Welcome section
        welcome_frame = self._create_welcome_section()
        layout.addWidget(welcome_frame)
        
        # Main content tabs
        self.main_tabs = QTabWidget()
        self.main_tabs.setTabPosition(QTabWidget.North)
        
        # Composite Charts tab
        composite_panel = CompositeChartPanel(self.container)
        self.main_tabs.addTab(composite_panel, "📊 نمودارهای ترکیبی")
        
        # Indicators tab
        indicator_panel = IndicatorPanel(self.container)
        self.main_tabs.addTab(indicator_panel, "📈 اندیکاتورها")
        
        # Backtest tab
        backtest_panel = BacktestPanel(self.container)
        self.main_tabs.addTab(backtest_panel, "🔄 بک‌تست")
        
        layout.addWidget(self.main_tabs)
        
        central_widget.setLayout(layout)
        
        # Status bar
        self.status_bar = QStatusBar()
        self.setStatusBar(self.status_bar)
        self.status_bar.showMessage("آماده - پلتفرم معاملاتی بارگذاری شد", 5000)
        
        # Apply styling
        self._apply_styling()
    
    def _create_welcome_section(self) -> QFrame:
        """Create welcome section with quick actions"""
        frame = QFrame()
        frame.setFrameStyle(QFrame.StyledPanel)
        frame.setStyleSheet("""
            QFrame {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                    stop:0 #2a2a2a, stop:1 #3a3a3a);
                border-radius: 8px;
                border: 1px solid #555;
            }
        """)
        
        layout = QHBoxLayout()
        layout.setContentsMargins(20, 15, 20, 15)
        
        # Welcome text
        welcome_label = QLabel("🚀 خوش آمدید به پلتفرم معاملاتی")
        welcome_label.setStyleSheet("""
            font-size: 18px; 
            font-weight: bold; 
            color: #0d7377;
            border: none;
        """)
        layout.addWidget(welcome_label)
        
        layout.addStretch()
        
        # Quick action buttons
        self.data_tables_btn = QPushButton("📊 جداول داده‌ها")
        self.data_tables_btn.setMinimumSize(140, 40)
        self.data_tables_btn.setStyleSheet("""
            QPushButton {
                background-color: #0d7377;
                color: white;
                border: none;
                border-radius: 6px;
                font-weight: bold;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #0a5d61;
            }
            QPushButton:pressed {
                background-color: #084d52;
            }
        """)
        layout.addWidget(self.data_tables_btn)
        
        # Charts button
        self.charts_btn = QPushButton("📈 نمودارها")
        self.charts_btn.setMinimumSize(120, 40)
        self.charts_btn.setStyleSheet("""
            QPushButton {
                background-color: #3a3a3a;
                color: white;
                border: 1px solid #555;
                border-radius: 6px;
                font-weight: bold;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #4a4a4a;
            }
            QPushButton:pressed {
                background-color: #2a2a2a;
            }
        """)
        layout.addWidget(self.charts_btn)
        
        # Analysis button
        self.analysis_btn = QPushButton("🔬 تحلیل")
        self.analysis_btn.setMinimumSize(100, 40)
        self.analysis_btn.setStyleSheet("""
            QPushButton {
                background-color: #3a3a3a;
                color: white;
                border: 1px solid #555;
                border-radius: 6px;
                font-weight: bold;
                font-size: 12px;
            }
            QPushButton:hover {
                background-color: #4a4a4a;
            }
            QPushButton:pressed {
                background-color: #2a2a2a;
            }
        """)
        layout.addWidget(self.analysis_btn)
        
        frame.setLayout(layout)
        frame.setMaximumHeight(70)
        return frame
    
    def _setup_menu(self):
        """Setup menu bar"""
        menubar = self.menuBar()
        
        # File menu
        file_menu = menubar.addMenu('فایل')
        
        # Data tables action
        data_tables_action = QAction('📊 جداول داده‌ها', self)
        data_tables_action.setShortcut('Ctrl+D')
        data_tables_action.triggered.connect(self._show_data_tables)
        file_menu.addAction(data_tables_action)
        
        file_menu.addSeparator()
        
        # Import data action
        import_action = QAction('📥 واردات داده', self)
        import_action.triggered.connect(self._import_data)
        file_menu.addAction(import_action)
        
        # Export action
        export_action = QAction('📤 صادرات داده', self)
        export_action.triggered.connect(self._export_data)
        file_menu.addAction(export_action)
        
        file_menu.addSeparator()
        
        # Settings action
        settings_action = QAction('⚙️ تنظیمات', self)
        settings_action.setShortcut('Ctrl+,')
        settings_action.triggered.connect(self._show_settings)
        file_menu.addAction(settings_action)
        
        file_menu.addSeparator()
        
        # Exit action
        exit_action = QAction('❌ خروج', self)
        exit_action.setShortcut(QKeySequence.Quit)
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)
        
        # View menu
        view_menu = menubar.addMenu('نمایش')
        
        # Tab switching actions
        composite_action = QAction('📊 نمودارهای ترکیبی', self)
        composite_action.setShortcut('Ctrl+1')
        composite_action.triggered.connect(lambda: self.main_tabs.setCurrentIndex(0))
        view_menu.addAction(composite_action)
        
        indicators_action = QAction('📈 اندیکاتورها', self)
        indicators_action.setShortcut('Ctrl+2')
        indicators_action.triggered.connect(lambda: self.main_tabs.setCurrentIndex(1))
        view_menu.addAction(indicators_action)
        
        backtest_action = QAction('🔄 بک‌تست', self)
        backtest_action.setShortcut('Ctrl+3')
        backtest_action.triggered.connect(lambda: self.main_tabs.setCurrentIndex(2))
        view_menu.addAction(backtest_action)
        
        view_menu.addSeparator()
        
        # Full screen action
        fullscreen_action = QAction('🖥️ تمام صفحه', self)
        fullscreen_action.setShortcut('F11')
        fullscreen_action.triggered.connect(self._toggle_fullscreen)
        view_menu.addAction(fullscreen_action)
        
        # Tools menu
        tools_menu = menubar.addMenu('ابزار')
        
        # Data management
        data_management_action = QAction('🗃️ مدیریت داده‌ها', self)
        data_management_action.triggered.connect(self._show_data_tables)
        tools_menu.addAction(data_management_action)
        
        # System status
        system_status_action = QAction('💻 وضعیت سیستم', self)
        system_status_action.triggered.connect(self._show_system_status)
        tools_menu.addAction(system_status_action)
        
        tools_menu.addSeparator()
        
        # Clear cache
        clear_cache_action = QAction('🧹 پاک کردن کش', self)
        clear_cache_action.triggered.connect(self._clear_cache)
        tools_menu.addAction(clear_cache_action)
        
        # Help menu
        help_menu = menubar.addMenu('راهنما')
        
        # User guide
        guide_action = QAction('📚 راهنمای کاربر', self)
        guide_action.setShortcut('F1')
        guide_action.triggered.connect(self._show_user_guide)
        help_menu.addAction(guide_action)
        
        # Keyboard shortcuts
        shortcuts_action = QAction('⌨️ میانبرها', self)
        shortcuts_action.triggered.connect(self._show_shortcuts)
        help_menu.addAction(shortcuts_action)
        
        help_menu.addSeparator()
        
        # About
        about_action = QAction('ℹ️ درباره', self)
        about_action.triggered.connect(self._show_about)
        help_menu.addAction(about_action)
    
    def _setup_connections(self):
        """Setup signal connections"""
        self.data_tables_btn.clicked.connect(self._show_data_tables)
        self.charts_btn.clicked.connect(lambda: self.main_tabs.setCurrentIndex(0))
        self.analysis_btn.clicked.connect(lambda: self.main_tabs.setCurrentIndex(1))
    
    def _apply_styling(self):
        """Apply application styling"""
        self.main_tabs.setStyleSheet("""
            QTabWidget::pane {
                border: 1px solid #444;
                background-color: #2d2d2d;
            }
            QTabBar::tab {
                background-color: #3a3a3a;
                color: #ffffff;
                padding: 10px 20px;
                margin-right: 2px;
                border: 1px solid #555;
                border-bottom: none;
                border-top-left-radius: 6px;
                border-top-right-radius: 6px;
                min-width: 150px;
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
    
    def _show_data_tables(self):
        """Show data tables window"""
        if not self.data_tables_window:
            self.data_tables_window = DataTablesWindow(self.container, self)
            
            # Connect chart view signal
            self.data_tables_window.view_stock_chart_requested.connect(
                self._on_stock_chart_requested
            )
        
        self.data_tables_window.show()
        self.data_tables_window.raise_()
        self.data_tables_window.activateWindow()
        
        self.status_bar.showMessage("پنجره جداول داده‌ها باز شد", 3000)
    
    @pyqtSlot(str, int)
    def _on_stock_chart_requested(self, symbol: str, data_type: int):
        """Handle stock chart view request"""
        # Switch to composite charts tab
        self.main_tabs.setCurrentIndex(0)
        
        # Get the composite chart panel and add/show the requested symbol
        composite_panel = self.main_tabs.widget(0)
        if hasattr(composite_panel, 'add_symbol_chart'):
            composite_panel.add_symbol_chart(symbol, data_type)
        
        self.status_bar.showMessage(f"نمودار سهم {symbol} نمایش داده شد", 3000)
        
        # Bring main window to front
        self.raise_()
        self.activateWindow()
    
    def _import_data(self):
        """Import data dialog"""
        QMessageBox.information(self, "واردات داده", 
                               "قابلیت واردات داده در نسخه بعدی اضافه خواهد شد.")
    
    def _export_data(self):
        """Export data dialog"""
        QMessageBox.information(self, "صادرات داده", 
                               "قابلیت صادرات داده در نسخه بعدی اضافه خواهد شد.")
    
    def _show_settings(self):
        """Show settings dialog"""
        QMessageBox.information(self, "تنظیمات", 
                               "پنجره تنظیمات در نسخه بعدی اضافه خواهد شد.")
    
    def _toggle_fullscreen(self):
        """Toggle fullscreen mode"""
        if self.isFullScreen():
            self.showNormal()
            self.status_bar.showMessage("خروج از حالت تمام صفحه", 2000)
        else:
            self.showFullScreen()
            self.status_bar.showMessage("ورود به حالت تمام صفحه - F11 برای خروج", 3000)
    
    def _show_system_status(self):
        """Show system status dialog"""
        try:
            # Get basic system info
            import psutil
            import platform
            
            status_msg = "💻 وضعیت سیستم:\n\n"
            status_msg += f"سیستم عامل: {platform.system()} {platform.release()}\n"
            status_msg += f"پردازنده: {platform.processor()}\n"
            status_msg += f"حافظه: {psutil.virtual_memory().percent:.1f}% استفاده\n"
            status_msg += f"دیسک: {psutil.disk_usage('/').percent:.1f}% استفاده\n\n"
            
            # Database connection status
            try:
                db_connection = self.container.get('db_connection')
                with db_connection.get_connection():
                    status_msg += "🟢 اتصال دیتابیس: فعال\n"
            except:
                status_msg += "🔴 اتصال دیتابیس: قطع\n"
            
            # Services status
            status_msg += f"🟢 سرویس‌های پلتفرم: فعال\n"
            
            QMessageBox.information(self, "وضعیت سیستم", status_msg)
            
        except ImportError:
            QMessageBox.information(self, "وضعیت سیستم", "برای نمایش جزئیات سیستم، psutil نصب کنید.")
        except Exception as e:
            QMessageBox.warning(self, "خطا", f"خطا در دریافت وضعیت سیستم:\n{e}")
    
    def _clear_cache(self):
        """Clear application cache"""
        try:
            # Clear price data manager cache
            price_data_manager = self.container.get('price_data_manager')
            if price_data_manager:
                price_data_manager.clear_cache()
            
            # Clear other caches as needed
            # ...
            
            self.status_bar.showMessage("کش پاک شد", 2000)
            QMessageBox.information(self, "پاک کردن کش", "کش سیستم با موفقیت پاک شد.")
            
        except Exception as e:
            self.logger.error(f"Error clearing cache: {e}")
            QMessageBox.warning(self, "خطا", f"خطا در پاک کردن کش:\n{e}")
    
    def _show_user_guide(self):
        """Show user guide"""
        guide_text = """
        <h3>📚 راهنمای سریع پلتفرم معاملاتی</h3>
        
        <h4>🚀 امکانات اصلی:</h4>
        <ul>
            <li><b>📊 جداول داده‌ها:</b> نمایش ارزها و سهام با فیلترها</li>
            <li><b>📈 نمودارهای ترکیبی:</b> ایجاد نمودارهای سفارشی</li>
            <li><b>📊 اندیکاتورها:</b> تحلیل تکنیکال پیشرفته</li>
            <li><b>🔄 بک‌تست:</b> آزمایش استراتژی‌ها</li>
        </ul>
        
        <h4>🎯 شروع سریع:</h4>
        <ol>
            <li>برای مشاهده داده‌ها: کلیک بر "جداول داده‌ها"</li>
            <li>برای تحلیل: انتخاب سهم و کلیک "نمودار"</li>
            <li>برای تحلیل پیشرفته: استفاده از تب‌های بالا</li>
        </ol>
        
        <h4>⌨️ میانبرهای مهم:</h4>
        <ul>
            <li><b>Ctrl+D:</b> جداول داده‌ها</li>
            <li><b>Ctrl+1,2,3:</b> تب‌های اصلی</li>
            <li><b>F11:</b> تمام صفحه</li>
        </ul>
        """
        
        QMessageBox.about(self, "راهنمای کاربر", guide_text)
    
    def _show_shortcuts(self):
        """Show keyboard shortcuts"""
        shortcuts_text = """
        <h3>⌨️ میانبرهای صفحه کلید</h3>
        
        <h4>عمومی:</h4>
        <ul>
            <li><b>Ctrl+Q</b> - خروج از برنامه</li>
            <li><b>F11</b> - حالت تمام صفحه</li>
            <li><b>F1</b> - راهنمای کاربر</li>
        </ul>
        
        <h4>پنجره‌ها:</h4>
        <ul>
            <li><b>Ctrl+D</b> - جداول داده‌ها</li>
            <li><b>Ctrl+,</b> - تنظیمات</li>
        </ul>
        
        <h4>تب‌ها:</h4>
        <ul>
            <li><b>Ctrl+1</b> - نمودارهای ترکیبی</li>
            <li><b>Ctrl+2</b> - اندیکاتورها</li>
            <li><b>Ctrl+3</b> - بک‌تست</li>
        </ul>
        """
        
        QMessageBox.information(self, "میانبرهای صفحه کلید", shortcuts_text)
    
    def _show_about(self):
        """Show about dialog"""
        about_text = """
        <h3>🚀 پلتفرم معاملاتی</h3>
        <p>نسخه 2.0 - تحلیل دلار و بورس ایران</p>
        
        <h4>🎯 هدف:</h4>
        <p>ارائه ابزارهای پیشرفته برای تحلیل بازارهای مالی ایران با تمرکز بر دلار و سهام</p>
        
        <h4>✨ ویژگی‌های کلیدی:</h4>
        <ul>
            <li>🔄 مدیریت کامل گپ‌های داده</li>
            <li>⚡ موتور عبارات ریاضی پیشرفته</li>
            <li>📊 نمودارهای ترکیبی سفارشی</li>
            <li>🧠 رابط کاربری هوشمند</li>
            <li>💱 پشتیبانی از قیمت‌های تعدیل شده/نشده</li>
            <li>📈 اندیکاتورهای حرفه‌ای TradingView</li>
        </ul>
        
        <h4>🛠️ تکنولوژی:</h4>
        <ul>
            <li>Python & PyQt5</li>
            <li>PostgreSQL</li>
            <li>Real-time Data Processing</li>
            <li>Advanced Mathematical Engine</li>
        </ul>
        
        <p><small>© 2024 - ساخته شده برای تحلیلگران حرفه‌ای</small></p>
        """
        
        QMessageBox.about(self, "درباره پلتفرم معاملاتی", about_text)
    
    def closeEvent(self, event):
        """Handle close event"""
        # Close sub-windows
        if self.data_tables_window:
            self.data_tables_window.close()
        
        event.accept()