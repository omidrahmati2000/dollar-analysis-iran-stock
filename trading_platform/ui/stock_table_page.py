"""
Stock Symbols Table Page - Display stock symbols with joined stock_prices data
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

from ..data.stock_repository import StockRepository, StockData
from ..services.container import ServiceContainer
from ..domain.models import DataType
from ..ui.widgets.data_type_toggle import DataTypeToggle


class StockDataWorker(QThread):
    """Worker thread for loading stock data"""
    
    data_loaded = pyqtSignal(list)  # List[StockData]
    error_occurred = pyqtSignal(str)
    
    def __init__(self, stock_repo: StockRepository,
                 data_type: int = 2,
                 search_term: str = "", 
                 sort_by: str = "symbol", 
                 sort_order: str = "ASC",
                 filters: Dict[str, Any] = None):
        super().__init__()
        self.stock_repo = stock_repo
        self.data_type = data_type
        self.search_term = search_term
        self.sort_by = sort_by
        self.sort_order = sort_order
        self.filters = filters or {}
    
    def run(self):
        try:
            if self.search_term:
                data = self.stock_repo.search_stocks(self.search_term, self.data_type)
            elif self.filters:
                data = self.stock_repo.get_stocks_filtered(self.filters, self.data_type)
            else:
                data = self.stock_repo.get_stocks_sorted(self.sort_by, self.sort_order, self.data_type, limit=1000)
            
            self.data_loaded.emit(data)
            
        except Exception as e:
            self.error_occurred.emit(str(e))


class StockTablePage(QWidget):
    """Stock symbols table page with filtering, sorting and chart navigation"""
    
    # Signal emitted when user wants to view chart
    view_chart_requested = pyqtSignal(str, int)  # symbol, data_type
    
    def __init__(self, container: ServiceContainer, parent=None):
        super().__init__(parent)
        self.container = container
        self.logger = logging.getLogger(__name__)
        
        # Initialize repositories and services
        db_connection = container.get('db_connection')
        self.stock_repo = StockRepository(db_connection)
        self.price_data_manager = container.get('price_data_manager')
        
        # Current data and settings
        self.current_data: List[StockData] = []
        self.current_data_type = DataType.UNADJUSTED.value  # Default: 2
        self.worker = None
        
        # Cache for dropdown options
        self.exchanges = []
        self.sectors = []
        self.industries = []
        
        self._setup_ui()
        self._setup_connections()
        self._load_dropdown_options()
        self._load_initial_data()
    
    def _setup_ui(self):
        """Setup user interface"""
        layout = QVBoxLayout()
        layout.setSpacing(10)
        
        # Title and controls section
        title_layout = QHBoxLayout()
        
        title_label = QLabel("📈 جدول سهام و قیمت‌ها")
        title_label.setStyleSheet("font-size: 16px; font-weight: bold; color: #0d7377;")
        title_layout.addWidget(title_label)
        
        # Data type toggle
        self.data_type_toggle = DataTypeToggle(self.price_data_manager)
        self.data_type_toggle.setEnabled(True)  # Always enabled for stock table
        title_layout.addWidget(self.data_type_toggle)
        
        title_layout.addStretch()
        
        # Chart view button
        self.chart_btn = QPushButton("📊 نمایش نمودار")
        self.chart_btn.setMinimumSize(120, 32)
        self.chart_btn.setEnabled(False)  # Enabled when row is selected
        self.chart_btn.setStyleSheet("""
            QPushButton {
                background-color: #0d7377;
                color: white;
                border: none;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #0a5d61;
            }
            QPushButton:disabled {
                background-color: #444;
                color: #888;
            }
        """)
        title_layout.addWidget(self.chart_btn)
        
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
        
        # Exchange filter
        exchange_label = QLabel("بورس:")
        row1.addWidget(exchange_label)
        
        self.exchange_combo = QComboBox()
        self.exchange_combo.addItem("همه", "")
        self.exchange_combo.setMinimumWidth(120)
        row1.addWidget(self.exchange_combo)
        
        # Sort by
        sort_label = QLabel("مرتب‌سازی:")
        row1.addWidget(sort_label)
        
        self.sort_combo = QComboBox()
        self.sort_combo.addItems([
            "نماد", "نام انگلیسی", "نام فارسی", "بورس", "بخش", 
            "آخرین قیمت", "حجم معاملات", "ارزش بازار"
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
        
        # Sector filter
        sector_label = QLabel("بخش:")
        row2.addWidget(sector_label)
        
        self.sector_combo = QComboBox()
        self.sector_combo.addItem("همه", "")
        self.sector_combo.setMinimumWidth(150)
        row2.addWidget(self.sector_combo)
        
        # Industry filter
        industry_label = QLabel("صنعت:")
        row2.addWidget(industry_label)
        
        self.industry_combo = QComboBox()
        self.industry_combo.addItem("همه", "")
        self.industry_combo.setMinimumWidth(150)
        row2.addWidget(self.industry_combo)
        
        # Price range
        price_group = QGroupBox("محدوده قیمت")
        price_layout = QHBoxLayout()
        
        self.min_price_input = QLineEdit()
        self.min_price_input.setPlaceholderText("حداقل")
        self.min_price_input.setMaximumWidth(80)
        price_layout.addWidget(QLabel("از:"))
        price_layout.addWidget(self.min_price_input)
        
        self.max_price_input = QLineEdit()
        self.max_price_input.setPlaceholderText("حداکثر")
        self.max_price_input.setMaximumWidth(80)
        price_layout.addWidget(QLabel("تا:"))
        price_layout.addWidget(self.max_price_input)
        
        price_group.setLayout(price_layout)
        price_group.setMaximumWidth(200)
        row2.addWidget(price_group)
        
        # Volume and market cap filters
        volume_group = QGroupBox("حجم معاملات")
        volume_layout = QHBoxLayout()
        
        self.min_volume_input = QLineEdit()
        self.min_volume_input.setPlaceholderText("حداقل")
        self.min_volume_input.setMaximumWidth(100)
        volume_layout.addWidget(self.min_volume_input)
        
        volume_group.setLayout(volume_layout)
        volume_group.setMaximumWidth(150)
        row2.addWidget(volume_group)
        
        market_cap_group = QGroupBox("ارزش بازار")
        market_cap_layout = QHBoxLayout()
        
        self.min_market_cap_input = QLineEdit()
        self.min_market_cap_input.setPlaceholderText("حداقل")
        self.min_market_cap_input.setMaximumWidth(100)
        market_cap_layout.addWidget(self.min_market_cap_input)
        
        market_cap_group.setLayout(market_cap_layout)
        market_cap_group.setMaximumWidth(150)
        row2.addWidget(market_cap_group)
        
        # Recent data only
        self.recent_data_checkbox = QCheckBox("فقط داده‌های اخیر (7 روز)")
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
            "نماد", "نام انگلیسی", "نام فارسی", "بورس", "بخش", "صنعت",
            "آخرین قیمت", "قیمت باز", "بالاترین", "پایین‌ترین", "حجم معاملات", 
            "تاریخ آخرین قیمت", "ارزش بازار", "نوع داده", "عملیات"
        ]
        
        table.setColumnCount(len(columns))
        table.setHorizontalHeaderLabels(columns)
        
        # Configure headers
        header = table.horizontalHeader()
        header.setStretchLastSection(False)
        header.setSectionResizeMode(0, QHeaderView.Fixed)  # Symbol
        header.setSectionResizeMode(1, QHeaderView.Stretch)  # Name EN
        header.setSectionResizeMode(2, QHeaderView.Stretch)  # Name FA
        header.setSectionResizeMode(3, QHeaderView.Fixed)  # Exchange
        header.setSectionResizeMode(4, QHeaderView.Stretch)  # Sector
        header.setSectionResizeMode(5, QHeaderView.Stretch)  # Industry
        
        # Set column widths
        table.setColumnWidth(0, 80)   # Symbol
        table.setColumnWidth(3, 80)   # Exchange
        table.setColumnWidth(6, 100)  # Latest Price
        table.setColumnWidth(7, 90)   # Open Price
        table.setColumnWidth(8, 90)   # High Price
        table.setColumnWidth(9, 90)   # Low Price
        table.setColumnWidth(10, 120) # Volume
        table.setColumnWidth(11, 120) # Date
        table.setColumnWidth(12, 120) # Market Cap
        table.setColumnWidth(13, 80)  # Data Type
        table.setColumnWidth(14, 100) # Actions
        
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
        self.chart_btn.clicked.connect(self._view_chart)
        self.apply_filters_btn.clicked.connect(self._apply_filters)
        self.clear_filters_btn.clicked.connect(self._clear_filters)
        self.search_input.returnPressed.connect(self._apply_filters)
        
        # Table selection change
        self.table.itemSelectionChanged.connect(self._on_selection_changed)
        self.table.cellDoubleClicked.connect(self._view_chart)
        
        # Data type toggle
        self.data_type_toggle.data_type_changed.connect(self._on_data_type_changed)
        
        # Exchange/sector change
        self.exchange_combo.currentTextChanged.connect(self._on_exchange_changed)
        self.sector_combo.currentTextChanged.connect(self._on_sector_changed)
        
        # Auto-search with delay
        self.search_timer = QTimer()
        self.search_timer.setSingleShot(True)
        self.search_timer.timeout.connect(self._apply_filters)
        self.search_input.textChanged.connect(lambda: self.search_timer.start(500))
    
    def _load_dropdown_options(self):
        """Load options for dropdown filters"""
        try:
            # Load exchanges
            self.exchanges = self.stock_repo.get_exchanges()
            self.exchange_combo.clear()
            self.exchange_combo.addItem("همه", "")
            for exchange in self.exchanges:
                self.exchange_combo.addItem(exchange, exchange)
            
            # Load sectors
            self.sectors = self.stock_repo.get_sectors()
            self.sector_combo.clear()
            self.sector_combo.addItem("همه", "")
            for sector in self.sectors:
                if sector:
                    self.sector_combo.addItem(sector, sector)
            
            # Load industries
            self.industries = self.stock_repo.get_industries()
            self.industry_combo.clear()
            self.industry_combo.addItem("همه", "")
            for industry in self.industries:
                if industry:
                    self.industry_combo.addItem(industry, industry)
                    
        except Exception as e:
            self.logger.error(f"Error loading dropdown options: {e}")
    
    def _load_initial_data(self):
        """Load initial stock data"""
        self._show_loading(True)
        self.status_label.setText("در حال بارگذاری داده‌ها...")
        
        self.worker = StockDataWorker(self.stock_repo, data_type=self.current_data_type)
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
            "بورس": "exchange",
            "بخش": "sector",
            "آخرین قیمت": "latest_price",
            "حجم معاملات": "volume",
            "ارزش بازار": "market_cap"
        }
        
        sort_by = sort_mapping.get(self.sort_combo.currentText(), "symbol")
        sort_order = "ASC" if self.sort_order_combo.currentText() == "صعودی" else "DESC"
        
        # Advanced filters
        filters = {}
        
        # Exchange filter
        if self.exchange_combo.currentData():
            filters['exchange'] = self.exchange_combo.currentData()
        
        # Sector filter
        if self.sector_combo.currentData():
            filters['sector'] = self.sector_combo.currentData()
        
        # Industry filter
        if self.industry_combo.currentData():
            filters['industry'] = self.industry_combo.currentData()
        
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
        
        # Volume filter
        try:
            if self.min_volume_input.text():
                filters['min_volume'] = int(self.min_volume_input.text())
        except ValueError:
            pass
        
        # Market cap filter
        try:
            if self.min_market_cap_input.text():
                filters['min_market_cap'] = float(self.min_market_cap_input.text())
        except ValueError:
            pass
        
        # Recent data only
        if self.recent_data_checkbox.isChecked():
            filters['has_recent_data'] = True
        
        # Create worker with current parameters
        self.worker = StockDataWorker(
            self.stock_repo,
            data_type=self.current_data_type,
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
        self.exchange_combo.setCurrentIndex(0)
        self.sector_combo.setCurrentIndex(0)
        self.industry_combo.setCurrentIndex(0)
        self.sort_combo.setCurrentText("نماد")
        self.sort_order_combo.setCurrentText("صعودی")
        self.min_price_input.clear()
        self.max_price_input.clear()
        self.min_volume_input.clear()
        self.min_market_cap_input.clear()
        self.recent_data_checkbox.setChecked(False)
        
        self._load_initial_data()
    
    @pyqtSlot(list)
    def _on_data_loaded(self, data: List[StockData]):
        """Handle loaded data"""
        self.current_data = data
        self._populate_table(data)
        self.status_label.setText(f"نمایش {len(data)} سهم")
    
    @pyqtSlot(str)
    def _on_error(self, error_message: str):
        """Handle loading error"""
        self.logger.error(f"Error loading stock data: {error_message}")
        self.status_label.setText("خطا در بارگذاری داده‌ها")
        QMessageBox.warning(self, "خطا", f"خطا در بارگذاری داده‌ها:\n{error_message}")
    
    def _populate_table(self, data: List[StockData]):
        """Populate table with stock data"""
        self.table.setRowCount(len(data))
        
        for row, stock in enumerate(data):
            # Symbol
            self.table.setItem(row, 0, QTableWidgetItem(stock.symbol or ""))
            
            # Name EN
            self.table.setItem(row, 1, QTableWidgetItem(stock.name or ""))
            
            # Name FA
            self.table.setItem(row, 2, QTableWidgetItem(stock.name_fa or ""))
            
            # Exchange
            self.table.setItem(row, 3, QTableWidgetItem(stock.exchange or ""))
            
            # Sector
            self.table.setItem(row, 4, QTableWidgetItem(stock.sector or ""))
            
            # Industry
            self.table.setItem(row, 5, QTableWidgetItem(stock.industry or ""))
            
            # Latest Price (Close)
            price_item = QTableWidgetItem("")
            if stock.latest_price is not None:
                price_item.setText(f"{stock.latest_price:,.2f}")
                price_item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
            self.table.setItem(row, 6, price_item)
            
            # Open Price
            open_item = QTableWidgetItem("")
            if stock.open_price is not None:
                open_item.setText(f"{stock.open_price:,.2f}")
                open_item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
            self.table.setItem(row, 7, open_item)
            
            # High Price
            high_item = QTableWidgetItem("")
            if stock.high_price is not None:
                high_item.setText(f"{stock.high_price:,.2f}")
                high_item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
            self.table.setItem(row, 8, high_item)
            
            # Low Price
            low_item = QTableWidgetItem("")
            if stock.low_price is not None:
                low_item.setText(f"{stock.low_price:,.2f}")
                low_item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
            self.table.setItem(row, 9, low_item)
            
            # Volume
            volume_item = QTableWidgetItem("")
            if stock.volume is not None:
                volume_item.setText(f"{stock.volume:,}")
                volume_item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
            self.table.setItem(row, 10, volume_item)
            
            # Latest Date
            date_item = QTableWidgetItem("")
            if stock.latest_date:
                if isinstance(stock.latest_date, datetime):
                    date_item.setText(stock.latest_date.strftime("%Y/%m/%d"))
                else:
                    date_item.setText(str(stock.latest_date))
            self.table.setItem(row, 11, date_item)
            
            # Market Cap
            market_cap_item = QTableWidgetItem("")
            if stock.market_cap is not None:
                market_cap_item.setText(f"{stock.market_cap:,.0f}")
                market_cap_item.setTextAlignment(Qt.AlignRight | Qt.AlignVCenter)
            self.table.setItem(row, 12, market_cap_item)
            
            # Data Type
            data_type_text = "تعدیل نشده" if stock.data_type == 2 else "تعدیل شده" if stock.data_type == 3 else ""
            self.table.setItem(row, 13, QTableWidgetItem(data_type_text))
            
            # Actions - Chart button
            chart_btn = QPushButton("📊 نمودار")
            chart_btn.setMaximumSize(80, 25)
            chart_btn.setStyleSheet("""
                QPushButton {
                    background-color: #0d7377;
                    color: white;
                    border: none;
                    border-radius: 3px;
                    font-size: 10px;
                }
                QPushButton:hover {
                    background-color: #0a5d61;
                }
            """)
            chart_btn.clicked.connect(lambda checked, r=row: self._view_chart_for_row(r))
            self.table.setCellWidget(row, 14, chart_btn)
    
    def _on_selection_changed(self):
        """Handle table selection change"""
        has_selection = bool(self.table.currentRow() >= 0)
        self.chart_btn.setEnabled(has_selection)
    
    def _on_data_type_changed(self, symbol, data_type):
        """Handle data type change from toggle"""
        self.current_data_type = data_type.value
        self._apply_filters()  # Reload data with new data type
    
    def _on_exchange_changed(self, exchange_text):
        """Handle exchange selection change"""
        # Update sectors based on selected exchange
        if exchange_text and exchange_text != "همه":
            sectors = self.stock_repo.get_sectors(exchange_text)
        else:
            sectors = self.sectors
        
        current_sector = self.sector_combo.currentData()
        self.sector_combo.clear()
        self.sector_combo.addItem("همه", "")
        
        for sector in sectors:
            if sector:
                self.sector_combo.addItem(sector, sector)
        
        # Restore selection if possible
        index = self.sector_combo.findData(current_sector)
        if index >= 0:
            self.sector_combo.setCurrentIndex(index)
    
    def _on_sector_changed(self, sector_text):
        """Handle sector selection change"""
        # Update industries based on selected sector
        if sector_text and sector_text != "همه":
            industries = self.stock_repo.get_industries(sector_text)
        else:
            industries = self.industries
        
        current_industry = self.industry_combo.currentData()
        self.industry_combo.clear()
        self.industry_combo.addItem("همه", "")
        
        for industry in industries:
            if industry:
                self.industry_combo.addItem(industry, industry)
        
        # Restore selection if possible
        index = self.industry_combo.findData(current_industry)
        if index >= 0:
            self.industry_combo.setCurrentIndex(index)
    
    def _view_chart(self):
        """View chart for selected stock"""
        current_row = self.table.currentRow()
        if current_row >= 0:
            self._view_chart_for_row(current_row)
    
    def _view_chart_for_row(self, row: int):
        """View chart for specific row"""
        if 0 <= row < len(self.current_data):
            stock = self.current_data[row]
            self.view_chart_requested.emit(stock.symbol, self.current_data_type)
    
    def _show_loading(self, show: bool):
        """Show/hide loading indicator"""
        self.progress_bar.setVisible(show)
        self.refresh_btn.setEnabled(not show)
        self.apply_filters_btn.setEnabled(not show)
    
    def get_selected_stock(self) -> Optional[StockData]:
        """Get currently selected stock"""
        current_row = self.table.currentRow()
        if 0 <= current_row < len(self.current_data):
            return self.current_data[current_row]
        return None
    
    def refresh_data(self):
        """Public method to refresh data"""
        self._apply_filters()
    
    def set_data_type(self, data_type: DataType):
        """Set data type externally"""
        self.current_data_type = data_type.value
        self.data_type_toggle.set_data_type(data_type)
        self._apply_filters()