#!/usr/bin/env python3
"""
Trading Platform GUI
Professional desktop application that consumes REST API data
"""

import sys
import os
from datetime import datetime, timedelta
import json
from pathlib import Path
import requests
from typing import List, Dict, Any, Optional

try:
    from PyQt5.QtWidgets import *
    from PyQt5.QtCore import *
    from PyQt5.QtGui import *
    import pandas as pd
    import numpy as np
    
    # Import our custom chart widget
    TradingChartWidget = None
    try:
        from .chart_widget import TradingChartWidget
    except ImportError:
        try:
            # Fallback for direct execution
            from chart_widget import TradingChartWidget
        except ImportError:
            # If chart widget can't be imported, we'll create a simple fallback
            print("Warning: Advanced chart widget unavailable. Using basic chart interface.")
            TradingChartWidget = None
        
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install with: pip install PyQt5 pandas numpy requests matplotlib mplfinance")
    sys.exit(1)

class ApiClient:
    """HTTP client for API communication with new v2 API"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.api_version = "v2"  # Using new v2 API
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'User-Agent': 'TradingPlatform/2.0'
        })
    
    def test_connection(self) -> bool:
        """Test API connection"""
        try:
            # Try health endpoint first, fallback to root
            response = self.session.get(f"{self.base_url}/health", timeout=5)
            if response.status_code == 200:
                return True
            # Fallback to root endpoint
            response = self.session.get(f"{self.base_url}/", timeout=5)
            return response.status_code == 200
        except Exception:
            return False
    
    def get_stocks(self, limit: int = 50, symbol_filter: str = None, 
                  min_volume: int = None, sort_by: str = "volume") -> List[Dict]:
        """Get stocks data with filters from v2 API"""
        try:
            params = {
                'limit': limit,
                'sort_by': sort_by
            }
            
            if symbol_filter:
                params['symbol_filter'] = symbol_filter
            if min_volume:
                params['min_volume'] = min_volume
                
            response = self.session.get(f"{self.base_url}/api/{self.api_version}/stocks", params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"API Error getting stocks: {e}")
            return []
    
    def get_currencies(self, limit: int = 20, currency_filter: str = None) -> List[Dict]:
        """Get currencies data from v2 API"""
        try:
            params = {'limit': limit}
            if currency_filter:
                params['currency_filter'] = currency_filter
                
            response = self.session.get(f"{self.base_url}/api/{self.api_version}/currencies", params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"API Error getting currencies: {e}")
            return []
    
    def get_ohlcv(self, symbol: str, days: int = 30) -> List[Dict]:
        """Get OHLCV data for symbol from v2 API"""
        try:
            params = {'days': days}
            response = self.session.get(f"{self.base_url}/api/{self.api_version}/stocks/{symbol}/ohlcv", params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"API Error getting OHLCV for {symbol}: {e}")
            return []
    
    def get_indicators(self, symbol: str, indicators: List[str] = None) -> List[Dict]:
        """Get technical indicators from v2 API"""
        try:
            if indicators is None:
                indicators = ["SMA_20", "EMA_12", "RSI_14"]
                
            params = {'indicators': ','.join(indicators)} if indicators else {}
            response = self.session.get(f"{self.base_url}/api/{self.api_version}/indicators/{symbol}", params=params, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"API Error getting indicators for {symbol}: {e}")
            return []
    
    def get_market_summary(self) -> Dict:
        """Get market summary from v2 API"""
        try:
            response = self.session.get(f"{self.base_url}/api/{self.api_version}/market/summary", timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"API Error getting market summary: {e}")
            return {}
    
    def search_symbols(self, query: str, limit: int = 10) -> List[Dict]:
        """Search symbols using v2 API"""
        try:
            params = {'limit': limit}
            response = self.session.get(f"{self.base_url}/api/{self.api_version}/stocks/search/{query}", params=params, timeout=5)
            response.raise_for_status()
            return response.json().get('results', [])
        except Exception as e:
            print(f"API Error searching symbols: {e}")
            return []

class DataWorker(QThread):
    """Worker thread for API data fetching"""
    
    data_updated = pyqtSignal(dict)
    error_occurred = pyqtSignal(str)
    
    def __init__(self, api_client: ApiClient):
        super().__init__()
        self.api_client = api_client
        self.running = True
    
    def run(self):
        """Main worker loop"""
        while self.running:
            try:
                # Fetch all data
                data = {
                    'stocks': self.api_client.get_stocks(limit=100),
                    'currencies': self.api_client.get_currencies(),
                    'market_summary': self.api_client.get_market_summary(),
                    'timestamp': datetime.now().isoformat()
                }
                
                self.data_updated.emit(data)
                
                # Wait 5 seconds before next update
                self.msleep(5000)
                
            except Exception as e:
                self.error_occurred.emit(f"Data fetch error: {str(e)}")
                self.msleep(10000)  # Wait longer on error
    
    def stop(self):
        """Stop the worker"""
        self.running = False
        self.quit()
        self.wait()

class ApiTradingPlatform(QMainWindow):
    """Main trading platform window with API integration"""
    
    def __init__(self):
        super().__init__()
        self.api_client = ApiClient()
        self.data_worker = None
        self.current_data = {}
        
        # Check API connection
        if not self.api_client.test_connection():
            QMessageBox.critical(self, "Connection Error", 
                               "Cannot connect to API server at http://localhost:8000\n\n"
                               "Make sure the new v2 API server is running:\n"
                               "cd app && python main.py")
            sys.exit(1)
        
        self.init_ui()
        self.setup_data_worker()
        
    def init_ui(self):
        """Initialize user interface"""
        self.setWindowTitle("Iran Market Trading Platform - API v2.0")
        self.setGeometry(100, 100, 1600, 1000)
        
        # Create central widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Main layout
        main_layout = QHBoxLayout(central_widget)
        
        # Create splitter
        splitter = QSplitter(Qt.Horizontal)
        main_layout.addWidget(splitter)
        
        # Left panel
        left_panel = self.create_left_panel()
        splitter.addWidget(left_panel)
        
        # Right panel
        right_panel = self.create_right_panel()
        splitter.addWidget(right_panel)
        
        # Set proportions
        splitter.setSizes([400, 1200])
        
        # Apply styles
        self.apply_styles()
        
        # Status bar
        self.statusBar().showMessage("Connected to API | Fetching live data...")
        
        # Menu bar
        self.create_menu_bar()
    
    def create_menu_bar(self):
        """Create menu bar"""
        menubar = self.menuBar()
        
        # File menu
        file_menu = menubar.addMenu('File')
        
        export_action = QAction('Export Data', self)
        export_action.triggered.connect(self.export_data)
        file_menu.addAction(export_action)
        
        file_menu.addSeparator()
        
        exit_action = QAction('Exit', self)
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)
        
        # Tools menu
        tools_menu = menubar.addMenu('Tools')
        
        refresh_action = QAction('Refresh All Data', self)
        refresh_action.triggered.connect(self.force_refresh)
        tools_menu.addAction(refresh_action)
        
        api_status_action = QAction('API Status', self)
        api_status_action.triggered.connect(self.show_api_status)
        tools_menu.addAction(api_status_action)
    
    def create_left_panel(self):
        """Create left control panel"""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        
        # API Status
        api_group = QGroupBox("API Connection")
        api_layout = QVBoxLayout(api_group)
        
        self.api_status_label = QLabel("Status: Connected")
        self.api_status_label.setStyleSheet("color: #4CAF50; font-weight: bold;")
        api_layout.addWidget(self.api_status_label)
        
        self.api_url_label = QLabel("URL: http://localhost:8000 (API v2)")
        api_layout.addWidget(self.api_url_label)
        
        self.api_version_label = QLabel("Version: 2.0.0")
        api_layout.addWidget(self.api_version_label)
        
        layout.addWidget(api_group)
        
        # Market Overview
        market_group = QGroupBox("Market Overview")
        market_layout = QVBoxLayout(market_group)
        
        self.total_volume_label = QLabel("Total Volume: Loading...")
        self.total_trades_label = QLabel("Total Trades: Loading...")
        self.active_symbols_label = QLabel("Active Symbols: Loading...")
        self.market_cap_label = QLabel("Market Cap: Loading...")
        
        market_layout.addWidget(self.total_volume_label)
        market_layout.addWidget(self.total_trades_label)
        market_layout.addWidget(self.active_symbols_label)
        market_layout.addWidget(self.market_cap_label)
        
        layout.addWidget(market_group)
        
        # Search
        search_group = QGroupBox("Symbol Search")
        search_layout = QVBoxLayout(search_group)
        
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Search symbols...")
        self.search_input.textChanged.connect(self.search_symbols)
        search_layout.addWidget(self.search_input)
        
        self.search_results = QListWidget()
        self.search_results.itemClicked.connect(self.symbol_selected)
        search_layout.addWidget(self.search_results)
        
        layout.addWidget(search_group)
        
        # Filters
        filters_group = QGroupBox("Data Filters")
        filters_layout = QVBoxLayout(filters_group)
        
        # Volume filter
        volume_layout = QHBoxLayout()
        volume_layout.addWidget(QLabel("Min Volume:"))
        self.volume_filter = QSpinBox()
        self.volume_filter.setRange(0, 999999999)
        self.volume_filter.setSuffix("M")
        self.volume_filter.valueChanged.connect(self.apply_filters)
        volume_layout.addWidget(self.volume_filter)
        filters_layout.addLayout(volume_layout)
        
        # Sort options
        sort_layout = QHBoxLayout()
        sort_layout.addWidget(QLabel("Sort by:"))
        self.sort_combo = QComboBox()
        self.sort_combo.addItems(["Volume", "Price", "Change %"])
        self.sort_combo.currentTextChanged.connect(self.apply_filters)
        sort_layout.addWidget(self.sort_combo)
        filters_layout.addLayout(sort_layout)
        
        layout.addWidget(filters_group)
        
        # Controls
        controls_group = QGroupBox("Controls")
        controls_layout = QVBoxLayout(controls_group)
        
        refresh_btn = QPushButton("Refresh Now")
        refresh_btn.clicked.connect(self.force_refresh)
        controls_layout.addWidget(refresh_btn)
        
        export_btn = QPushButton("Export Data")
        export_btn.clicked.connect(self.export_data)
        controls_layout.addWidget(export_btn)
        
        layout.addWidget(controls_group)
        
        layout.addStretch()
        return panel
    
    def create_right_panel(self):
        """Create right main content panel"""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        
        # Create tab widget
        self.tabs = QTabWidget()
        layout.addWidget(self.tabs)
        
        # Add tabs
        self.create_stocks_tab()
        self.create_currencies_tab()
        self.create_charts_tab()
        self.create_indicators_tab()
        
        return panel
    
    def create_stocks_tab(self):
        """Create stocks tab"""
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        # Header with live indicator
        header_layout = QHBoxLayout()
        
        header = QLabel("Iranian Stock Market - Live Data")
        header.setStyleSheet("font-size: 16px; font-weight: bold;")
        header_layout.addWidget(header)
        
        self.live_indicator = QLabel("🔴 LIVE")
        self.live_indicator.setStyleSheet("color: #4CAF50; font-weight: bold;")
        header_layout.addWidget(self.live_indicator)
        
        header_layout.addStretch()
        layout.addLayout(header_layout)
        
        # Stocks table
        self.stocks_table = QTableWidget()
        self.stocks_table.setColumnCount(8)
        self.stocks_table.setHorizontalHeaderLabels([
            "Symbol", "Company Name", "Price (IRR)", "Change", "Change %", 
            "Volume", "Market Cap", "Last Update"
        ])
        
        # Configure table
        header = self.stocks_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(1, QHeaderView.Stretch)
        header.setSectionResizeMode(2, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(3, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(4, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(5, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(6, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(7, QHeaderView.ResizeToContents)
        
        self.stocks_table.setAlternatingRowColors(True)
        self.stocks_table.setSelectionBehavior(QAbstractItemView.SelectRows)
        
        layout.addWidget(self.stocks_table)
        
        self.tabs.addTab(tab, "Live Stocks")
    
    def create_currencies_tab(self):
        """Create currencies tab"""
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        # Header
        header = QLabel("Currency Exchange Rates - Live Data")
        header.setStyleSheet("font-size: 16px; font-weight: bold; padding: 10px;")
        layout.addWidget(header)
        
        # Currency table
        self.currency_table = QTableWidget()
        self.currency_table.setColumnCount(6)
        self.currency_table.setHorizontalHeaderLabels([
            "Code", "Name", "Persian Name", "Price (IRR)", "Change 24h", "Change %"
        ])
        
        # Configure table
        header = self.currency_table.horizontalHeader()
        header.setSectionResizeMode(1, QHeaderView.Stretch)
        header.setSectionResizeMode(2, QHeaderView.Stretch)
        
        self.currency_table.setAlternatingRowColors(True)
        layout.addWidget(self.currency_table)
        
        self.tabs.addTab(tab, "Currencies")
    
    def create_charts_tab(self):
        """Create charts tab - advanced or basic based on available dependencies"""
        if TradingChartWidget is not None:
            # Create the advanced trading chart widget
            self.chart_widget = TradingChartWidget(self)
            self.chart_widget.set_api_client(self.api_client)
            self.tabs.addTab(self.chart_widget, "Professional Charts")
        else:
            # Fallback to basic chart interface
            self.create_basic_charts_tab()
    
    def create_basic_charts_tab(self):
        """Create basic charts tab when advanced charts not available"""
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        # Info message
        info_label = QLabel("⚠️ Advanced charts unavailable - install matplotlib and mplfinance for professional charts")
        info_label.setStyleSheet("color: #FFC107; background: #2d2d2d; padding: 10px; border: 1px solid #555; border-radius: 4px;")
        info_label.setWordWrap(True)
        layout.addWidget(info_label)
        
        # Controls
        controls_layout = QHBoxLayout()
        
        controls_layout.addWidget(QLabel("Symbol:"))
        self.chart_symbol_combo = QComboBox()
        self.chart_symbol_combo.setEditable(True)
        controls_layout.addWidget(self.chart_symbol_combo)
        
        controls_layout.addWidget(QLabel("Period:"))
        self.chart_period_combo = QComboBox()
        self.chart_period_combo.addItems(["1 week", "2 weeks", "1 month", "2 months", "3 months", "6 months"])
        controls_layout.addWidget(self.chart_period_combo)
        
        load_chart_btn = QPushButton("Load Chart Data")
        load_chart_btn.clicked.connect(self.load_basic_chart_data)
        controls_layout.addWidget(load_chart_btn)
        
        controls_layout.addStretch()
        layout.addLayout(controls_layout)
        
        # Chart display area
        self.chart_display = QTextEdit()
        self.chart_display.setReadOnly(True)
        self.chart_display.setPlainText("Select a symbol and click 'Load Chart Data' to display OHLCV data")
        layout.addWidget(self.chart_display)
        
        self.tabs.addTab(tab, "Basic Charts")
    
    def load_basic_chart_data(self):
        """Load chart data for basic display"""
        symbol = self.chart_symbol_combo.currentText()
        if not symbol:
            QMessageBox.warning(self, "Warning", "Please select a symbol")
            return
        
        try:
            period_text = self.chart_period_combo.currentText()
            period_map = {"1 week": 7, "2 weeks": 14, "1 month": 30, "2 months": 60, "3 months": 90, "6 months": 180}
            days = period_map.get(period_text, 30)
            
            ohlcv_data = self.api_client.get_ohlcv(symbol, days)
            
            if not ohlcv_data:
                self.chart_display.setPlainText(f"No OHLCV data available for {symbol}")
                return
            
            # Format chart data in a more readable way
            chart_text = f"📊 OHLCV Data for {symbol} ({len(ohlcv_data)} records)\n"
            chart_text += "=" * 80 + "\n\n"
            
            if len(ohlcv_data) > 0:
                latest = ohlcv_data[-1]
                chart_text += f"Latest Data ({latest['date']}):\n"
                chart_text += f"  🔸 Open:   {latest['open_price']:>10,.0f} IRR\n"
                chart_text += f"  🔸 High:   {latest['high_price']:>10,.0f} IRR\n"
                chart_text += f"  🔸 Low:    {latest['low_price']:>10,.0f} IRR\n"
                chart_text += f"  🔸 Close:  {latest['close_price']:>10,.0f} IRR\n"
                chart_text += f"  🔸 Volume: {latest['volume']:>10,}\n\n"
                
                # Price change calculation
                if len(ohlcv_data) > 1:
                    prev_close = ohlcv_data[-2]['close_price']
                    change = latest['close_price'] - prev_close
                    change_pct = (change / prev_close) * 100
                    trend = "🟢" if change >= 0 else "🔴"
                    chart_text += f"Daily Change: {trend} {change:+,.0f} IRR ({change_pct:+.1f}%)\n\n"
            
            chart_text += f"{'Date':<12} {'Open':<10} {'High':<10} {'Low':<10} {'Close':<10} {'Volume':<12} {'Change%':<8}\n"
            chart_text += "-" * 80 + "\n"
            
            # Show last 15 records
            for i, data in enumerate(ohlcv_data[-15:]):
                change_pct = 0
                if i > 0:
                    prev_close = ohlcv_data[-15+i-1]['close_price']
                    change_pct = ((data['close_price'] - prev_close) / prev_close) * 100
                
                chart_text += f"{data['date']:<12} "
                chart_text += f"{data['open_price']:<10,.0f} "
                chart_text += f"{data['high_price']:<10,.0f} "
                chart_text += f"{data['low_price']:<10,.0f} "
                chart_text += f"{data['close_price']:<10,.0f} "
                chart_text += f"{data['volume']:<12,} "
                chart_text += f"{change_pct:>+7.1f}%\n"
            
            self.chart_display.setPlainText(chart_text)
            
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to load chart data: {str(e)}")
    
    def create_indicators_tab(self):
        """Create technical indicators tab"""
        tab = QWidget()
        layout = QVBoxLayout(tab)
        
        # Header
        header = QLabel("Technical Indicators - Real-time Analysis")
        header.setStyleSheet("font-size: 16px; font-weight: bold; padding: 10px;")
        layout.addWidget(header)
        
        # Controls
        controls_layout = QHBoxLayout()
        
        controls_layout.addWidget(QLabel("Symbol:"))
        self.indicator_symbol_combo = QComboBox()
        self.indicator_symbol_combo.setEditable(True)
        controls_layout.addWidget(self.indicator_symbol_combo)
        
        load_indicators_btn = QPushButton("Calculate Indicators")
        load_indicators_btn.clicked.connect(self.load_indicators)
        controls_layout.addWidget(load_indicators_btn)
        
        controls_layout.addStretch()
        layout.addLayout(controls_layout)
        
        # Indicators table
        self.indicators_table = QTableWidget()
        self.indicators_table.setColumnCount(4)
        self.indicators_table.setHorizontalHeaderLabels([
            "Indicator", "Value", "Signal", "Calculation Time"
        ])
        
        header = self.indicators_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(1, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(2, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(3, QHeaderView.Stretch)
        
        layout.addWidget(self.indicators_table)
        
        self.tabs.addTab(tab, "Technical Analysis")
    
    def setup_data_worker(self):
        """Setup data worker thread"""
        self.data_worker = DataWorker(self.api_client)
        self.data_worker.data_updated.connect(self.update_all_data)
        self.data_worker.error_occurred.connect(self.handle_api_error)
        self.data_worker.start()
    
    def update_all_data(self, data: Dict):
        """Update all UI components with new data"""
        self.current_data = data
        
        # Update market summary
        market_summary = data.get('market_summary', {})
        if market_summary:
            self.total_volume_label.setText(f"Total Volume: {market_summary.get('total_volume', 0):,}")
            self.total_trades_label.setText(f"Total Trades: {market_summary.get('total_trades', 0):,}")
            self.active_symbols_label.setText(f"Active Symbols: {market_summary.get('active_symbols', 0)}")
            self.market_cap_label.setText(f"Market Cap: {market_summary.get('total_market_cap', 0):,.0f}")
        
        # Update stocks table
        self.update_stocks_table(data.get('stocks', []))
        
        # Update currencies table
        self.update_currencies_table(data.get('currencies', []))
        
        # Update symbol combos
        self.update_symbol_combos(data.get('stocks', []))
        
        # Update status
        timestamp = datetime.fromisoformat(data['timestamp'].replace('Z', '+00:00'))
        self.statusBar().showMessage(f"Data updated at {timestamp.strftime('%H:%M:%S')} | API: Connected")
        
        # Flash live indicator
        self.flash_live_indicator()
    
    def update_stocks_table(self, stocks_data: List[Dict]):
        """Update stocks table"""
        self.stocks_table.setRowCount(len(stocks_data))
        
        for i, stock in enumerate(stocks_data):
            # Symbol
            self.stocks_table.setItem(i, 0, QTableWidgetItem(stock['symbol']))
            
            # Company name
            self.stocks_table.setItem(i, 1, QTableWidgetItem(stock['company_name']))
            
            # Price
            price_item = QTableWidgetItem(f"{stock['last_price']:,.0f}")
            self.stocks_table.setItem(i, 2, price_item)
            
            # Change
            change_item = QTableWidgetItem(f"{stock['price_change']:+,.0f}")
            if stock['price_change'] > 0:
                change_item.setForeground(QColor("#4CAF50"))
            elif stock['price_change'] < 0:
                change_item.setForeground(QColor("#F44336"))
            self.stocks_table.setItem(i, 3, change_item)
            
            # Change %
            change_percent_item = QTableWidgetItem(f"{stock['price_change_percent']:+.1f}%")
            if stock['price_change_percent'] > 0:
                change_percent_item.setForeground(QColor("#4CAF50"))
            elif stock['price_change_percent'] < 0:
                change_percent_item.setForeground(QColor("#F44336"))
            self.stocks_table.setItem(i, 4, change_percent_item)
            
            # Volume
            volume_item = QTableWidgetItem(f"{stock['volume']:,}")
            self.stocks_table.setItem(i, 5, volume_item)
            
            # Market cap
            market_cap = stock.get('market_cap')
            market_cap_text = f"{market_cap:,.0f}" if market_cap else "N/A"
            self.stocks_table.setItem(i, 6, QTableWidgetItem(market_cap_text))
            
            # Last update
            update_time = datetime.fromisoformat(stock['last_update'].replace('Z', '+00:00'))
            self.stocks_table.setItem(i, 7, QTableWidgetItem(update_time.strftime('%H:%M:%S')))
    
    def update_currencies_table(self, currencies_data: List[Dict]):
        """Update currencies table"""
        self.currency_table.setRowCount(len(currencies_data))
        
        for i, currency in enumerate(currencies_data):
            self.currency_table.setItem(i, 0, QTableWidgetItem(currency['currency_code']))
            self.currency_table.setItem(i, 1, QTableWidgetItem(currency['currency_name']))
            self.currency_table.setItem(i, 2, QTableWidgetItem(currency['currency_name_fa']))
            
            # Price
            price_item = QTableWidgetItem(f"{currency['price_irr']:,.0f}")
            self.currency_table.setItem(i, 3, price_item)
            
            # 24h change
            change_item = QTableWidgetItem(f"{currency['change_24h']:+,.0f}")
            if currency['change_24h'] > 0:
                change_item.setForeground(QColor("#4CAF50"))
            elif currency['change_24h'] < 0:
                change_item.setForeground(QColor("#F44336"))
            self.currency_table.setItem(i, 4, change_item)
            
            # Change %
            change_percent_item = QTableWidgetItem(f"{currency['change_percent_24h']:+.1f}%")
            if currency['change_percent_24h'] > 0:
                change_percent_item.setForeground(QColor("#4CAF50"))
            elif currency['change_percent_24h'] < 0:
                change_percent_item.setForeground(QColor("#F44336"))
            self.currency_table.setItem(i, 5, change_percent_item)
    
    def update_symbol_combos(self, stocks_data: List[Dict]):
        """Update symbol combo boxes"""
        symbols = [stock['symbol'] for stock in stocks_data]
        
        # Update chart widget symbols (advanced charts)
        if hasattr(self, 'chart_widget') and self.chart_widget:
            self.chart_widget.update_symbols(symbols)
        
        # Update basic chart symbol combo if using basic charts
        if hasattr(self, 'chart_symbol_combo') and self.chart_symbol_combo:
            current_chart_symbol = self.chart_symbol_combo.currentText()
            self.chart_symbol_combo.clear()
            self.chart_symbol_combo.addItems(symbols)
            if current_chart_symbol in symbols:
                self.chart_symbol_combo.setCurrentText(current_chart_symbol)
        
        # Update indicator symbol combo  
        current_indicator_symbol = self.indicator_symbol_combo.currentText()
        self.indicator_symbol_combo.clear()
        self.indicator_symbol_combo.addItems(symbols)
        if current_indicator_symbol in symbols:
            self.indicator_symbol_combo.setCurrentText(current_indicator_symbol)
    
    def flash_live_indicator(self):
        """Flash the live indicator"""
        self.live_indicator.setStyleSheet("color: #FF5722; font-weight: bold;")
        QTimer.singleShot(200, lambda: self.live_indicator.setStyleSheet("color: #4CAF50; font-weight: bold;"))
    
    def search_symbols(self):
        """Search symbols using API"""
        query = self.search_input.text().strip()
        if len(query) < 2:
            self.search_results.clear()
            return
        
        try:
            results = self.api_client.search_symbols(query)
            self.search_results.clear()
            
            for result in results:
                item_text = f"{result['symbol']} - {result['company_name']}"
                self.search_results.addItem(item_text)
                
        except Exception as e:
            print(f"Search error: {e}")
    
    def symbol_selected(self, item):
        """Handle symbol selection"""
        symbol = item.text().split(' - ')[0]
        
        # Update chart widget symbol (advanced charts)
        if hasattr(self, 'chart_widget') and self.chart_widget:
            # For advanced chart widget, update its symbol combo
            if hasattr(self.chart_widget, 'symbol_combo'):
                self.chart_widget.symbol_combo.setCurrentText(symbol)
        
        # Update basic chart symbol combo if using basic charts
        if hasattr(self, 'chart_symbol_combo') and self.chart_symbol_combo:
            self.chart_symbol_combo.setCurrentText(symbol)
        
        # Update indicator symbol combo
        if hasattr(self, 'indicator_symbol_combo') and self.indicator_symbol_combo:
            self.indicator_symbol_combo.setCurrentText(symbol)
    
    def apply_filters(self):
        """Apply data filters and refresh"""
        self.force_refresh()
    
    def force_refresh(self):
        """Force data refresh"""
        if self.data_worker:
            # Trigger immediate refresh by sending signal
            self.statusBar().showMessage("Refreshing data...")
    
    # Chart methods moved to TradingChartWidget
    def load_indicators(self):
        """Load technical indicators from API"""
        symbol = self.indicator_symbol_combo.currentText()
        if not symbol:
            QMessageBox.warning(self, "Warning", "Please select a symbol")
            return
        
        try:
            indicators_data = self.api_client.get_indicators(symbol)
            
            if not indicators_data:
                QMessageBox.information(self, "Info", f"No indicator data available for {symbol}")
                return
            
            self.indicators_table.setRowCount(len(indicators_data))
            
            for i, indicator in enumerate(indicators_data):
                # Indicator name
                self.indicators_table.setItem(i, 0, QTableWidgetItem(indicator['indicator_name']))
                
                # Value
                value_item = QTableWidgetItem(f"{indicator['value']:.2f}")
                self.indicators_table.setItem(i, 1, value_item)
                
                # Signal
                signal_item = QTableWidgetItem(indicator['signal'])
                if indicator['signal'] == "BUY":
                    signal_item.setForeground(QColor("#4CAF50"))
                elif indicator['signal'] == "SELL":
                    signal_item.setForeground(QColor("#F44336"))
                else:
                    signal_item.setForeground(QColor("#FFC107"))
                self.indicators_table.setItem(i, 2, signal_item)
                
                # Calculation time
                calc_time = datetime.fromisoformat(indicator['calculation_date'].replace('Z', '+00:00'))
                self.indicators_table.setItem(i, 3, QTableWidgetItem(calc_time.strftime('%Y-%m-%d %H:%M:%S')))
            
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Failed to load indicators: {str(e)}")
    
    def export_data(self):
        """Export current data to CSV"""
        try:
            if not self.current_data:
                QMessageBox.warning(self, "Warning", "No data to export")
                return
            
            filename, _ = QFileDialog.getSaveFileName(
                self, "Export Data", f"market_data_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
                "JSON files (*.json);;CSV files (*.csv)"
            )
            
            if filename:
                if filename.endswith('.json'):
                    with open(filename, 'w', encoding='utf-8') as f:
                        json.dump(self.current_data, f, indent=2, default=str)
                elif filename.endswith('.csv'):
                    # Export stocks as CSV
                    stocks_df = pd.DataFrame(self.current_data.get('stocks', []))
                    stocks_df.to_csv(filename, index=False)
                
                QMessageBox.information(self, "Success", f"Data exported to {filename}")
                
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Export failed: {str(e)}")
    
    def show_api_status(self):
        """Show API status dialog"""
        status = "Connected" if self.api_client.test_connection() else "Disconnected"
        color = "#4CAF50" if status == "Connected" else "#F44336"
        
        msg = QMessageBox()
        msg.setWindowTitle("API Status")
        msg.setText(f"<h3>API Connection Status</h3>"
                   f"<p><b>Status:</b> <span style='color: {color}'>{status}</span></p>"
                   f"<p><b>URL:</b> {self.api_client.base_url}</p>"
                   f"<p><b>Last Update:</b> {datetime.now().strftime('%H:%M:%S')}</p>")
        msg.exec_()
    
    def handle_api_error(self, error_message: str):
        """Handle API errors"""
        self.api_status_label.setText("Status: Error")
        self.api_status_label.setStyleSheet("color: #F44336; font-weight: bold;")
        self.statusBar().showMessage(f"API Error: {error_message}")
        print(f"API Error: {error_message}")
    
    def closeEvent(self, event):
        """Handle window close"""
        if self.data_worker:
            self.data_worker.stop()
        event.accept()
    
    def apply_styles(self):
        """Apply dark theme styles"""
        self.setStyleSheet("""
            QMainWindow {
                background-color: #1e1e1e;
                color: #ffffff;
            }
            QWidget {
                background-color: #2d2d2d;
                color: #ffffff;
                font-family: 'Segoe UI', Arial, sans-serif;
                font-size: 12px;
            }
            QPushButton {
                background-color: #4CAF50;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 8px 16px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #45a049;
            }
            QPushButton:pressed {
                background-color: #3d8b40;
            }
            QComboBox {
                background-color: #3a3a3a;
                border: 1px solid #555;
                padding: 5px;
                border-radius: 4px;
                min-width: 100px;
            }
            QLineEdit {
                background-color: #3a3a3a;
                border: 1px solid #555;
                padding: 6px;
                border-radius: 4px;
            }
            QTableWidget {
                background-color: #2d2d2d;
                gridline-color: #444;
                border: 1px solid #444;
                alternate-background-color: #353535;
            }
            QHeaderView::section {
                background-color: #3a3a3a;
                color: #ffffff;
                padding: 8px;
                border: none;
                border-right: 1px solid #555;
                border-bottom: 1px solid #555;
                font-weight: bold;
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
                border-top-left-radius: 4px;
                border-top-right-radius: 4px;
            }
            QTabBar::tab:selected {
                background-color: #4CAF50;
            }
            QTabBar::tab:hover {
                background-color: #4a4a4a;
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
            QTextEdit {
                background-color: #353535;
                border: 1px solid #555;
                border-radius: 4px;
                padding: 10px;
                font-family: 'Consolas', 'Courier New', monospace;
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
                background-color: #4CAF50;
            }
            QListWidget::item:hover {
                background-color: #3a3a3a;
            }
            QSpinBox {
                background-color: #3a3a3a;
                border: 1px solid #555;
                padding: 5px;
                border-radius: 4px;
            }
            QLabel {
                color: #ffffff;
            }
            QStatusBar {
                background-color: #2d2d2d;
                border-top: 1px solid #444;
                color: #ffffff;
            }
            QMenuBar {
                background-color: #2d2d2d;
                border-bottom: 1px solid #444;
            }
            QMenuBar::item {
                padding: 5px 10px;
            }
            QMenuBar::item:selected {
                background-color: #4CAF50;
            }
            QMenu {
                background-color: #2d2d2d;
                border: 1px solid #444;
            }
            QMenu::item {
                padding: 5px 20px;
            }
            QMenu::item:selected {
                background-color: #4CAF50;
            }
        """)

def main():
    """Main entry point"""
    app = QApplication(sys.argv)
    app.setStyle('Fusion')
    
    print("Starting API-powered Iranian Trading Platform v2.0...")
    print("=" * 60)
    print("Features:")
    print("• Real-time data via REST API v2")
    print("• Clean layered architecture")
    print("• Advanced search and filtering")
    print("• Technical indicators calculation")
    print("• Professional trading interface")
    print("• Auto-refresh every 5 seconds")
    print("• Swagger documentation available")
    print("=" * 60)
    
    # Create and show main window
    try:
        window = ApiTradingPlatform()
        window.show()
        
        print("GUI application started successfully!")
        print("Connected to API v2 server at http://localhost:8000")
        print("API Documentation: http://localhost:8000/docs")
        print("Close the window to exit.")
        
        return app.exec_()
        
    except Exception as e:
        print(f"Failed to start application: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())