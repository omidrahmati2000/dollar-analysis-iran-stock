"""
Data Type Toggle Widget for switching between adjusted and unadjusted prices
"""
from PyQt5.QtWidgets import (QWidget, QHBoxLayout, QVBoxLayout, QLabel, 
                             QPushButton, QButtonGroup, QFrame, QToolTip)
from PyQt5.QtCore import QSize, pyqtSignal
from PyQt5.QtGui import QIcon, QFont
from typing import Optional

from ...domain.models import Symbol, DataType, StockInfo
from ...services.price_data_manager import PriceDataManager


class DataTypeToggle(QWidget):
    """Toggle widget for switching between data types"""
    
    data_type_changed = pyqtSignal(Symbol, DataType)
    
    def __init__(self, price_data_manager: PriceDataManager, parent=None):
        super().__init__(parent)
        self.price_data_manager = price_data_manager
        self.current_symbol: Optional[Symbol] = None
        self.current_data_type = DataType.UNADJUSTED
        
        self._setup_ui()
        self._setup_connections()
    
    def _setup_ui(self):
        """Setup the user interface"""
        layout = QHBoxLayout()
        layout.setContentsMargins(5, 5, 5, 5)
        layout.setSpacing(2)
        
        # Data type label
        self.label = QLabel("نوع قیمت:")
        self.label.setStyleSheet("color: #888; font-weight: 500;")
        layout.addWidget(self.label)
        
        # Button group for exclusive selection
        self.button_group = QButtonGroup(self)
        
        # Unadjusted prices button
        self.unadjusted_btn = QPushButton("تعدیل نشده")
        self.unadjusted_btn.setCheckable(True)
        self.unadjusted_btn.setChecked(True)  # Default as requested
        self.unadjusted_btn.setMinimumSize(QSize(90, 28))
        self.unadjusted_btn.setToolTip("قیمت اصلی بدون تعدیل برای سهام و توزیع سود")
        self._style_button(self.unadjusted_btn, True)
        
        # Adjusted prices button  
        self.adjusted_btn = QPushButton("تعدیل شده")
        self.adjusted_btn.setCheckable(True)
        self.adjusted_btn.setMinimumSize(QSize(90, 28))
        self.adjusted_btn.setToolTip("قیمت تعدیل شده برای سهام و توزیع سود")
        self._style_button(self.adjusted_btn, False)
        
        # Add buttons to group and layout
        self.button_group.addButton(self.unadjusted_btn, DataType.UNADJUSTED.value)
        self.button_group.addButton(self.adjusted_btn, DataType.ADJUSTED.value)
        
        layout.addWidget(self.unadjusted_btn)
        layout.addWidget(self.adjusted_btn)
        
        # Status indicator
        self.status_label = QLabel("●")
        self.status_label.setStyleSheet("color: #4CAF50; font-size: 14px;")
        self.status_label.setToolTip("وضعیت: در دسترس")
        layout.addWidget(self.status_label)
        
        # Spacer
        layout.addStretch()
        
        # Info button
        self.info_btn = QPushButton("ℹ")
        self.info_btn.setMaximumSize(QSize(24, 24))
        self.info_btn.setStyleSheet("""
            QPushButton {
                background-color: #444;
                border: 1px solid #666;
                border-radius: 12px;
                color: #FFF;
                font-weight: bold;
                font-size: 10px;
            }
            QPushButton:hover {
                background-color: #555;
            }
        """)
        self.info_btn.setToolTip("راهنما: تعدیل نشده = قیمت اصلی، تعدیل شده = با احتساب سهام جایزه و تقسیم سود")
        layout.addWidget(self.info_btn)
        
        self.setLayout(layout)
        self.setMaximumHeight(40)
        
        # Initial state - disabled until symbol is set
        self.setEnabled(False)
    
    def _style_button(self, button: QPushButton, is_default: bool):
        """Apply styling to toggle buttons"""
        base_style = """
            QPushButton {
                background-color: #3a3a3a;
                border: 1px solid #555;
                border-radius: 4px;
                padding: 4px 8px;
                font-weight: 500;
                font-size: 11px;
            }
            QPushButton:hover {
                background-color: #4a4a4a;
                border-color: #666;
            }
            QPushButton:checked {
                background-color: #0d7377;
                border-color: #0d7377;
                color: white;
                font-weight: bold;
            }
            QPushButton:disabled {
                background-color: #222;
                border-color: #333;
                color: #666;
            }
        """
        button.setStyleSheet(base_style)
    
    def _setup_connections(self):
        """Setup signal connections"""
        self.button_group.buttonClicked.connect(self._on_data_type_clicked)
        self.info_btn.clicked.connect(self._show_info_dialog)
    
    def set_symbol(self, symbol: Symbol):
        """Set the current symbol and update UI state"""
        self.current_symbol = symbol
        
        if not symbol:
            self.setEnabled(False)
            return
        
        # Get stock info to determine available data types
        stock_info = self.price_data_manager.get_stock_info(symbol)
        
        # Update button availability
        self.unadjusted_btn.setEnabled(stock_info.has_unadjusted_data)
        self.adjusted_btn.setEnabled(stock_info.has_adjusted_data)
        
        # Set default data type
        self.current_data_type = stock_info.default_data_type
        self._update_button_selection()
        
        # Update status indicator
        if stock_info.has_adjusted_data and stock_info.has_unadjusted_data:
            self.status_label.setStyleSheet("color: #4CAF50; font-size: 14px;")
            self.status_label.setToolTip("هر دو نوع قیمت در دسترس است")
        elif stock_info.has_unadjusted_data:
            self.status_label.setStyleSheet("color: #FF9800; font-size: 14px;")
            self.status_label.setToolTip("فقط قیمت تعدیل نشده در دسترس است")
        else:
            self.status_label.setStyleSheet("color: #F44336; font-size: 14px;")
            self.status_label.setToolTip("هیچ داده‌ای در دسترس نیست")
        
        self.setEnabled(True)
    
    def get_current_data_type(self) -> DataType:
        """Get the currently selected data type"""
        return self.current_data_type
    
    def set_data_type(self, data_type: DataType):
        """Programmatically set the data type"""
        if not self.current_symbol:
            return
        
        stock_info = self.price_data_manager.get_stock_info(self.current_symbol)
        
        if not stock_info.supports_data_type(data_type):
            return  # Cannot set unsupported data type
        
        self.current_data_type = data_type
        self._update_button_selection()
    
    def _update_button_selection(self):
        """Update button selection based on current data type"""
        if self.current_data_type == DataType.UNADJUSTED:
            self.unadjusted_btn.setChecked(True)
            self.adjusted_btn.setChecked(False)
        else:
            self.unadjusted_btn.setChecked(False) 
            self.adjusted_btn.setChecked(True)
    
    def _on_data_type_clicked(self, button: QPushButton):
        """Handle data type button click"""
        if not self.current_symbol:
            return
        
        # Determine new data type
        if button == self.unadjusted_btn:
            new_data_type = DataType.UNADJUSTED
        else:
            new_data_type = DataType.ADJUSTED
        
        if new_data_type == self.current_data_type:
            return  # No change
        
        # Try to switch data type
        success = self.price_data_manager.switch_data_type(self.current_symbol, new_data_type)
        
        if success:
            self.current_data_type = new_data_type
            self.data_type_changed.emit(self.current_symbol, new_data_type)
        else:
            # Revert button selection if switch failed
            self._update_button_selection()
    
    def _show_info_dialog(self):
        """Show information dialog about data types"""
        info_text = """
        <b>انواع قیمت سهام:</b><br><br>
        
        <b>تعدیل نشده:</b><br>
        • قیمت اصلی سهم در بازار<br>
        • بدون محاسبه سهام جایزه و تقسیم سود<br>
        • مناسب برای تحلیل تاریخی و مقایسه<br><br>
        
        <b>تعدیل شده:</b><br>
        • قیمت با احتساب سهام جایزه و تقسیم سود<br>
        • نمایش پیوسته و منطقی قیمت<br>
        • مناسب برای تحلیل تکنیکال و اندیکاتورها<br><br>
        
        <b>نکته:</b> پیش‌فرض سیستم قیمت تعدیل نشده است.
        """
        
        QToolTip.showText(self.info_btn.mapToGlobal(self.info_btn.rect().bottomLeft()), 
                         info_text, self.info_btn)


class DataTypeFrame(QFrame):
    """Frame container for data type toggle with better visual separation"""
    
    def __init__(self, price_data_manager: PriceDataManager, parent=None):
        super().__init__(parent)
        
        # Setup frame appearance
        self.setFrameStyle(QFrame.StyledPanel | QFrame.Raised)
        self.setLineWidth(1)
        self.setStyleSheet("""
            QFrame {
                background-color: #2a2a2a;
                border: 1px solid #444;
                border-radius: 6px;
                margin: 2px;
            }
        """)
        
        # Layout
        layout = QVBoxLayout()
        layout.setContentsMargins(8, 6, 8, 6)
        
        # Title
        title = QLabel("نوع نمایش قیمت")
        title.setStyleSheet("color: #DDD; font-weight: bold; font-size: 12px;")
        layout.addWidget(title)
        
        # Toggle widget
        self.toggle = DataTypeToggle(price_data_manager, self)
        layout.addWidget(self.toggle)
        
        self.setLayout(layout)
        self.setMaximumHeight(70)
    
    def set_symbol(self, symbol: Symbol):
        """Set symbol for the toggle"""
        self.toggle.set_symbol(symbol)
    
    def get_data_type_toggle(self) -> DataTypeToggle:
        """Get the toggle widget"""
        return self.toggle