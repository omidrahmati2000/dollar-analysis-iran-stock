"""
TradingView-like Chart Widget for Trading Platform
Professional financial chart interface with technical indicators
"""

import sys
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import matplotlib
matplotlib.use('Qt5Agg')  # Set backend before importing pyplot
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.backends.backend_qt5agg import FigureCanvasQTAgg as FigureCanvas
from matplotlib.figure import Figure
import mplfinance as mpf

try:
    from PyQt5.QtWidgets import *
    from PyQt5.QtCore import *
    from PyQt5.QtGui import *
except ImportError as e:
    print(f"PyQt5 import error: {e}")
    sys.exit(1)


class TradingChart(FigureCanvas):
    """Professional trading chart widget with candlesticks and indicators"""
    
    def __init__(self, parent=None):
        self.figure = Figure(figsize=(12, 8), facecolor='#1e1e1e')
        super().__init__(self.figure)
        self.setParent(parent)
        
        # Chart configuration
        self.symbol = ""
        self.timeframe = "1D"
        self.data = pd.DataFrame()
        self.indicators = {}
        
        # Configure matplotlib style
        plt.style.use('dark_background')
        self.setup_chart()
    
    def setup_chart(self):
        """Setup initial chart configuration"""
        # Configure figure
        self.figure.patch.set_facecolor('#1e1e1e')
        
        # Main price chart (70% of space)
        self.ax_price = self.figure.add_subplot(3, 1, (1, 2))
        self.ax_price.set_facecolor('#1e1e1e')
        
        # Volume chart (30% of space)  
        self.ax_volume = self.figure.add_subplot(3, 1, 3)
        self.ax_volume.set_facecolor('#1e1e1e')
        
        # Configure axes
        for ax in [self.ax_price, self.ax_volume]:
            ax.tick_params(colors='white', labelsize=9)
            ax.spines['bottom'].set_color('white')
            ax.spines['top'].set_color('white')
            ax.spines['right'].set_color('white')
            ax.spines['left'].set_color('white')
            ax.grid(True, alpha=0.3, color='gray')
        
        # Remove x-axis labels from price chart (will be on volume chart)
        self.ax_price.tick_params(labelbottom=False)
        
        # Set titles
        self.ax_price.set_title('Price Chart', color='white', fontsize=12, pad=20)
        self.ax_volume.set_title('Volume', color='white', fontsize=10)
        
        # Tight layout
        self.figure.tight_layout()
        
        # Show placeholder
        self.show_placeholder()
    
    def show_placeholder(self):
        """Show placeholder when no data"""
        self.ax_price.clear()
        self.ax_volume.clear()
        
        self.ax_price.text(0.5, 0.5, 'Select symbol and click "Load Chart"\nto display candlestick data', 
                          transform=self.ax_price.transAxes, ha='center', va='center',
                          fontsize=14, color='gray', style='italic')
        
        self.ax_volume.text(0.5, 0.5, 'Volume will appear here', 
                           transform=self.ax_volume.transAxes, ha='center', va='center',
                           fontsize=10, color='gray', style='italic')
        
        # Style axes
        for ax in [self.ax_price, self.ax_volume]:
            ax.set_facecolor('#1e1e1e')
            ax.tick_params(colors='white')
            for spine in ax.spines.values():
                spine.set_color('white')
                
        self.draw()
    
    def update_chart(self, ohlcv_data: List[Dict], symbol: str):
        """Update chart with new OHLCV data"""
        if not ohlcv_data:
            self.show_placeholder()
            return
            
        self.symbol = symbol
        
        try:
            # Convert to DataFrame
            df = pd.DataFrame(ohlcv_data)
            
            # Convert date column
            df['date'] = pd.to_datetime(df['date'])
            df = df.set_index('date')
            
            # Rename columns for mplfinance compatibility
            df = df.rename(columns={
                'open_price': 'Open',
                'high_price': 'High', 
                'low_price': 'Low',
                'close_price': 'Close',
                'volume': 'Volume'
            })
            
            # Sort by date
            df = df.sort_index()
            
            # Keep only last 100 periods for better visibility
            if len(df) > 100:
                df = df.tail(100)
            
            self.data = df
            self.plot_candlesticks()
            
        except Exception as e:
            self.show_error(f"Chart error: {str(e)}")
    
    def plot_candlesticks(self):
        """Plot candlestick chart with volume"""
        if self.data.empty:
            self.show_placeholder()
            return
            
        try:
            # Clear axes
            self.ax_price.clear()
            self.ax_volume.clear()
            
            # Prepare data
            dates = self.data.index
            opens = self.data['Open']
            highs = self.data['High']
            lows = self.data['Low']
            closes = self.data['Close']
            volumes = self.data['Volume']
            
            # Plot candlesticks manually for better control
            self.plot_candlesticks_manual(dates, opens, highs, lows, closes)
            
            # Plot volume bars
            self.plot_volume_bars(dates, volumes, closes)
            
            # Add moving averages
            self.add_moving_averages(dates, closes)
            
            # Configure axes
            self.configure_axes(dates)
            
            # Set titles
            self.ax_price.set_title(f'{self.symbol} - Candlestick Chart', 
                                   color='white', fontsize=14, fontweight='bold')
            self.ax_volume.set_title('Volume', color='white', fontsize=10)
            
            # Adjust layout
            self.figure.tight_layout()
            self.draw()
            
        except Exception as e:
            self.show_error(f"Plotting error: {str(e)}")
    
    def plot_candlesticks_manual(self, dates, opens, highs, lows, closes):
        """Plot candlesticks manually"""
        # Calculate colors
        colors = ['#00ff00' if close >= open else '#ff0000' 
                 for open, close in zip(opens, closes)]
        
        # Plot wicks (high-low lines)
        for i, (date, high, low) in enumerate(zip(dates, highs, lows)):
            self.ax_price.plot([i, i], [low, high], color='white', linewidth=0.8, alpha=0.7)
        
        # Plot candlestick bodies
        for i, (open_price, close_price, color) in enumerate(zip(opens, closes, colors)):
            height = abs(close_price - open_price)
            bottom = min(open_price, close_price)
            
            # Candlestick body
            rect = plt.Rectangle((i-0.3, bottom), 0.6, height, 
                               facecolor=color, edgecolor='white', 
                               linewidth=0.5, alpha=0.8)
            self.ax_price.add_patch(rect)
        
        # Set x-axis
        self.ax_price.set_xlim(-1, len(dates))
        self.ax_price.set_xticks(range(0, len(dates), max(1, len(dates)//10)))
        self.ax_price.set_xticklabels([])  # No labels on price chart
        
    def plot_volume_bars(self, dates, volumes, closes):
        """Plot volume bars"""
        # Calculate volume colors (green if price up, red if down)
        colors = []
        for i, close in enumerate(closes):
            if i == 0:
                colors.append('gray')
            else:
                prev_close = closes.iloc[i-1]
                colors.append('#00ff00' if close >= prev_close else '#ff0000')
        
        # Plot volume bars
        bars = self.ax_volume.bar(range(len(volumes)), volumes, color=colors, alpha=0.7, width=0.8)
        
        # Format volume axis
        self.ax_volume.set_xlim(-1, len(dates))
        self.ax_volume.ticklabel_format(style='scientific', axis='y', scilimits=(0,0))
        
    def add_moving_averages(self, dates, closes):
        """Add moving averages to price chart"""
        if len(closes) >= 20:
            # 20-period SMA
            sma20 = closes.rolling(window=20).mean()
            self.ax_price.plot(range(len(dates)), sma20, color='#ffff00', 
                              linewidth=1.5, label='SMA 20', alpha=0.8)
        
        if len(closes) >= 50:
            # 50-period SMA
            sma50 = closes.rolling(window=50).mean()
            self.ax_price.plot(range(len(dates)), sma50, color='#00ffff', 
                              linewidth=1.5, label='SMA 50', alpha=0.8)
        
        # Add legend
        if len(closes) >= 20:
            self.ax_price.legend(loc='upper left', fancybox=True, 
                               shadow=True, fontsize=8, facecolor='#2d2d2d')
    
    def configure_axes(self, dates):
        """Configure chart axes"""
        # Format date labels for volume chart
        date_labels = []
        indices = range(0, len(dates), max(1, len(dates)//8))
        
        for i in indices:
            if i < len(dates):
                date_labels.append(dates[i].strftime('%m/%d'))
        
        self.ax_volume.set_xticks(list(indices))
        self.ax_volume.set_xticklabels(date_labels, rotation=45, ha='right')
        
        # Style both axes
        for ax in [self.ax_price, self.ax_volume]:
            ax.set_facecolor('#1e1e1e')
            ax.tick_params(colors='white', labelsize=8)
            ax.grid(True, alpha=0.2, color='gray', linestyle='-', linewidth=0.5)
            
            for spine in ax.spines.values():
                spine.set_color('white')
                spine.set_linewidth(0.5)
    
    def show_error(self, message: str):
        """Show error message on chart"""
        self.ax_price.clear()
        self.ax_volume.clear()
        
        self.ax_price.text(0.5, 0.5, f'Error: {message}', 
                          transform=self.ax_price.transAxes, ha='center', va='center',
                          fontsize=12, color='red', weight='bold')
        
        for ax in [self.ax_price, self.ax_volume]:
            ax.set_facecolor('#1e1e1e')
            
        self.draw()


class TradingChartWidget(QWidget):
    """Complete chart widget with controls"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.api_client = None
        self.init_ui()
    
    def set_api_client(self, api_client):
        """Set API client for data fetching"""
        self.api_client = api_client
    
    def init_ui(self):
        """Initialize user interface"""
        layout = QVBoxLayout(self)
        
        # Chart controls
        controls_layout = QHBoxLayout()
        
        # Symbol selection
        controls_layout.addWidget(QLabel("Symbol:"))
        self.symbol_combo = QComboBox()
        self.symbol_combo.setEditable(True)
        self.symbol_combo.setMinimumWidth(120)
        controls_layout.addWidget(self.symbol_combo)
        
        # Time period
        controls_layout.addWidget(QLabel("Period:"))
        self.period_combo = QComboBox()
        self.period_combo.addItems([
            "1 week", "2 weeks", "1 month", "2 months", 
            "3 months", "6 months", "1 year", "2 years"
        ])
        self.period_combo.setCurrentText("3 months")
        controls_layout.addWidget(self.period_combo)
        
        # Chart type
        controls_layout.addWidget(QLabel("Type:"))
        self.chart_type_combo = QComboBox()
        self.chart_type_combo.addItems(["Candlestick", "OHLC", "Line"])
        controls_layout.addWidget(self.chart_type_combo)
        
        # Indicators
        controls_layout.addWidget(QLabel("Indicators:"))
        self.indicators_combo = QComboBox()
        self.indicators_combo.addItems([
            "None", "SMA 20,50", "EMA 12,26", "Bollinger Bands", "RSI"
        ])
        controls_layout.addWidget(self.indicators_combo)
        
        # Load button
        self.load_btn = QPushButton("Load Chart")
        self.load_btn.clicked.connect(self.load_chart)
        self.load_btn.setStyleSheet("""
            QPushButton {
                background-color: #4CAF50;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 8px 16px;
                font-weight: bold;
                min-width: 100px;
            }
            QPushButton:hover {
                background-color: #45a049;
            }
            QPushButton:pressed {
                background-color: #3d8b40;
            }
        """)
        controls_layout.addWidget(self.load_btn)
        
        controls_layout.addStretch()
        
        # Auto-refresh checkbox
        self.auto_refresh_cb = QCheckBox("Auto Refresh (30s)")
        controls_layout.addWidget(self.auto_refresh_cb)
        
        layout.addLayout(controls_layout)
        
        # Chart canvas
        self.chart = TradingChart(self)
        layout.addWidget(self.chart)
        
        # Status label
        self.status_label = QLabel("Ready - Select symbol and click Load Chart")
        self.status_label.setStyleSheet("color: #888; font-size: 10px; padding: 5px;")
        layout.addWidget(self.status_label)
        
        # Auto refresh timer
        self.refresh_timer = QTimer()
        self.refresh_timer.timeout.connect(self.auto_refresh)
        self.auto_refresh_cb.toggled.connect(self.toggle_auto_refresh)
    
    def update_symbols(self, symbols: List[str]):
        """Update available symbols"""
        current = self.symbol_combo.currentText()
        self.symbol_combo.clear()
        self.symbol_combo.addItems(symbols)
        
        # Restore selection if still available
        if current in symbols:
            self.symbol_combo.setCurrentText(current)
    
    def load_chart(self):
        """Load chart data from API"""
        if not self.api_client:
            QMessageBox.warning(self, "Error", "API client not available")
            return
            
        symbol = self.symbol_combo.currentText().strip()
        if not symbol:
            QMessageBox.warning(self, "Warning", "Please select a symbol")
            return
        
        try:
            self.status_label.setText(f"Loading chart for {symbol}...")
            self.load_btn.setEnabled(False)
            
            # Parse period
            period_text = self.period_combo.currentText()
            days = self.parse_period(period_text)
            
            # Fetch data
            ohlcv_data = self.api_client.get_ohlcv(symbol, days)
            
            if not ohlcv_data:
                self.status_label.setText(f"No data available for {symbol}")
                QMessageBox.information(self, "No Data", 
                                      f"No OHLCV data available for symbol '{symbol}'.\n"
                                      f"Please try a different symbol.")
                return
            
            # Update chart
            self.chart.update_chart(ohlcv_data, symbol)
            self.status_label.setText(f"Chart loaded: {symbol} ({len(ohlcv_data)} records)")
            
        except Exception as e:
            error_msg = f"Failed to load chart: {str(e)}"
            self.status_label.setText(error_msg)
            QMessageBox.critical(self, "Error", error_msg)
        finally:
            self.load_btn.setEnabled(True)
    
    def parse_period(self, period_text: str) -> int:
        """Parse period string to days"""
        period_map = {
            "1 week": 7,
            "2 weeks": 14,
            "1 month": 30,
            "2 months": 60,
            "3 months": 90,
            "6 months": 180,
            "1 year": 365,
            "2 years": 730
        }
        return period_map.get(period_text, 90)
    
    def toggle_auto_refresh(self, enabled: bool):
        """Toggle auto refresh"""
        if enabled:
            self.refresh_timer.start(30000)  # 30 seconds
            self.status_label.setText(self.status_label.text() + " | Auto-refresh: ON")
        else:
            self.refresh_timer.stop()
    
    def auto_refresh(self):
        """Auto refresh chart"""
        if self.symbol_combo.currentText():
            self.load_chart()