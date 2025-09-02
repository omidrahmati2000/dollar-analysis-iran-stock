"""
Currency Data Table Page - Display currencies with latest prices from currency_history
"""
from PyQt5.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QTableWidget, 
                             QTableWidgetItem, QPushButton, QLineEdit, QLabel,
                             QComboBox, QSpinBox, QCheckBox, QGroupBox, QSplitter,
                             QHeaderView, QAbstractItemView, QMessageBox, QProgressBar,
                             QFrame)
from PyQt5.QtCore import Qt, QTimer, pyqtSignal, QThread, pyqtSlot
from PyQt5.QtGui import QFont, QColor, QPalette
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import logging

from ..data.currency_repository import CurrencyRepository, CurrencyData
from ..services.container import ServiceContainer


class CurrencyDataWorker(QThread):
    """Worker thread for loading currency data"""
    
    data_loaded = pyqtSignal(list)  # List[CurrencyData]
    error_occurred = pyqtSignal(str)
    
    def __init__(self, currency_repo: CurrencyRepository, 
                 search_term: str = "", 
                 sort_by: str = "symbol", 
                 sort_order: str = "ASC",
                 filters: Dict[str, Any] = None):
        super().__init__()
        self.currency_repo = currency_repo
        self.search_term = search_term
        self.sort_by = sort_by
        self.sort_order = sort_order
        self.filters = filters or {}
    
    def run(self):
        try:
            if self.search_term:
                data = self.currency_repo.search_currencies(self.search_term)
            elif self.filters:
                data = self.currency_repo.get_currencies_filtered(self.filters)
            else:
                data = self.currency_repo.get_currencies_sorted(self.sort_by, self.sort_order, limit=1000)
            
            self.data_loaded.emit(data)
            
        except Exception as e:
            self.error_occurred.emit(str(e))


class CurrencyTablePage(QWidget):
    """Currency data table page with filtering and sorting"""
    
    def __init__(self, container: ServiceContainer, parent=None):
        super().__init__(parent)
        self.container = container
        self.logger = logging.getLogger(__name__)
        
        # Initialize repository
        db_connection = container.get('db_connection')
        self.currency_repo = CurrencyRepository(db_connection)
        
        # Current data
        self.current_data: List[CurrencyData] = []
        self.worker = None
        
        self._setup_ui()
        self._setup_connections()
        self._load_initial_data()
    
    def _setup_ui(self):
        """Setup user interface"""
        layout = QVBoxLayout()
        layout.setSpacing(10)
        
        # Title and refresh section
        title_layout = QHBoxLayout()
        
        title_label = QLabel("💱 جدول ارزها و قیمت‌های آخرین")
        title_label.setStyleSheet("font-size: 16px; font-weight: bold; color: #0d7377;")
        title_layout.addWidget(title_label)
        
        title_layout.addStretch()
        
        # Refresh button
        self.refresh_btn = QPushButton("🔄 بروزرسانی")
        self.refresh_btn.setMinimumSize(120, 32)
        title_layout.addWidget(self.refresh_btn)
        
        layout.addLayout(title_layout)
        
        # Filters section
        filters_frame = self._create_filters_section()
        layout.addWidget(filters_frame)
        
        # Progress bar
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        self.progress_bar.setRange(0, 0)  # Indeterminate
        layout.addWidget(self.progress_bar)
        
        # Table
        self.table = self._create_table()
        layout.addWidget(self.table)
        
        # Status bar
        self.status_label = QLabel("آماده")
        self.status_label.setStyleSheet("color: #888; padding: 5px;")
        layout.addWidget(self.status_label)
        
        self.setLayout(layout)
    
    def _create_filters_section(self) -> QFrame:
        """Create filters section"""
        frame = QFrame()
        frame.setFrameStyle(QFrame.StyledPanel)
        frame.setStyleSheet("QFrame { background-color: #2a2a2a; border-radius: 6px; }")
        
        layout = QVBoxLayout()
        layout.setContentsMargins(10, 8, 10, 8)
        
        # First row - Search and basic filters
        row1 = QHBoxLayout()
        
        # Search
        search_label = QLabel("جستجو:")
        row1.addWidget(search_label)
        
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("جستجو بر اساس نماد، نام انگلیسی یا فارسی...")
        self.search_input.setMinimumWidth(250)
        row1.addWidget(self.search_input)
        
        # Sort by
        sort_label = QLabel("مرتب‌سازی:")
        row1.addWidget(sort_label)
        
        self.sort_combo = QComboBox()
        self.sort_combo.addItems([
            "نماد", "نام انگلیسی", "نام فارسی", "آخرین قیمت", 
            "تغییر 24 ساعته", "درصد تغییر", "حجم معاملات", "ارزش بازار"
        ])
        self.sort_combo.setCurrentText("نماد")
        row1.addWidget(self.sort_combo)
        
        # Sort order
        self.sort_order_combo = QComboBox()
        self.sort_order_combo.addItems(["صعودی", "نزولی"])
        row1.addWidget(self.sort_order_combo)
        
        row1.addStretch()
        
        # Apply filters button
        self.apply_filters_btn = QPushButton("اعمال فیلتر")
        self.apply_filters_btn.setMinimumSize(100, 28)
        row1.addWidget(self.apply_filters_btn)
        
        layout.addLayout(row1)
        
        # Second row - Advanced filters
        row2 = QHBoxLayout()
        
        # Price range
        price_group = QGroupBox("محدوده قیمت")\n        price_layout = QHBoxLayout()
        
        self.min_price_input = QLineEdit()
        self.min_price_input.setPlaceholderText("حداقل")\n        self.min_price_input.setMaximumWidth(80)
        price_layout.addWidget(QLabel("از:"))\n        price_layout.addWidget(self.min_price_input)
        
        self.max_price_input = QLineEdit()
        self.max_price_input.setPlaceholderText("حداکثر")\n        self.max_price_input.setMaximumWidth(80)
        price_layout.addWidget(QLabel("تا:"))\n        price_layout.addWidget(self.max_price_input)
        
        price_group.setLayout(price_layout)
        price_group.setMaximumWidth(200)
        row2.addWidget(price_group)
        
        # Change percentage filter
        change_group = QGroupBox("درصد تغییر 24 ساعته")
        change_layout = QHBoxLayout()
        
        self.min_change_input = QLineEdit()
        self.min_change_input.setPlaceholderText("-100")
        self.min_change_input.setMaximumWidth(60)
        change_layout.addWidget(QLabel("از:"))\n        change_layout.addWidget(self.min_change_input)
        
        self.max_change_input = QLineEdit()
        self.max_change_input.setPlaceholderText("100")
        self.max_change_input.setMaximumWidth(60)
        change_layout.addWidget(QLabel("تا:"))\n        change_layout.addWidget(self.max_change_input)
        
        change_group.setLayout(change_layout)
        change_group.setMaximumWidth(180)
        row2.addWidget(change_group)
        
        # Volume filter
        volume_group = QGroupBox("حجم معاملات")
        volume_layout = QHBoxLayout()
        
        self.min_volume_input = QLineEdit()
        self.min_volume_input.setPlaceholderText("حداقل حجم")
        self.min_volume_input.setMaximumWidth(100)
        volume_layout.addWidget(self.min_volume_input)
        
        volume_group.setLayout(volume_layout)
        volume_group.setMaximumWidth(150)
        row2.addWidget(volume_group)
        
        # Recent data only
        self.recent_data_checkbox = QCheckBox("فقط داده‌های اخیر (7 روز گذشته)")
        row2.addWidget(self.recent_data_checkbox)
        
        row2.addStretch()
        
        # Clear filters
        self.clear_filters_btn = QPushButton("پاک کردن فیلترها")
        row2.addWidget(self.clear_filters_btn)
        
        layout.addLayout(row2)
        
        frame.setLayout(layout)
        return frame
    
    def _create_table(self) -> QTableWidget:
        """Create and configure the data table"""
        table = QTableWidget()
        table.setAlternatingRowColors(True)
        table.setSelectionBehavior(QAbstractItemView.SelectRows)
        table.setSelectionMode(QAbstractItemView.SingleSelection)
        table.setSortingEnabled(True)
        
        # Define columns
        columns = [
            "نماد", "نام انگلیسی", "نام فارسی", "آخرین قیمت", "تاریخ آخرین قیمت",
            "تغییر 24 ساعته", "درصد تغییر", "حجم معاملات", "ارزش بازار"
        ]
        
        table.setColumnCount(len(columns))
        table.setHorizontalHeaderLabels(columns)
        
        # Configure headers
        header = table.horizontalHeader()
        header.setStretchLastSection(False)
        header.setSectionResizeMode(0, QHeaderView.Fixed)  # Symbol
        header.setSectionResizeMode(1, QHeaderView.Stretch)  # Name EN
        header.setSectionResizeMode(2, QHeaderView.Stretch)  # Name FA
        header.setSectionResizeMode(3, QHeaderView.Fixed)  # Latest Price
        header.setSectionResizeMode(4, QHeaderView.Fixed)  # Date
        header.setSectionResizeMode(5, QHeaderView.Fixed)  # Change 24h
        header.setSectionResizeMode(6, QHeaderView.Fixed)  # Change %
        header.setSectionResizeMode(7, QHeaderView.Fixed)  # Volume
        header.setSectionResizeMode(8, QHeaderView.Fixed)  # Market Cap
        
        # Set column widths
        table.setColumnWidth(0, 80)   # Symbol
        table.setColumnWidth(3, 100)  # Latest Price
        table.setColumnWidth(4, 120)  # Date
        table.setColumnWidth(5, 90)   # Change 24h
        table.setColumnWidth(6, 80)   # Change %
        table.setColumnWidth(7, 120)  # Volume
        table.setColumnWidth(8, 120)  # Market Cap
        
        # Style
        table.setStyleSheet("""
            QTableWidget {
                gridline-color: #444;
                background-color: #2d2d2d;
                selection-background-color: #0d7377;
            }
            QTableWidget::item {
                padding: 8px;
                border-bottom: 1px solid #3a3a3a;
            }
            QTableWidget::item:selected {
                background-color: #0d7377;
                color: white;
            }
        """)
        
        return table
    
    def _setup_connections(self):
        """Setup signal connections"""
        self.refresh_btn.clicked.connect(self._load_initial_data)
        self.apply_filters_btn.clicked.connect(self._apply_filters)
        self.clear_filters_btn.clicked.connect(self._clear_filters)
        self.search_input.returnPressed.connect(self._apply_filters)
        
        # Auto-search with delay
        self.search_timer = QTimer()
        self.search_timer.setSingleShot(True)
        self.search_timer.timeout.connect(self._apply_filters)
        self.search_input.textChanged.connect(lambda: self.search_timer.start(500))
    
    def _load_initial_data(self):
        """Load initial currency data"""
        self._show_loading(True)
        self.status_label.setText("در حال بارگذاری داده‌ها...")
        
        self.worker = CurrencyDataWorker(self.currency_repo)
        self.worker.data_loaded.connect(self._on_data_loaded)
        self.worker.error_occurred.connect(self._on_error)
        self.worker.finished.connect(lambda: self._show_loading(False))
        self.worker.start()
    
    def _apply_filters(self):
        """Apply current filters and reload data"""
        self._show_loading(True)
        self.status_label.setText("در حال اعمال فیلترها...")
        
        # Get current filter values
        search_term = self.search_input.text().strip()
        
        # Sort settings
        sort_mapping = {
            "نماد": "symbol",
            "نام انگلیسی": "name", 
            "نام فارسی": "name_fa",
            "آخرین قیمت": "latest_price",
            "تغییر 24 ساعته": "change_24h",
            "درصد تغییر": "change_percent_24h",
            "حجم معاملات": "volume_24h",
            "ارزش بازار": "market_cap"
        }
        
        sort_by = sort_mapping.get(self.sort_combo.currentText(), "symbol")
        sort_order = "ASC" if self.sort_order_combo.currentText() == "صعودی" else "DESC"
        
        # Advanced filters
        filters = {}
        
        # Price range
        try:
            if self.min_price_input.text():
                filters['min_price'] = float(self.min_price_input.text())
        except ValueError:
            pass
        
        try:
            if self.max_price_input.text():
                filters['max_price'] = float(self.max_price_input.text())
        except ValueError:
            pass
        
        # Change percentage range
        try:
            if self.min_change_input.text():
                filters['min_change'] = float(self.min_change_input.text())
        except ValueError:
            pass
        
        try:
            if self.max_change_input.text():
                filters['max_change'] = float(self.max_change_input.text())
        except ValueError:
            pass
        
        # Volume filter
        try:
            if self.min_volume_input.text():
                filters['min_volume'] = float(self.min_volume_input.text())
        except ValueError:
            pass
        
        # Recent data only
        if self.recent_data_checkbox.isChecked():
            filters['has_recent_data'] = True
        
        # Create worker with current parameters
        self.worker = CurrencyDataWorker(
            self.currency_repo, 
            search_term=search_term,
            sort_by=sort_by,
            sort_order=sort_order,
            filters=filters if filters else None
        )
        self.worker.data_loaded.connect(self._on_data_loaded)
        self.worker.error_occurred.connect(self._on_error)
        self.worker.finished.connect(lambda: self._show_loading(False))
        self.worker.start()
    
    def _clear_filters(self):
        """Clear all filters"""
        self.search_input.clear()
        self.sort_combo.setCurrentText("نماد")
        self.sort_order_combo.setCurrentText("صعودی")
        self.min_price_input.clear()
        self.max_price_input.clear()
        self.min_change_input.clear()
        self.max_change_input.clear()
        self.min_volume_input.clear()
        self.recent_data_checkbox.setChecked(False)
        
        self._load_initial_data()
    
    @pyqtSlot(list)
    def _on_data_loaded(self, data: List[CurrencyData]):
        """Handle loaded data"""
        self.current_data = data
        self._populate_table(data)
        self.status_label.setText(f"نمایش {len(data)} ارز")
    
    @pyqtSlot(str)
    def _on_error(self, error_message: str):
        """Handle loading error"""
        self.logger.error(f"Error loading currency data: {error_message}")
        self.status_label.setText("خطا در بارگذاری داده‌ها")
        QMessageBox.warning(self, "خطا", f"خطا در بارگذاری داده‌ها:\n{error_message}")
    
    def _populate_table(self, data: List[CurrencyData]):
        """Populate table with currency data"""
        self.table.setRowCount(len(data))
        
        for row, currency in enumerate(data):
            # Symbol
            self.table.setItem(row, 0, QTableWidgetItem(currency.symbol or ""))
            
            # Name EN
            self.table.setItem(row, 1, QTableWidgetItem(currency.name or ""))
            
            # Name FA
            self.table.setItem(row, 2, QTableWidgetItem(currency.name_fa or ""))
            
            # Latest Price
            price_item = QTableWidgetItem("")
            if currency.latest_price is not None:
                price_item.setText(f"{currency.latest_price:,.2f}")
                price_item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
            self.table.setItem(row, 3, price_item)
            
            # Latest Date
            date_item = QTableWidgetItem("")
            if currency.latest_date:
                if isinstance(currency.latest_date, datetime):
                    date_item.setText(currency.latest_date.strftime("%Y/%m/%d %H:%M"))
                else:
                    date_item.setText(str(currency.latest_date))
            self.table.setItem(row, 4, date_item)
            
            # Change 24h
            change_item = QTableWidgetItem("")
            if currency.change_24h is not None:
                change_item.setText(f"{currency.change_24h:,.2f}")
                change_item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
                # Color based on change
                if currency.change_24h > 0:
                    change_item.setBackground(QColor(76, 175, 80, 50))  # Green
                elif currency.change_24h < 0:
                    change_item.setBackground(QColor(244, 67, 54, 50))  # Red
            self.table.setItem(row, 5, change_item)
            
            # Change Percent 24h
            change_pct_item = QTableWidgetItem("")
            if currency.change_percent_24h is not None:
                change_pct_item.setText(f"{currency.change_percent_24h:.2f}%")
                change_pct_item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
                # Color based on change
                if currency.change_percent_24h > 0:
                    change_pct_item.setBackground(QColor(76, 175, 80, 50))  # Green
                elif currency.change_percent_24h < 0:
                    change_pct_item.setBackground(QColor(244, 67, 54, 50))  # Red
            self.table.setItem(row, 6, change_pct_item)
            
            # Volume 24h
            volume_item = QTableWidgetItem("")
            if currency.volume_24h is not None:
                volume_item.setText(f"{currency.volume_24h:,.0f}")
                volume_item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
            self.table.setItem(row, 7, volume_item)
            
            # Market Cap
            market_cap_item = QTableWidgetItem("")
            if currency.market_cap is not None:
                market_cap_item.setText(f"{currency.market_cap:,.0f}")
                market_cap_item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
            self.table.setItem(row, 8, market_cap_item)
    
    def _show_loading(self, show: bool):
        """Show/hide loading indicator"""
        self.progress_bar.setVisible(show)
        self.refresh_btn.setEnabled(not show)
        self.apply_filters_btn.setEnabled(not show)
    
    def get_selected_currency(self) -> Optional[CurrencyData]:
        """Get currently selected currency"""
        current_row = self.table.currentRow()
        if 0 <= current_row < len(self.current_data):
            return self.current_data[current_row]
        return None
    
    def refresh_data(self):
        """Public method to refresh data"""
        self._apply_filters()