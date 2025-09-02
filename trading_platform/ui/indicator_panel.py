"""
Indicator Configuration Panel - TradingView-like indicator management UI
Provides interface for adding, configuring, and managing indicators
"""

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QScrollArea, QGroupBox,
    QPushButton, QListWidget, QListWidgetItem, QComboBox, QLineEdit,
    QSpinBox, QDoubleSpinBox, QCheckBox, QSlider, QLabel, QTabWidget,
    QSplitter, QTreeWidget, QTreeWidgetItem, QDialog, QFormLayout,
    QDialogButtonBox, QColorDialog, QFrame, QTextEdit, QProgressBar,
    QTableWidget, QTableWidgetItem, QHeaderView, QMenu, QActionGroup
)
from PyQt5.QtCore import Qt, QTimer, pyqtSignal, QThread, pyqtSlot
from PyQt5.QtGui import QFont, QColor, QPalette, QIcon, QPixmap, QPainter

from typing import Dict, List, Any, Optional, Callable
import json
from datetime import datetime

from ..services.container import ServiceContainer
from ..services.indicator_service import IndicatorService, IndicatorConfiguration
from ..services.signal_service import SignalService, ProcessedSignal, SignalType
from ..indicators.presets import IndicatorPresets, PresetTemplate
from ..indicators.custom_builder import CustomIndicatorBuilder
from ..indicators.strategies import StrategyManager


class IndicatorConfigDialog(QDialog):
    """Dialog for configuring indicator parameters"""
    
    def __init__(self, indicator_type: str, parameters: Dict[str, Any] = None, parent=None):
        super().__init__(parent)
        self.indicator_type = indicator_type
        self.parameters = parameters or {}
        self.parameter_widgets = {}
        
        self.setWindowTitle(f"Configure {indicator_type}")
        self.setModal(True)
        self.resize(400, 600)
        
        self._setup_ui()
        self._load_parameters()
    
    def _setup_ui(self):
        """Setup the dialog UI"""
        layout = QVBoxLayout(self)
        
        # Header
        header = QLabel(f"Configure {self.indicator_type}")
        header.setFont(QFont("Segoe UI", 14, QFont.Bold))
        header.setAlignment(Qt.AlignCenter)
        layout.addWidget(header)
        
        # Scroll area for parameters
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        
        # Parameters widget
        params_widget = QWidget()
        self.params_layout = QFormLayout(params_widget)
        scroll.setWidget(params_widget)
        layout.addWidget(scroll)
        
        # Buttons
        buttons = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel,
            Qt.Horizontal
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)
    
    def _load_parameters(self):
        """Load parameter inputs based on indicator type"""
        # Get default parameters for indicator type
        default_params = self._get_default_parameters()
        
        for param_name, param_info in default_params.items():
            current_value = self.parameters.get(param_name, param_info['default'])
            widget = self._create_parameter_widget(param_info, current_value)
            
            self.parameter_widgets[param_name] = widget
            self.params_layout.addRow(param_info['label'], widget)
    
    def _get_default_parameters(self) -> Dict[str, Any]:
        """Get default parameters for indicator type"""
        # This would be populated from indicator factory info
        defaults = {
            'RSI': {
                'length': {'type': 'int', 'default': 14, 'min': 1, 'max': 200, 'label': 'Length'},
                'source': {'type': 'combo', 'default': 'close', 
                          'options': ['close', 'open', 'high', 'low', 'hlc3'], 'label': 'Source'},
                'overbought': {'type': 'float', 'default': 70.0, 'min': 50.0, 'max': 100.0, 'label': 'Overbought'},
                'oversold': {'type': 'float', 'default': 30.0, 'min': 0.0, 'max': 50.0, 'label': 'Oversold'}
            },
            'MACD': {
                'fast_length': {'type': 'int', 'default': 12, 'min': 1, 'max': 100, 'label': 'Fast Length'},
                'slow_length': {'type': 'int', 'default': 26, 'min': 1, 'max': 100, 'label': 'Slow Length'},
                'signal_length': {'type': 'int', 'default': 9, 'min': 1, 'max': 50, 'label': 'Signal Length'},
                'source': {'type': 'combo', 'default': 'close',
                          'options': ['close', 'open', 'high', 'low'], 'label': 'Source'}
            },
            'BOLLINGER': {
                'period': {'type': 'int', 'default': 20, 'min': 1, 'max': 100, 'label': 'Period'},
                'std_dev': {'type': 'float', 'default': 2.0, 'min': 0.1, 'max': 5.0, 'label': 'Standard Deviation'},
                'source': {'type': 'combo', 'default': 'close',
                          'options': ['close', 'open', 'high', 'low'], 'label': 'Source'}
            }
        }
        
        return defaults.get(self.indicator_type, {})
    
    def _create_parameter_widget(self, param_info: Dict[str, Any], current_value: Any) -> QWidget:
        """Create appropriate widget for parameter"""
        param_type = param_info['type']
        
        if param_type == 'int':
            widget = QSpinBox()
            widget.setRange(param_info.get('min', 0), param_info.get('max', 999))
            widget.setValue(current_value)
            return widget
            
        elif param_type == 'float':
            widget = QDoubleSpinBox()
            widget.setRange(param_info.get('min', 0.0), param_info.get('max', 999.0))
            widget.setDecimals(2)
            widget.setValue(current_value)
            return widget
            
        elif param_type == 'bool':
            widget = QCheckBox()
            widget.setChecked(current_value)
            return widget
            
        elif param_type == 'combo':
            widget = QComboBox()
            widget.addItems(param_info['options'])
            if current_value in param_info['options']:
                widget.setCurrentText(current_value)
            return widget
            
        elif param_type == 'color':
            widget = QPushButton()
            widget.setStyleSheet(f"background-color: {current_value}")
            widget.clicked.connect(lambda: self._choose_color(widget))
            return widget
            
        else:
            widget = QLineEdit()
            widget.setText(str(current_value))
            return widget
    
    def _choose_color(self, button: QPushButton):
        """Open color chooser dialog"""
        color = QColorDialog.getColor()
        if color.isValid():
            button.setStyleSheet(f"background-color: {color.name()}")
    
    def get_parameters(self) -> Dict[str, Any]:
        """Get configured parameters"""
        result = {}
        
        for param_name, widget in self.parameter_widgets.items():
            if isinstance(widget, QSpinBox):
                result[param_name] = widget.value()
            elif isinstance(widget, QDoubleSpinBox):
                result[param_name] = widget.value()
            elif isinstance(widget, QCheckBox):
                result[param_name] = widget.isChecked()
            elif isinstance(widget, QComboBox):
                result[param_name] = widget.currentText()
            elif isinstance(widget, QLineEdit):
                result[param_name] = widget.text()
            elif isinstance(widget, QPushButton):
                # Color button
                style = widget.styleSheet()
                if 'background-color:' in style:
                    color = style.split('background-color:')[1].strip()
                    result[param_name] = color
        
        return result


class IndicatorListWidget(QListWidget):
    """Custom list widget for indicators with drag/drop and context menu"""
    
    indicator_added = pyqtSignal(str, dict)
    indicator_removed = pyqtSignal(str)
    indicator_configured = pyqtSignal(str, dict)
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setContextMenuPolicy(Qt.CustomContextMenu)
        self.customContextMenuRequested.connect(self._show_context_menu)
        
        # Enable drag and drop
        self.setDragDropMode(QListWidget.DragDrop)
        self.setDefaultDropAction(Qt.MoveAction)
    
    def _show_context_menu(self, position):
        """Show context menu for indicator items"""
        item = self.itemAt(position)
        if not item:
            return
        
        menu = QMenu(self)
        
        # Configure action
        configure_action = menu.addAction("Configure...")
        configure_action.triggered.connect(lambda: self._configure_indicator(item))
        
        # Remove action
        remove_action = menu.addAction("Remove")
        remove_action.triggered.connect(lambda: self._remove_indicator(item))
        
        menu.addSeparator()
        
        # Duplicate action
        duplicate_action = menu.addAction("Duplicate")
        duplicate_action.triggered.connect(lambda: self._duplicate_indicator(item))
        
        menu.exec_(self.mapToGlobal(position))
    
    def _configure_indicator(self, item: QListWidgetItem):
        """Open configuration dialog for indicator"""
        indicator_name = item.text()
        # Get current parameters from item data
        current_params = item.data(Qt.UserRole) or {}
        
        dialog = IndicatorConfigDialog(indicator_name, current_params, self)
        if dialog.exec_() == QDialog.Accepted:
            new_params = dialog.get_parameters()
            item.setData(Qt.UserRole, new_params)
            self.indicator_configured.emit(indicator_name, new_params)
    
    def _remove_indicator(self, item: QListWidgetItem):
        """Remove indicator from list"""
        indicator_name = item.text()
        self.takeItem(self.row(item))
        self.indicator_removed.emit(indicator_name)
    
    def _duplicate_indicator(self, item: QListWidgetItem):
        """Duplicate an indicator"""
        indicator_name = item.text()
        params = item.data(Qt.UserRole) or {}
        
        # Create new item with suffix
        new_name = f"{indicator_name}_Copy"
        new_item = QListWidgetItem(new_name)
        new_item.setData(Qt.UserRole, params)
        
        self.addItem(new_item)
        self.indicator_added.emit(new_name, params)


class SignalPanel(QWidget):
    """Panel for displaying trading signals"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self._setup_ui()
        
        # Timer for updating signals
        self.update_timer = QTimer()
        self.update_timer.timeout.connect(self._update_signals)
        self.update_timer.start(2000)  # Update every 2 seconds
    
    def _setup_ui(self):
        """Setup signals panel UI"""
        layout = QVBoxLayout(self)
        
        # Header
        header_layout = QHBoxLayout()
        title = QLabel("Trading Signals")
        title.setFont(QFont("Segoe UI", 12, QFont.Bold))
        header_layout.addWidget(title)
        
        # Clear button
        clear_btn = QPushButton("Clear")
        clear_btn.clicked.connect(self._clear_signals)
        header_layout.addWidget(clear_btn)
        
        layout.addLayout(header_layout)
        
        # Signals table
        self.signals_table = QTableWidget()
        self.signals_table.setColumnCount(6)
        self.signals_table.setHorizontalHeaderLabels([
            "Time", "Signal", "Strength", "Indicator", "Price", "Description"
        ])
        
        # Set column widths
        header = self.signals_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeToContents)  # Time
        header.setSectionResizeMode(1, QHeaderView.ResizeToContents)  # Signal
        header.setSectionResizeMode(2, QHeaderView.ResizeToContents)  # Strength
        header.setSectionResizeMode(3, QHeaderView.Stretch)           # Indicator
        header.setSectionResizeMode(4, QHeaderView.ResizeToContents)  # Price
        header.setSectionResizeMode(5, QHeaderView.Stretch)           # Description
        
        layout.addWidget(self.signals_table)
        
        # Summary
        self.summary_label = QLabel("No signals")
        self.summary_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(self.summary_label)
    
    def add_signal(self, signal: ProcessedSignal):
        """Add a signal to the display"""
        row = self.signals_table.rowCount()
        self.signals_table.insertRow(row)
        
        # Time
        time_str = signal.processed_time.strftime("%H:%M:%S")
        self.signals_table.setItem(row, 0, QTableWidgetItem(time_str))
        
        # Signal type
        signal_item = QTableWidgetItem(signal.signal.signal.value.upper())
        if signal.signal.signal in [SignalType.BUY, SignalType.STRONG_BUY]:
            signal_item.setBackground(QColor("#2e7d32"))  # Green
        else:
            signal_item.setBackground(QColor("#c62828"))  # Red
        self.signals_table.setItem(row, 1, signal_item)
        
        # Strength
        strength_str = f"{signal.signal.strength:.2f}"
        strength_item = QTableWidgetItem(strength_str)
        
        # Color code by strength
        if signal.signal.strength >= 0.8:
            strength_item.setBackground(QColor("#1b5e20"))  # Very strong
        elif signal.signal.strength >= 0.6:
            strength_item.setBackground(QColor("#388e3c"))  # Strong
        elif signal.signal.strength >= 0.3:
            strength_item.setBackground(QColor("#fbc02d"))  # Medium
        else:
            strength_item.setBackground(QColor("#e0e0e0"))  # Weak
        
        self.signals_table.setItem(row, 2, strength_item)
        
        # Indicator
        self.signals_table.setItem(row, 3, QTableWidgetItem(signal.indicator_name))
        
        # Price
        price_str = f"{signal.signal.price:.2f}" if signal.signal.price > 0 else "N/A"
        self.signals_table.setItem(row, 4, QTableWidgetItem(price_str))
        
        # Description
        self.signals_table.setItem(row, 5, QTableWidgetItem(signal.signal.description))
        
        # Scroll to bottom
        self.signals_table.scrollToBottom()
        
        # Limit rows
        if self.signals_table.rowCount() > 100:
            self.signals_table.removeRow(0)
        
        # Update summary
        self._update_summary()
    
    def _clear_signals(self):
        """Clear all signals"""
        self.signals_table.setRowCount(0)
        self._update_summary()
    
    def _update_signals(self):
        """Update signals from service (placeholder)"""
        # This would connect to the signal service
        pass
    
    def _update_summary(self):
        """Update signals summary"""
        row_count = self.signals_table.rowCount()
        if row_count == 0:
            self.summary_label.setText("No signals")
        else:
            buy_count = 0
            sell_count = 0
            
            for row in range(row_count):
                signal_type = self.signals_table.item(row, 1).text()
                if signal_type in ["BUY", "STRONG_BUY"]:
                    buy_count += 1
                elif signal_type in ["SELL", "STRONG_SELL"]:
                    sell_count += 1
            
            self.summary_label.setText(f"Total: {row_count} | Buy: {buy_count} | Sell: {sell_count}")


class IndicatorPanel(QWidget):
    """Main indicator management panel"""
    
    def __init__(self, container: ServiceContainer, parent=None):
        super().__init__(parent)
        self.container = container
        
        # Get services
        self.indicator_service: IndicatorService = container.get('indicator_service')
        self.signal_service: SignalService = container.get('signal_service')
        self.presets: IndicatorPresets = container.get('indicator_presets')
        
        self._setup_ui()
        self._setup_connections()
        
        # Load available indicators
        self._load_available_indicators()
    
    def _setup_ui(self):
        """Setup the main UI"""
        layout = QHBoxLayout(self)
        
        # Create splitter
        splitter = QSplitter(Qt.Horizontal)
        
        # Left panel - Available indicators
        left_panel = self._create_available_panel()
        splitter.addWidget(left_panel)
        
        # Center panel - Active indicators
        center_panel = self._create_active_panel()
        splitter.addWidget(center_panel)
        
        # Right panel - Signals
        right_panel = self._create_signals_panel()
        splitter.addWidget(right_panel)
        
        # Set splitter sizes
        splitter.setSizes([300, 400, 300])
        layout.addWidget(splitter)
    
    def _create_available_panel(self) -> QWidget:
        """Create available indicators panel"""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        
        # Header
        header = QLabel("Available Indicators")
        header.setFont(QFont("Segoe UI", 12, QFont.Bold))
        layout.addWidget(header)
        
        # Tabs for different categories
        tabs = QTabWidget()
        
        # All indicators tab
        all_tab = QWidget()
        all_layout = QVBoxLayout(all_tab)
        
        # Search box
        self.search_box = QLineEdit()
        self.search_box.setPlaceholderText("Search indicators...")
        self.search_box.textChanged.connect(self._filter_indicators)
        all_layout.addWidget(self.search_box)
        
        # Available indicators list
        self.available_list = QListWidget()
        self.available_list.itemDoubleClicked.connect(self._add_indicator_from_available)
        all_layout.addWidget(self.available_list)
        
        tabs.addTab(all_tab, "All")
        
        # Presets tab
        presets_tab = QWidget()
        presets_layout = QVBoxLayout(presets_tab)
        
        self.presets_list = QListWidget()
        self.presets_list.itemDoubleClicked.connect(self._load_preset)
        presets_layout.addWidget(self.presets_list)
        
        tabs.addTab(presets_tab, "Presets")
        
        # Custom tab
        custom_tab = QWidget()
        custom_layout = QVBoxLayout(custom_tab)
        
        custom_builder_btn = QPushButton("Custom Indicator Builder")
        custom_builder_btn.clicked.connect(self._open_custom_builder)
        custom_layout.addWidget(custom_builder_btn)
        
        self.custom_list = QListWidget()
        custom_layout.addWidget(self.custom_list)
        
        tabs.addTab(custom_tab, "Custom")
        
        layout.addWidget(tabs)
        
        return panel
    
    def _create_active_panel(self) -> QWidget:
        """Create active indicators panel"""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        
        # Header with controls
        header_layout = QHBoxLayout()
        
        header = QLabel("Active Indicators")
        header.setFont(QFont("Segoe UI", 12, QFont.Bold))
        header_layout.addWidget(header)
        
        # Control buttons
        calculate_btn = QPushButton("Calculate All")
        calculate_btn.clicked.connect(self._calculate_all_indicators)
        header_layout.addWidget(calculate_btn)
        
        clear_btn = QPushButton("Clear All")
        clear_btn.clicked.connect(self._clear_all_indicators)
        header_layout.addWidget(clear_btn)
        
        layout.addLayout(header_layout)
        
        # Active indicators list
        self.active_list = IndicatorListWidget()
        self.active_list.indicator_added.connect(self._handle_indicator_added)
        self.active_list.indicator_removed.connect(self._handle_indicator_removed)
        self.active_list.indicator_configured.connect(self._handle_indicator_configured)
        
        layout.addWidget(self.active_list)
        
        # Status
        self.status_label = QLabel("No active indicators")
        self.status_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(self.status_label)
        
        return panel
    
    def _create_signals_panel(self) -> QWidget:
        """Create signals panel"""
        return SignalPanel()
    
    def _setup_connections(self):
        """Setup service connections"""
        # Connect to indicator service events
        self.indicator_service.event_bus.subscribe("indicator_calculated", self._on_indicator_calculated)
        self.signal_service.event_bus.subscribe("signal_alert", self._on_signal_alert)
    
    def _load_available_indicators(self):
        """Load available indicators into the list"""
        # Get available indicators
        indicators = self.indicator_service.get_available_indicators()
        
        self.available_list.clear()
        for indicator in sorted(indicators):
            self.available_list.addItem(indicator)
        
        # Load presets
        presets = self.presets.get_available_presets()
        self.presets_list.clear()
        for preset in sorted(presets):
            self.presets_list.addItem(preset)
    
    def _filter_indicators(self, text: str):
        """Filter indicators based on search text"""
        for i in range(self.available_list.count()):
            item = self.available_list.item(i)
            item.setHidden(text.lower() not in item.text().lower())
    
    def _add_indicator_from_available(self, item: QListWidgetItem):
        """Add indicator from available list"""
        indicator_type = item.text()
        
        # Open configuration dialog
        dialog = IndicatorConfigDialog(indicator_type, parent=self)
        if dialog.exec_() == QDialog.Accepted:
            parameters = dialog.get_parameters()
            
            # Add to active list
            active_item = QListWidgetItem(f"{indicator_type}_{self.active_list.count()}")
            active_item.setData(Qt.UserRole, parameters)
            self.active_list.addItem(active_item)
            
            # Add to service
            indicator_name = active_item.text()
            success = self.indicator_service.add_indicator(
                indicator_name, indicator_type, **parameters
            )
            
            if success:
                self._update_status()
            else:
                self.active_list.takeItem(self.active_list.row(active_item))
    
    def _load_preset(self, item: QListWidgetItem):
        """Load a preset template"""
        preset_name = item.text()
        success = self.indicator_service.load_preset_template(preset_name)
        
        if success:
            # Refresh active indicators list
            self._refresh_active_list()
            self._update_status()
    
    def _open_custom_builder(self):
        """Open custom indicator builder"""
        # This would open a custom indicator builder dialog
        # For now, just show a placeholder
        from PyQt5.QtWidgets import QMessageBox
        QMessageBox.information(self, "Custom Builder", "Custom Indicator Builder coming soon!")
    
    def _calculate_all_indicators(self):
        """Calculate all active indicators"""
        # This would trigger calculation for all active indicators
        # For demo, we'll just show a message
        self.status_label.setText("Calculating indicators...")
        
        # Simulate calculation
        QTimer.singleShot(1000, lambda: self.status_label.setText("Calculation complete"))
    
    def _clear_all_indicators(self):
        """Clear all active indicators"""
        self.active_list.clear()
        self.indicator_service.clear_all_indicators()
        self._update_status()
    
    def _handle_indicator_added(self, name: str, params: dict):
        """Handle indicator added to active list"""
        self._update_status()
    
    def _handle_indicator_removed(self, name: str):
        """Handle indicator removed from active list"""
        self.indicator_service.remove_indicator(name)
        self._update_status()
    
    def _handle_indicator_configured(self, name: str, params: dict):
        """Handle indicator configuration changed"""
        self.indicator_service.update_indicator_parameters(name, **params)
    
    def _refresh_active_list(self):
        """Refresh the active indicators list"""
        self.active_list.clear()
        
        indicators_info = self.indicator_service.get_all_indicators_info()
        for name, info in indicators_info.items():
            item = QListWidgetItem(name)
            item.setData(Qt.UserRole, info['parameters'])
            self.active_list.addItem(item)
    
    def _update_status(self):
        """Update status label"""
        count = self.active_list.count()
        if count == 0:
            self.status_label.setText("No active indicators")
        else:
            self.status_label.setText(f"{count} active indicator{'s' if count != 1 else ''}")
    
    def _on_indicator_calculated(self, event):
        """Handle indicator calculation event"""
        # Update UI to show calculation results
        pass
    
    def _on_signal_alert(self, event):
        """Handle signal alert event"""
        # Add signal to signals panel
        signal_data = event.data
        if 'signal' in signal_data:
            signals_panel = self.findChild(SignalPanel)
            if signals_panel:
                signals_panel.add_signal(signal_data['signal'])