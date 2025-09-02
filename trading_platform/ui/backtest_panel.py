"""
Backtesting Panel - Comprehensive backtesting interface
Provides GUI for running and analyzing backtests
"""

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGridLayout, QFormLayout,
    QPushButton, QLabel, QComboBox, QSpinBox, QDoubleSpinBox,
    QCheckBox, QDateEdit, QTableWidget, QTableWidgetItem,
    QTabWidget, QTextEdit, QProgressBar, QSplitter, QGroupBox,
    QHeaderView, QTreeWidget, QTreeWidgetItem, QDialog,
    QDialogButtonBox, QScrollArea, QFrame, QSlider
)
from PyQt5.QtCore import Qt, QTimer, QThread, pyqtSignal, QDate, pyqtSlot
from PyQt5.QtGui import QFont, QColor, QPixmap, QPainter
from PyQt5.QtChart import QChart, QChartView, QLineSeries, QValueAxis, QDateTimeAxis

from typing import Dict, List, Any, Optional
import json
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

from ..services.container import ServiceContainer
from ..services.backtest_service import BacktestService, BacktestSettings, BacktestMetrics
from ..services.indicator_service import IndicatorService
from ..indicators.strategies import StrategyManager


class BacktestWorker(QThread):
    """Worker thread for running backtests"""
    
    finished = pyqtSignal(object)  # BacktestMetrics
    progress = pyqtSignal(int)
    error = pyqtSignal(str)
    
    def __init__(self, backtest_service, strategy, data, settings):
        super().__init__()
        self.backtest_service = backtest_service
        self.strategy = strategy
        self.data = data
        self.settings = settings
    
    def run(self):
        """Run backtest in background"""
        try:
            self.progress.emit(25)
            metrics = self.backtest_service.run_strategy_backtest(
                self.strategy, self.data, self.settings
            )
            self.progress.emit(100)
            self.finished.emit(metrics)
        except Exception as e:
            self.error.emit(str(e))


class BacktestSettingsDialog(QDialog):
    """Dialog for configuring backtest settings"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Backtest Settings")
        self.setModal(True)
        self.resize(500, 600)
        
        self.settings = BacktestSettings()
        self._setup_ui()
        self._load_current_settings()
    
    def _setup_ui(self):
        """Setup dialog UI"""
        layout = QVBoxLayout(self)
        
        # Scroll area
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        
        content = QWidget()
        form = QFormLayout(content)
        
        # Capital settings
        capital_group = QGroupBox("Capital Settings")
        capital_layout = QFormLayout(capital_group)
        
        self.initial_capital = QDoubleSpinBox()
        self.initial_capital.setRange(1000, 10000000)
        self.initial_capital.setValue(100000)
        self.initial_capital.setSuffix(" $")
        capital_layout.addRow("Initial Capital:", self.initial_capital)
        
        # Commission and slippage
        self.commission_rate = QDoubleSpinBox()
        self.commission_rate.setRange(0, 1)
        self.commission_rate.setDecimals(4)
        self.commission_rate.setValue(0.001)
        self.commission_rate.setSuffix(" %")
        capital_layout.addRow("Commission Rate:", self.commission_rate)
        
        self.slippage = QDoubleSpinBox()
        self.slippage.setRange(0, 1)
        self.slippage.setDecimals(4)
        self.slippage.setValue(0.0001)
        self.slippage.setSuffix(" %")
        capital_layout.addRow("Slippage:", self.slippage)
        
        form.addRow(capital_group)
        
        # Position sizing
        position_group = QGroupBox("Position Sizing")
        position_layout = QFormLayout(position_group)
        
        self.position_sizing = QComboBox()
        self.position_sizing.addItems(["fixed", "percent_of_capital", "kelly"])
        position_layout.addRow("Sizing Method:", self.position_sizing)
        
        self.position_size = QDoubleSpinBox()
        self.position_size.setRange(100, 1000000)
        self.position_size.setValue(10000)
        self.position_size.setSuffix(" $")
        position_layout.addRow("Position Size:", self.position_size)
        
        self.position_percent = QDoubleSpinBox()
        self.position_percent.setRange(1, 100)
        self.position_percent.setValue(10)
        self.position_percent.setSuffix(" %")
        position_layout.addRow("Position Percent:", self.position_percent)
        
        self.max_positions = QSpinBox()
        self.max_positions.setRange(1, 10)
        self.max_positions.setValue(1)
        position_layout.addRow("Max Positions:", self.max_positions)
        
        self.allow_short = QCheckBox()
        position_layout.addRow("Allow Short Positions:", self.allow_short)
        
        form.addRow(position_group)
        
        # Risk management
        risk_group = QGroupBox("Risk Management")
        risk_layout = QFormLayout(risk_group)
        
        self.stop_loss_enabled = QCheckBox()
        risk_layout.addRow("Enable Stop Loss:", self.stop_loss_enabled)
        
        self.stop_loss_percent = QDoubleSpinBox()
        self.stop_loss_percent.setRange(0.1, 50)
        self.stop_loss_percent.setValue(5.0)
        self.stop_loss_percent.setSuffix(" %")
        risk_layout.addRow("Stop Loss %:", self.stop_loss_percent)
        
        self.take_profit_enabled = QCheckBox()
        risk_layout.addRow("Enable Take Profit:", self.take_profit_enabled)
        
        self.take_profit_percent = QDoubleSpinBox()
        self.take_profit_percent.setRange(0.1, 200)
        self.take_profit_percent.setValue(10.0)
        self.take_profit_percent.setSuffix(" %")
        risk_layout.addRow("Take Profit %:", self.take_profit_percent)
        
        form.addRow(risk_group)
        
        # Date range
        date_group = QGroupBox("Date Range")
        date_layout = QFormLayout(date_group)
        
        self.use_date_range = QCheckBox()
        date_layout.addRow("Use Custom Date Range:", self.use_date_range)
        
        self.start_date = QDateEdit()
        self.start_date.setDate(QDate.currentDate().addYears(-1))
        self.start_date.setCalendarPopup(True)
        date_layout.addRow("Start Date:", self.start_date)
        
        self.end_date = QDateEdit()
        self.end_date.setDate(QDate.currentDate())
        self.end_date.setCalendarPopup(True)
        date_layout.addRow("End Date:", self.end_date)
        
        form.addRow(date_group)
        
        scroll.setWidget(content)
        layout.addWidget(scroll)
        
        # Buttons
        buttons = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel,
            Qt.Horizontal
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)
    
    def _load_current_settings(self):
        """Load current settings into UI"""
        # This would load from saved settings
        pass
    
    def get_settings(self) -> BacktestSettings:
        """Get configured settings"""
        settings = BacktestSettings()
        
        settings.initial_capital = self.initial_capital.value()
        settings.commission_rate = self.commission_rate.value() / 100
        settings.slippage = self.slippage.value() / 100
        settings.position_sizing = self.position_sizing.currentText()
        settings.position_size = self.position_size.value()
        settings.position_percent = self.position_percent.value()
        settings.max_positions = self.max_positions.value()
        settings.allow_short = self.allow_short.isChecked()
        
        if self.stop_loss_enabled.isChecked():
            settings.stop_loss_percent = self.stop_loss_percent.value()
        
        if self.take_profit_enabled.isChecked():
            settings.take_profit_percent = self.take_profit_percent.value()
        
        if self.use_date_range.isChecked():
            settings.start_date = self.start_date.date().toPyDate()
            settings.end_date = self.end_date.date().toPyDate()
        
        return settings


class ResultsWidget(QWidget):
    """Widget for displaying backtest results"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self._setup_ui()
    
    def _setup_ui(self):
        """Setup results display UI"""
        layout = QVBoxLayout(self)
        
        # Tabs for different views
        self.tabs = QTabWidget()
        
        # Summary tab
        self.summary_tab = self._create_summary_tab()
        self.tabs.addTab(self.summary_tab, "Summary")
        
        # Detailed metrics tab
        self.metrics_tab = self._create_metrics_tab()
        self.tabs.addTab(self.metrics_tab, "Detailed Metrics")
        
        # Equity curve tab
        self.chart_tab = self._create_chart_tab()
        self.tabs.addTab(self.chart_tab, "Equity Curve")
        
        # Trade log tab
        self.trades_tab = self._create_trades_tab()
        self.tabs.addTab(self.trades_tab, "Trade Log")
        
        layout.addWidget(self.tabs)
    
    def _create_summary_tab(self) -> QWidget:
        """Create summary results tab"""
        widget = QWidget()
        layout = QGridLayout(widget)
        
        # Key metrics in cards
        self.summary_labels = {}
        
        metrics = [
            ("Total Return", "total_return_percent", "%", "#4caf50"),
            ("Annualized Return", "annualized_return", "%", "#2196f3"),
            ("Sharpe Ratio", "sharpe_ratio", "", "#ff9800"),
            ("Max Drawdown", "max_drawdown_percent", "%", "#f44336"),
            ("Win Rate", "win_rate", "%", "#9c27b0"),
            ("Profit Factor", "profit_factor", "", "#607d8b")
        ]
        
        for i, (label, key, suffix, color) in enumerate(metrics):
            card = self._create_metric_card(label, key, suffix, color)
            row, col = divmod(i, 3)
            layout.addWidget(card, row, col)
        
        return widget
    
    def _create_metric_card(self, title: str, key: str, suffix: str, color: str) -> QWidget:
        """Create a metric display card"""
        card = QFrame()
        card.setFrameStyle(QFrame.Box)
        card.setStyleSheet(f"""
            QFrame {{
                border: 2px solid {color};
                border-radius: 8px;
                padding: 10px;
                background-color: rgba{tuple(list(QColor(color).getRgb()[:3]) + [30])};
            }}
        """)
        
        layout = QVBoxLayout(card)
        
        title_label = QLabel(title)
        title_label.setFont(QFont("Segoe UI", 10, QFont.Bold))
        title_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(title_label)
        
        value_label = QLabel("--")
        value_label.setFont(QFont("Segoe UI", 16, QFont.Bold))
        value_label.setAlignment(Qt.AlignCenter)
        value_label.setStyleSheet(f"color: {color};")
        layout.addWidget(value_label)
        
        self.summary_labels[key] = (value_label, suffix)
        
        return card
    
    def _create_metrics_tab(self) -> QWidget:
        """Create detailed metrics tab"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Scrollable table
        self.metrics_table = QTableWidget()
        self.metrics_table.setColumnCount(2)
        self.metrics_table.setHorizontalHeaderLabels(["Metric", "Value"])
        
        # Set column widths
        header = self.metrics_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.Stretch)
        header.setSectionResizeMode(1, QHeaderView.ResizeToContents)
        
        layout.addWidget(self.metrics_table)
        
        return widget
    
    def _create_chart_tab(self) -> QWidget:
        """Create equity curve chart tab"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # Placeholder for chart
        self.chart_label = QLabel("Chart will be displayed here")
        self.chart_label.setAlignment(Qt.AlignCenter)
        self.chart_label.setMinimumHeight(400)
        self.chart_label.setStyleSheet("border: 1px solid #ccc; background-color: #f9f9f9;")
        
        layout.addWidget(self.chart_label)
        
        return widget
    
    def _create_trades_tab(self) -> QWidget:
        """Create trades log tab"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        self.trades_table = QTableWidget()
        self.trades_table.setColumnCount(8)
        self.trades_table.setHorizontalHeaderLabels([
            "Entry Time", "Exit Time", "Type", "Entry Price", "Exit Price", 
            "Size", "P&L", "Exit Reason"
        ])
        
        layout.addWidget(self.trades_table)
        
        return widget
    
    def update_results(self, metrics: BacktestMetrics):
        """Update display with new results"""
        self._update_summary(metrics)
        self._update_detailed_metrics(metrics)
        # self._update_chart(metrics)  # Would need implementation
        # self._update_trades(metrics)  # Would need trade log access
    
    def _update_summary(self, metrics: BacktestMetrics):
        """Update summary cards"""
        metric_values = {
            "total_return_percent": metrics.total_return_percent,
            "annualized_return": metrics.annualized_return,
            "sharpe_ratio": metrics.sharpe_ratio,
            "max_drawdown_percent": metrics.max_drawdown_percent,
            "win_rate": metrics.win_rate,
            "profit_factor": metrics.profit_factor
        }
        
        for key, (label, suffix) in self.summary_labels.items():
            value = metric_values.get(key, 0)
            formatted_value = f"{value:.2f}{suffix}"
            label.setText(formatted_value)
    
    def _update_detailed_metrics(self, metrics: BacktestMetrics):
        """Update detailed metrics table"""
        metric_data = [
            ("Initial Capital", f"${metrics.initial_capital:,.2f}"),
            ("Final Capital", f"${metrics.final_capital:,.2f}"),
            ("Total Return", f"${metrics.total_return:,.2f}"),
            ("Total Return %", f"{metrics.total_return_percent:.2f}%"),
            ("Annualized Return", f"{metrics.annualized_return:.2f}%"),
            ("Sharpe Ratio", f"{metrics.sharpe_ratio:.2f}"),
            ("Sortino Ratio", f"{metrics.sortino_ratio:.2f}"),
            ("Max Drawdown", f"${metrics.max_drawdown:,.2f}"),
            ("Max Drawdown %", f"{metrics.max_drawdown_percent:.2f}%"),
            ("Volatility", f"{metrics.volatility:.2f}%"),
            ("Total Trades", str(metrics.total_trades)),
            ("Winning Trades", str(metrics.winning_trades)),
            ("Losing Trades", str(metrics.losing_trades)),
            ("Win Rate", f"{metrics.win_rate:.2f}%"),
            ("Average Win", f"${metrics.avg_win:.2f}"),
            ("Average Loss", f"${metrics.avg_loss:.2f}"),
            ("Largest Win", f"${metrics.largest_win:.2f}"),
            ("Largest Loss", f"${metrics.largest_loss:.2f}"),
            ("Profit Factor", f"{metrics.profit_factor:.2f}"),
            ("Payoff Ratio", f"{metrics.payoff_ratio:.2f}"),
            ("Calmar Ratio", f"{metrics.calmar_ratio:.2f}"),
            ("Recovery Factor", f"{metrics.recovery_factor:.2f}"),
            ("Best Day", f"{metrics.best_day:.2f}%"),
            ("Worst Day", f"{metrics.worst_day:.2f}%"),
            ("Positive Days", str(metrics.positive_days)),
            ("Negative Days", str(metrics.negative_days)),
        ]
        
        self.metrics_table.setRowCount(len(metric_data))
        
        for i, (metric, value) in enumerate(metric_data):
            self.metrics_table.setItem(i, 0, QTableWidgetItem(metric))
            self.metrics_table.setItem(i, 1, QTableWidgetItem(value))


class BacktestPanel(QWidget):
    """Main backtesting panel"""
    
    def __init__(self, container: ServiceContainer, parent=None):
        super().__init__(parent)
        self.container = container
        
        # Get services
        self.indicator_service: IndicatorService = container.get('indicator_service')
        self.strategy_manager: StrategyManager = container.get('strategy_manager')
        self.backtest_service = BacktestService(self.indicator_service)
        
        self._setup_ui()
        self._load_strategies()
        
        # Worker thread
        self.worker = None
    
    def _setup_ui(self):
        """Setup main UI"""
        layout = QVBoxLayout(self)
        
        # Control panel
        controls = self._create_controls()
        layout.addWidget(controls)
        
        # Progress bar
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        layout.addWidget(self.progress_bar)
        
        # Results area
        self.results_widget = ResultsWidget()
        layout.addWidget(self.results_widget)
    
    def _create_controls(self) -> QWidget:
        """Create backtest controls"""
        group = QGroupBox("Backtest Configuration")
        layout = QGridLayout(group)
        
        # Strategy selection
        layout.addWidget(QLabel("Strategy:"), 0, 0)
        self.strategy_combo = QComboBox()
        layout.addWidget(self.strategy_combo, 0, 1)
        
        # Symbol input
        layout.addWidget(QLabel("Symbol:"), 0, 2)
        self.symbol_input = QComboBox()
        self.symbol_input.setEditable(True)
        self.symbol_input.addItems(["AAPL", "GOOGL", "MSFT", "TSLA", "AMZN"])
        layout.addWidget(self.symbol_input, 0, 3)
        
        # Settings button
        self.settings_btn = QPushButton("Settings")
        self.settings_btn.clicked.connect(self._open_settings)
        layout.addWidget(self.settings_btn, 1, 0)
        
        # Run button
        self.run_btn = QPushButton("Run Backtest")
        self.run_btn.clicked.connect(self._run_backtest)
        self.run_btn.setStyleSheet("""
            QPushButton {
                background-color: #4caf50;
                color: white;
                font-weight: bold;
                padding: 8px 16px;
                border-radius: 4px;
            }
            QPushButton:hover {
                background-color: #45a049;
            }
        """)
        layout.addWidget(self.run_btn, 1, 1)
        
        # Compare button
        self.compare_btn = QPushButton("Compare Strategies")
        self.compare_btn.clicked.connect(self._compare_strategies)
        layout.addWidget(self.compare_btn, 1, 2)
        
        # Export button
        self.export_btn = QPushButton("Export Results")
        self.export_btn.clicked.connect(self._export_results)
        layout.addWidget(self.export_btn, 1, 3)
        
        return group
    
    def _load_strategies(self):
        """Load available strategies"""
        strategies = self.strategy_manager.get_available_strategies()
        self.strategy_combo.addItems(strategies)
    
    def _open_settings(self):
        """Open backtest settings dialog"""
        dialog = BacktestSettingsDialog(self)
        if dialog.exec_() == QDialog.Accepted:
            self.settings = dialog.get_settings()
    
    def _run_backtest(self):
        """Run backtest"""
        # Get selections
        strategy_name = self.strategy_combo.currentText()
        symbol = self.symbol_input.currentText()
        
        if not strategy_name or not symbol:
            return
        
        # Create strategy
        try:
            strategy = self.strategy_manager.create_strategy(strategy_name)
        except Exception as e:
            print(f"Error creating strategy: {e}")
            return
        
        # Get historical data (mock data for demo)
        data = self._get_mock_data(symbol)
        
        # Get settings
        settings = getattr(self, 'settings', BacktestSettings())
        
        # Run in background
        self.worker = BacktestWorker(
            self.backtest_service, strategy, data, settings
        )
        self.worker.finished.connect(self._on_backtest_finished)
        self.worker.progress.connect(self._on_progress)
        self.worker.error.connect(self._on_error)
        
        # Update UI
        self.run_btn.setEnabled(False)
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        
        self.worker.start()
    
    def _get_mock_data(self, symbol: str) -> List:
        """Generate mock OHLCV data for testing"""
        # This would connect to actual data source
        from ..domain.models import OHLCVData
        
        data = []
        base_price = 100.0
        
        for i in range(252):  # One year of daily data
            timestamp = datetime.now() - timedelta(days=252-i)
            
            # Simple random walk
            change = np.random.normal(0, 0.02)
            base_price *= (1 + change)
            
            high = base_price * (1 + abs(np.random.normal(0, 0.01)))
            low = base_price * (1 - abs(np.random.normal(0, 0.01)))
            volume = int(np.random.normal(100000, 20000))
            
            data.append(OHLCVData(
                timestamp=timestamp,
                open_price=base_price,
                high_price=high,
                low_price=low,
                close_price=base_price,
                volume=volume
            ))
        
        return data
    
    @pyqtSlot(object)
    def _on_backtest_finished(self, metrics: BacktestMetrics):
        """Handle backtest completion"""
        self.run_btn.setEnabled(True)
        self.progress_bar.setVisible(False)
        
        # Update results display
        self.results_widget.update_results(metrics)
    
    @pyqtSlot(int)
    def _on_progress(self, value: int):
        """Update progress bar"""
        self.progress_bar.setValue(value)
    
    @pyqtSlot(str)
    def _on_error(self, error: str):
        """Handle backtest error"""
        self.run_btn.setEnabled(True)
        self.progress_bar.setVisible(False)
        print(f"Backtest error: {error}")
    
    def _compare_strategies(self):
        """Compare multiple strategies"""
        # This would open a strategy comparison dialog
        from PyQt5.QtWidgets import QMessageBox
        QMessageBox.information(self, "Compare Strategies", 
                              "Strategy comparison feature coming soon!")
    
    def _export_results(self):
        """Export backtest results"""
        # This would export results to file
        from PyQt5.QtWidgets import QMessageBox
        QMessageBox.information(self, "Export Results", 
                              "Results export feature coming soon!")