"""
Composite Chart Panel - پنل مدیریت نمودارهای ترکیبی
رابط کاربری برای ایجاد و مدیریت نمودارهای پیچیده ریاضی
"""

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QGridLayout, QFormLayout,
    QPushButton, QLabel, QLineEdit, QTextEdit, QComboBox, QSpinBox,
    QListWidget, QListWidgetItem, QTabWidget, QGroupBox, QSplitter,
    QDialog, QDialogButtonBox, QColorDialog, QCheckBox, QSlider,
    QTableWidget, QTableWidgetItem, QHeaderView, QTreeWidget,
    QTreeWidgetItem, QFrame, QScrollArea, QProgressBar, QMenu,
    QMessageBox, QFileDialog, QCompleter, QStringListModel
)
from PyQt5.QtCore import Qt, QTimer, pyqtSignal, QThread, pyqtSlot, QStringListModel
from PyQt5.QtGui import QFont, QColor, QPalette, QSyntaxHighlighter, QTextCharFormat, QTextDocument

from typing import Dict, List, Any, Optional
import json
import re
from datetime import datetime, timedelta

from ..services.container import ServiceContainer
from ..services.composite_chart_service import CompositeChartService, CompositeChart, ChartType, DisplayLocation, ChartStyle
from ..services.expression_engine import ExpressionVariable
from ..services.data_alignment_service import DataAlignmentService


class ExpressionHighlighter(QSyntaxHighlighter):
    """هایلایتر برای عبارات ریاضی"""
    
    def __init__(self, parent=None):
        super().__init__(parent)
        
        # قوانین هایلایت
        self.highlighting_rules = []
        
        # متغیرها (حروف بزرگ)
        variable_format = QTextCharFormat()
        variable_format.setForeground(QColor("#2196F3"))
        variable_format.setFontWeight(QFont.Bold)
        self.highlighting_rules.append((r'\b[A-Z][A-Z0-9_]*\b', variable_format))
        
        # اعداد
        number_format = QTextCharFormat()
        number_format.setForeground(QColor("#FF9800"))
        self.highlighting_rules.append((r'\b\d+\.?\d*\b', number_format))
        
        # توابع
        function_format = QTextCharFormat()
        function_format.setForeground(QColor("#4CAF50"))
        function_format.setFontWeight(QFont.Bold)
        functions = ['SMA', 'EMA', 'MAX', 'MIN', 'STDEV', 'LOG', 'ABS', 'POW', 'SQRT', 'SIN', 'COS', 'TAN']
        for func in functions:
            self.highlighting_rules.append((rf'\b{func}\b', function_format))
        
        # عملگرها
        operator_format = QTextCharFormat()
        operator_format.setForeground(QColor("#E91E63"))
        operator_format.setFontWeight(QFont.Bold)
        self.highlighting_rules.append((r'[+\-*/^()]', operator_format))
        
        # پرانتزها
        parenthesis_format = QTextCharFormat()
        parenthesis_format.setForeground(QColor("#9C27B0"))
        parenthesis_format.setFontWeight(QFont.Bold)
        self.highlighting_rules.append((r'[()]', parenthesis_format))
    
    def highlightBlock(self, text):
        """هایلایت کردن بلوک متن"""
        for pattern, format_obj in self.highlighting_rules:
            regex = re.compile(pattern)
            for match in regex.finditer(text):
                start, end = match.span()
                self.setFormat(start, end - start, format_obj)


class VariableDefinitionDialog(QDialog):
    """دیالوگ تعریف متغیر"""
    
    def __init__(self, variable_name: str = "", parent=None):
        super().__init__(parent)
        self.variable_name = variable_name
        self.setWindowTitle(f"تعریف متغیر {variable_name}" if variable_name else "تعریف متغیر جدید")
        self.setModal(True)
        self.resize(400, 300)
        
        self._setup_ui()
        self._load_available_symbols()
    
    def _setup_ui(self):
        """راه‌اندازی رابط کاربری"""
        layout = QVBoxLayout(self)
        
        # فرم تعریف متغیر
        form = QFormLayout()
        
        # نام متغیر
        self.variable_name_edit = QLineEdit(self.variable_name)
        self.variable_name_edit.setPlaceholderText("مثال: USD, STOCK1, GOLD")
        form.addRow("نام متغیر:", self.variable_name_edit)
        
        # سمبل
        self.symbol_combo = QComboBox()
        self.symbol_combo.setEditable(True)
        self.symbol_combo.setPlaceholderText("انتخاب یا وارد کردن سمبل")
        form.addRow("سمبل:", self.symbol_combo)
        
        # نوع قیمت
        self.price_type_combo = QComboBox()
        self.price_type_combo.addItems(["close", "open", "high", "low", "hl2", "hlc3", "ohlc4"])
        form.addRow("نوع قیمت:", self.price_type_combo)
        
        # توضیحات
        self.description_edit = QLineEdit()
        self.description_edit.setPlaceholderText("توضیحات اختیاری")
        form.addRow("توضیحات:", self.description_edit)
        
        layout.addLayout(form)
        
        # دکمه‌ها
        buttons = QDialogButtonBox(
            QDialogButtonBox.Ok | QDialogButtonBox.Cancel,
            Qt.Horizontal
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)
    
    def _load_available_symbols(self):
        """بارگذاری سمبل‌های موجود"""
        # نمونه سمبل‌ها - در عمل از دیتابیس بارگذاری می‌شود
        symbols = [
            "USD/IRR", "EUR/IRR", "GBP/IRR",
            "GOLD/IRR", "SILVER/IRR",
            "AAPL", "GOOGL", "MSFT", "TSLA",
            "BTCUSD", "ETHUSD",
            "CRUDE_OIL", "NATURAL_GAS"
        ]
        self.symbol_combo.addItems(symbols)
        
        # تنظیم autocomplete
        completer = QCompleter(symbols)
        completer.setCaseSensitivity(Qt.CaseInsensitive)
        self.symbol_combo.setCompleter(completer)
    
    def get_variable(self) -> Optional[ExpressionVariable]:
        """دریافت متغیر تعریف شده"""
        name = self.variable_name_edit.text().strip()
        symbol = self.symbol_combo.currentText().strip()
        price_type = self.price_type_combo.currentText()
        description = self.description_edit.text().strip()
        
        if not name or not symbol:
            return None
        
        return ExpressionVariable(
            name=name,
            symbol=symbol,
            price_type=price_type,
            description=description
        )


class ExpressionBuilderWidget(QWidget):
    """ویجت ساخت عبارات ریاضی"""
    
    expression_changed = pyqtSignal(str)
    variable_needed = pyqtSignal(str)
    
    def __init__(self, parent=None):
        super().__init__(parent)
        self._setup_ui()
        
        # متغیرهای تعریف شده
        self.defined_variables: Dict[str, ExpressionVariable] = {}
        
        # تایمر برای validation
        self.validation_timer = QTimer()
        self.validation_timer.setSingleShot(True)
        self.validation_timer.timeout.connect(self._validate_expression)
    
    def _setup_ui(self):
        """راه‌اندازی رابط کاربری"""
        layout = QVBoxLayout(self)
        
        # عنوان
        title = QLabel("ساخت عبارت ریاضی")
        title.setFont(QFont("Segoe UI", 12, QFont.Bold))
        layout.addWidget(title)
        
        # منطقه ورودی عبارت
        expression_group = QGroupBox("عبارت ریاضی")
        expression_layout = QVBoxLayout(expression_group)
        
        # ادیتور عبارت
        self.expression_edit = QTextEdit()
        self.expression_edit.setMaximumHeight(100)
        self.expression_edit.setPlaceholderText("مثال: (USD * GOLD) / (STOCK1 + STOCK2)^2")
        
        # اعمال syntax highlighting
        self.highlighter = ExpressionHighlighter(self.expression_edit.document())
        
        # اتصال سیگنال تغییر متن
        self.expression_edit.textChanged.connect(self._on_expression_changed)
        
        expression_layout.addWidget(self.expression_edit)
        
        # نوار ابزار عبارت
        toolbar_layout = QHBoxLayout()
        
        # دکمه‌های عملگر
        operators = ['+', '-', '*', '/', '^', '(', ')']
        for op in operators:
            btn = QPushButton(op)
            btn.setMaximumWidth(30)
            btn.clicked.connect(lambda checked, o=op: self._insert_operator(o))
            toolbar_layout.addWidget(btn)
        
        toolbar_layout.addStretch()
        
        # دکمه پاک کردن
        clear_btn = QPushButton("پاک")
        clear_btn.clicked.connect(self.expression_edit.clear)
        toolbar_layout.addWidget(clear_btn)
        
        expression_layout.addLayout(toolbar_layout)
        layout.addWidget(expression_group)
        
        # منطقه توابع
        functions_group = QGroupBox("توابع")
        functions_layout = QGridLayout(functions_group)
        
        functions = [
            ('SMA', 'میانگین متحرک ساده'),
            ('EMA', 'میانگین متحرک نمایی'),
            ('MAX', 'حداکثر'),
            ('MIN', 'حداقل'),
            ('STDEV', 'انحراف معیار'),
            ('LOG', 'لگاریتم'),
            ('ABS', 'قدر مطلق'),
            ('SQRT', 'جذر')
        ]
        
        for i, (func, desc) in enumerate(functions):
            btn = QPushButton(f"{func}")
            btn.setToolTip(desc)
            btn.clicked.connect(lambda checked, f=func: self._insert_function(f))
            row, col = divmod(i, 4)
            functions_layout.addWidget(btn, row, col)
        
        layout.addWidget(functions_group)
        
        # منطقه متغیرها
        variables_group = QGroupBox("متغیرها")
        variables_layout = QVBoxLayout(variables_group)
        
        # دکمه افزودن متغیر
        add_var_btn = QPushButton("+ افزودن متغیر")
        add_var_btn.clicked.connect(self._add_variable)
        variables_layout.addWidget(add_var_btn)
        
        # لیست متغیرها
        self.variables_list = QListWidget()
        self.variables_list.setMaximumHeight(100)
        self.variables_list.itemDoubleClicked.connect(self._insert_variable)
        variables_layout.addWidget(self.variables_list)
        
        layout.addWidget(variables_group)
        
        # منطقه validation
        self.validation_label = QLabel()
        self.validation_label.setWordWrap(True)
        layout.addWidget(self.validation_label)
    
    def _insert_operator(self, operator: str):
        """درج عملگر"""
        cursor = self.expression_edit.textCursor()
        cursor.insertText(operator)
        self.expression_edit.setTextCursor(cursor)
    
    def _insert_function(self, function: str):
        """درج تابع"""
        cursor = self.expression_edit.textCursor()
        cursor.insertText(f"{function}()")
        # جابجایی cursor به داخل پرانتز
        cursor.movePosition(cursor.Left, cursor.MoveAnchor, 1)
        self.expression_edit.setTextCursor(cursor)
    
    def _insert_variable(self, item: QListWidgetItem):
        """درج متغیر"""
        var_name = item.text().split(' - ')[0]
        cursor = self.expression_edit.textCursor()
        cursor.insertText(var_name)
        self.expression_edit.setTextCursor(cursor)
    
    def _add_variable(self):
        """افزودن متغیر جدید"""
        dialog = VariableDefinitionDialog(parent=self)
        if dialog.exec_() == QDialog.Accepted:
            variable = dialog.get_variable()
            if variable:
                self.defined_variables[variable.name] = variable
                self._update_variables_list()
    
    def _update_variables_list(self):
        """بروزرسانی لیست متغیرها"""
        self.variables_list.clear()
        for name, var in self.defined_variables.items():
            item_text = f"{name} - {var.symbol} ({var.price_type})"
            if var.description:
                item_text += f" - {var.description}"
            self.variables_list.addItem(item_text)
    
    def _on_expression_changed(self):
        """مدیریت تغییر عبارت"""
        # شروع تایمر validation با تاخیر
        self.validation_timer.start(500)
        
        # ارسال سیگنال تغییر
        expression = self.expression_edit.toPlainText()
        self.expression_changed.emit(expression)
    
    def _validate_expression(self):
        """اعتبارسنجی عبارت"""
        expression = self.expression_edit.toPlainText().strip()
        
        if not expression:
            self.validation_label.clear()
            return
        
        try:
            # بررسی ساده syntax
            # یافتن متغیرهای استفاده شده
            pattern = r'\b[A-Za-z][A-Za-z0-9_]*\b'
            used_vars = set(re.findall(pattern, expression))
            
            # حذف توابع از لیست متغیرها
            functions = ['SMA', 'EMA', 'MAX', 'MIN', 'STDEV', 'LOG', 'ABS', 'SQRT', 'SIN', 'COS', 'TAN']
            used_vars = used_vars - set(functions)
            
            # بررسی وجود متغیرهای تعریف نشده
            undefined_vars = used_vars - set(self.defined_variables.keys())
            
            if undefined_vars:
                self.validation_label.setText(f"⚠️ متغیرهای تعریف نشده: {', '.join(undefined_vars)}")
                self.validation_label.setStyleSheet("color: orange;")
                
                # درخواست تعریف متغیرها
                for var in undefined_vars:
                    self.variable_needed.emit(var)
            else:
                self.validation_label.setText("✅ عبارت معتبر است")
                self.validation_label.setStyleSheet("color: green;")
                
        except Exception as e:
            self.validation_label.setText(f"❌ خطا: {str(e)}")
            self.validation_label.setStyleSheet("color: red;")
    
    def get_expression(self) -> str:
        """دریافت عبارت"""
        return self.expression_edit.toPlainText().strip()
    
    def get_variables(self) -> Dict[str, ExpressionVariable]:
        """دریافت متغیرهای تعریف شده"""
        return self.defined_variables.copy()
    
    def set_expression(self, expression: str):
        """تنظیم عبارت"""
        self.expression_edit.setPlainText(expression)
    
    def set_variables(self, variables: Dict[str, ExpressionVariable]):
        """تنظیم متغیرها"""
        self.defined_variables = variables.copy()
        self._update_variables_list()


class ChartStyleWidget(QWidget):
    """ویجت تنظیمات ظاهری نمودار"""
    
    style_changed = pyqtSignal(object)  # ChartStyle
    
    def __init__(self, initial_style: Optional[ChartStyle] = None, parent=None):
        super().__init__(parent)
        self.current_style = initial_style or ChartStyle()
        self._setup_ui()
        self._load_current_style()
    
    def _setup_ui(self):
        """راه‌اندازی رابط کاربری"""
        layout = QFormLayout(self)
        
        # رنگ
        color_layout = QHBoxLayout()
        self.color_button = QPushButton()
        self.color_button.setMaximumWidth(50)
        self.color_button.clicked.connect(self._choose_color)
        color_layout.addWidget(self.color_button)
        
        self.color_label = QLabel()
        color_layout.addWidget(self.color_label)
        color_layout.addStretch()
        
        layout.addRow("رنگ:", color_layout)
        
        # ضخامت خط
        self.line_width_spin = QSpinBox()
        self.line_width_spin.setRange(1, 10)
        self.line_width_spin.valueChanged.connect(self._on_style_changed)
        layout.addRow("ضخامت خط:", self.line_width_spin)
        
        # نوع خط
        self.line_style_combo = QComboBox()
        self.line_style_combo.addItems(["solid", "dashed", "dotted"])
        self.line_style_combo.currentTextChanged.connect(self._on_style_changed)
        layout.addRow("نوع خط:", self.line_style_combo)
        
        # شفافیت پر کردن
        self.fill_opacity_slider = QSlider(Qt.Horizontal)
        self.fill_opacity_slider.setRange(0, 100)
        self.fill_opacity_slider.valueChanged.connect(self._on_style_changed)
        
        opacity_layout = QHBoxLayout()
        opacity_layout.addWidget(self.fill_opacity_slider)
        self.opacity_label = QLabel()
        opacity_layout.addWidget(self.opacity_label)
        
        layout.addRow("شفافیت:", opacity_layout)
        
        # نمایش نقاط
        self.show_markers_check = QCheckBox()
        self.show_markers_check.stateChanged.connect(self._on_style_changed)
        layout.addRow("نمایش نقاط:", self.show_markers_check)
        
        # اندازه نقاط
        self.marker_size_spin = QSpinBox()
        self.marker_size_spin.setRange(2, 20)
        self.marker_size_spin.valueChanged.connect(self._on_style_changed)
        layout.addRow("اندازه نقاط:", self.marker_size_spin)
    
    def _load_current_style(self):
        """بارگذاری تنظیمات فعلی"""
        self._update_color_button(self.current_style.color)
        self.line_width_spin.setValue(self.current_style.line_width)
        self.line_style_combo.setCurrentText(self.current_style.line_style)
        self.fill_opacity_slider.setValue(int(self.current_style.fill_opacity * 100))
        self._update_opacity_label()
        self.show_markers_check.setChecked(self.current_style.show_markers)
        self.marker_size_spin.setValue(self.current_style.marker_size)
    
    def _choose_color(self):
        """انتخاب رنگ"""
        color = QColorDialog.getColor(QColor(self.current_style.color), self)
        if color.isValid():
            self.current_style.color = color.name()
            self._update_color_button(color.name())
            self._on_style_changed()
    
    def _update_color_button(self, color: str):
        """بروزرسانی دکمه رنگ"""
        self.color_button.setStyleSheet(f"background-color: {color}; border: 1px solid #ccc;")
        self.color_label.setText(color)
    
    def _update_opacity_label(self):
        """بروزرسانی برچسب شفافیت"""
        opacity_percent = self.fill_opacity_slider.value()
        self.opacity_label.setText(f"{opacity_percent}%")
    
    def _on_style_changed(self):
        """مدیریت تغییر تنظیمات"""
        # بروزرسانی opacity label
        self._update_opacity_label()
        
        # بروزرسانی style
        self.current_style.line_width = self.line_width_spin.value()
        self.current_style.line_style = self.line_style_combo.currentText()
        self.current_style.fill_opacity = self.fill_opacity_slider.value() / 100.0
        self.current_style.show_markers = self.show_markers_check.isChecked()
        self.current_style.marker_size = self.marker_size_spin.value()
        
        # ارسال سیگنال تغییر
        self.style_changed.emit(self.current_style)
    
    def get_style(self) -> ChartStyle:
        """دریافت تنظیمات فعلی"""
        return self.current_style
    
    def set_style(self, style: ChartStyle):
        """تنظیم style جدید"""
        self.current_style = style
        self._load_current_style()


class CompositeChartPanel(QWidget):
    """پنل اصلی مدیریت نمودارهای ترکیبی"""
    
    def __init__(self, container: ServiceContainer, parent=None):
        super().__init__(parent)
        self.container = container
        
        # دریافت سرویس‌ها
        self.data_service: DataAlignmentService = container.get('data_alignment_service')
        self.composite_service: CompositeChartService = container.get('composite_chart_service')
        
        self._setup_ui()
        self._load_charts()
        
        # تایمر بروزرسانی
        self.update_timer = QTimer()
        self.update_timer.timeout.connect(self._update_charts)
        self.update_timer.start(10000)  # هر 10 ثانیه
    
    def _setup_ui(self):
        """راه‌اندازی رابط کاربری"""
        layout = QVBoxLayout(self)
        
        # عنوان و کنترل‌ها
        header_layout = QHBoxLayout()
        
        title = QLabel("نمودارهای ترکیبی")
        title.setFont(QFont("Segoe UI", 14, QFont.Bold))
        header_layout.addWidget(title)
        
        header_layout.addStretch()
        
        # دکمه‌های کنترل
        self.new_chart_btn = QPushButton("+ نمودار جدید")
        self.new_chart_btn.clicked.connect(self._create_new_chart)
        header_layout.addWidget(self.new_chart_btn)
        
        self.import_btn = QPushButton("واردات")
        self.import_btn.clicked.connect(self._import_chart)
        header_layout.addWidget(self.import_btn)
        
        self.export_btn = QPushButton("صادرات")
        self.export_btn.clicked.connect(self._export_chart)
        header_layout.addWidget(self.export_btn)
        
        layout.addLayout(header_layout)
        
        # تب‌ها
        self.tabs = QTabWidget()
        
        # تب لیست نمودارها
        self.charts_tab = self._create_charts_tab()
        self.tabs.addTab(self.charts_tab, "نمودارهای فعال")
        
        # تب ساخت نمودار
        self.builder_tab = self._create_builder_tab()
        self.tabs.addTab(self.builder_tab, "ساخت نمودار")
        
        # تب گزارشات
        self.reports_tab = self._create_reports_tab()
        self.tabs.addTab(self.reports_tab, "گزارشات")
        
        layout.addWidget(self.tabs)
    
    def _create_charts_tab(self) -> QWidget:
        """ایجاد تب لیست نمودارها"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # جدول نمودارها
        self.charts_table = QTableWidget()
        self.charts_table.setColumnCount(6)
        self.charts_table.setHorizontalHeaderLabels([
            "نام", "عبارت", "نوع", "موقعیت", "فعال", "عملیات"
        ])
        
        # تنظیم ستون‌ها
        header = self.charts_table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeToContents)  # نام
        header.setSectionResizeMode(1, QHeaderView.Stretch)           # عبارت
        header.setSectionResizeMode(2, QHeaderView.ResizeToContents)  # نوع
        header.setSectionResizeMode(3, QHeaderView.ResizeToContents)  # موقعیت
        header.setSectionResizeMode(4, QHeaderView.ResizeToContents)  # فعال
        header.setSectionResizeMode(5, QHeaderView.ResizeToContents)  # عملیات
        
        layout.addWidget(self.charts_table)
        
        return widget
    
    def _create_builder_tab(self) -> QWidget:
        """ایجاد تب ساخت نمودار"""
        widget = QWidget()
        layout = QHBoxLayout(widget)
        
        # سمت چپ - ساخت عبارت
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        
        # ساخت عبارت
        self.expression_builder = ExpressionBuilderWidget()
        self.expression_builder.expression_changed.connect(self._on_expression_changed)
        self.expression_builder.variable_needed.connect(self._on_variable_needed)
        left_layout.addWidget(self.expression_builder)
        
        layout.addWidget(left_panel, 2)
        
        # سمت راست - تنظیمات نمودار
        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)
        
        # تنظیمات عمومی
        settings_group = QGroupBox("تنظیمات نمودار")
        settings_layout = QFormLayout(settings_group)
        
        # نام نمودار
        self.chart_name_edit = QLineEdit()
        self.chart_name_edit.setPlaceholderText("نام نمودار")
        settings_layout.addRow("نام:", self.chart_name_edit)
        
        # نوع نمودار
        self.chart_type_combo = QComboBox()
        self.chart_type_combo.addItems([e.value for e in ChartType])
        settings_layout.addRow("نوع:", self.chart_type_combo)
        
        # موقعیت نمایش
        self.display_location_combo = QComboBox()
        self.display_location_combo.addItems([e.value for e in DisplayLocation])
        settings_layout.addRow("موقعیت:", self.display_location_combo)
        
        right_layout.addWidget(settings_group)
        
        # تنظیمات ظاهری
        style_group = QGroupBox("تنظیمات ظاهری")
        style_layout = QVBoxLayout(style_group)
        
        self.style_widget = ChartStyleWidget()
        style_layout.addWidget(self.style_widget)
        
        right_layout.addWidget(style_group)
        
        # دکمه‌های عمل
        actions_layout = QHBoxLayout()
        
        self.preview_btn = QPushButton("پیش‌نمایش")
        self.preview_btn.clicked.connect(self._preview_chart)
        actions_layout.addWidget(self.preview_btn)
        
        self.create_btn = QPushButton("ایجاد نمودار")
        self.create_btn.setStyleSheet("""
            QPushButton {
                background-color: #4CAF50;
                color: white;
                font-weight: bold;
                padding: 8px 16px;
                border-radius: 4px;
            }
            QPushButton:hover {
                background-color: #45a049;
            }
        """)
        self.create_btn.clicked.connect(self._create_chart)
        actions_layout.addWidget(self.create_btn)
        
        right_layout.addLayout(actions_layout)
        right_layout.addStretch()
        
        layout.addWidget(right_panel, 1)
        
        return widget
    
    def _create_reports_tab(self) -> QWidget:
        """ایجاد تب گزارشات"""
        widget = QWidget()
        layout = QVBoxLayout(widget)
        
        # وضعیت سرویس
        status_group = QGroupBox("وضعیت سرویس")
        status_layout = QGridLayout(status_group)
        
        self.status_labels = {}
        status_items = [
            ("نمودارهای فعال", "active_charts"),
            ("حداکثر نمودار", "max_charts"),
            ("اندازه کش", "cache_size"),
            ("نمودارهای فعال", "enabled_charts")
        ]
        
        for i, (label, key) in enumerate(status_items):
            status_layout.addWidget(QLabel(f"{label}:"), i, 0)
            value_label = QLabel("--")
            self.status_labels[key] = value_label
            status_layout.addWidget(value_label, i, 1)
        
        layout.addWidget(status_group)
        
        # دکمه‌های مدیریت
        management_layout = QHBoxLayout()
        
        refresh_btn = QPushButton("بروزرسانی")
        refresh_btn.clicked.connect(self._refresh_status)
        management_layout.addWidget(refresh_btn)
        
        clear_cache_btn = QPushButton("پاک کردن کش")
        clear_cache_btn.clicked.connect(self._clear_cache)
        management_layout.addWidget(clear_cache_btn)
        
        management_layout.addStretch()
        
        layout.addLayout(management_layout)
        layout.addStretch()
        
        return widget
    
    def _create_new_chart(self):
        """ایجاد نمودار جدید"""
        self.tabs.setCurrentIndex(1)  # رفتن به تب ساخت
    
    def _create_chart(self):
        """ایجاد نمودار از تنظیمات فعلی"""
        try:
            name = self.chart_name_edit.text().strip()
            expression = self.expression_builder.get_expression()
            variables = self.expression_builder.get_variables()
            
            if not name:
                QMessageBox.warning(self, "خطا", "لطفاً نام نمودار را وارد کنید")
                return
            
            if not expression:
                QMessageBox.warning(self, "خطا", "لطفاً عبارت ریاضی را وارد کنید")
                return
            
            if not variables:
                QMessageBox.warning(self, "خطا", "لطفاً حداقل یک متغیر تعریف کنید")
                return
            
            # ایجاد نمودار
            chart_id = self.composite_service.create_chart(
                name=name,
                expression=expression,
                variables=variables,
                chart_type=ChartType(self.chart_type_combo.currentText()),
                display_location=DisplayLocation(self.display_location_combo.currentText()),
                style=self.style_widget.get_style()
            )
            
            # پیام موفقیت
            QMessageBox.information(self, "موفق", f"نمودار '{name}' با موفقیت ایجاد شد")
            
            # بروزرسانی لیست
            self._load_charts()
            
            # رفتن به تب لیست
            self.tabs.setCurrentIndex(0)
            
        except Exception as e:
            QMessageBox.critical(self, "خطا", f"خطا در ایجاد نمودار: {str(e)}")
    
    def _preview_chart(self):
        """پیش‌نمایش نمودار"""
        QMessageBox.information(self, "پیش‌نمایش", "پیش‌نمایش نمودار به زودی اضافه خواهد شد")
    
    def _load_charts(self):
        """بارگذاری لیست نمودارها"""
        charts = self.composite_service.get_all_charts()
        
        self.charts_table.setRowCount(len(charts))
        
        for i, chart in enumerate(charts):
            # نام
            self.charts_table.setItem(i, 0, QTableWidgetItem(chart.name))
            
            # عبارت
            expression_item = QTableWidgetItem(chart.expression)
            expression_item.setToolTip(chart.expression)
            self.charts_table.setItem(i, 1, expression_item)
            
            # نوع
            self.charts_table.setItem(i, 2, QTableWidgetItem(chart.chart_type.value))
            
            # موقعیت
            self.charts_table.setItem(i, 3, QTableWidgetItem(chart.display_location.value))
            
            # فعال
            enabled_item = QTableWidgetItem("✅" if chart.enabled else "❌")
            self.charts_table.setItem(i, 4, enabled_item)
            
            # دکمه‌های عمل
            actions_widget = QWidget()
            actions_layout = QHBoxLayout(actions_widget)
            actions_layout.setContentsMargins(2, 2, 2, 2)
            
            # دکمه ویرایش
            edit_btn = QPushButton("✏️")
            edit_btn.setMaximumWidth(30)
            edit_btn.clicked.connect(lambda checked, chart_id=chart.id: self._edit_chart(chart_id))
            actions_layout.addWidget(edit_btn)
            
            # دکمه حذف
            delete_btn = QPushButton("🗑️")
            delete_btn.setMaximumWidth(30)
            delete_btn.clicked.connect(lambda checked, chart_id=chart.id: self._delete_chart(chart_id))
            actions_layout.addWidget(delete_btn)
            
            self.charts_table.setCellWidget(i, 5, actions_widget)
    
    def _edit_chart(self, chart_id: str):
        """ویرایش نمودار"""
        chart = self.composite_service.get_chart(chart_id)
        if not chart:
            return
        
        # بارگذاری تنظیمات در تب ساخت
        self.chart_name_edit.setText(chart.name)
        self.expression_builder.set_expression(chart.expression)
        self.expression_builder.set_variables(chart.variables)
        self.chart_type_combo.setCurrentText(chart.chart_type.value)
        self.display_location_combo.setCurrentText(chart.display_location.value)
        self.style_widget.set_style(chart.style)
        
        # رفتن به تب ساخت
        self.tabs.setCurrentIndex(1)
    
    def _delete_chart(self, chart_id: str):
        """حذف نمودار"""
        chart = self.composite_service.get_chart(chart_id)
        if not chart:
            return
        
        reply = QMessageBox.question(
            self, "تأیید حذف",
            f"آیا مطمئن هستید که می‌خواهید نمودار '{chart.name}' را حذف کنید؟",
            QMessageBox.Yes | QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            if self.composite_service.delete_chart(chart_id):
                QMessageBox.information(self, "موفق", "نمودار با موفقیت حذف شد")
                self._load_charts()
            else:
                QMessageBox.critical(self, "خطا", "خطا در حذف نمودار")
    
    def _import_chart(self):
        """واردات نمودار"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "واردات نمودار", "", "JSON Files (*.json)"
        )
        
        if file_path:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    config_json = f.read()
                
                chart_id = self.composite_service.import_chart_config(config_json)
                if chart_id:
                    QMessageBox.information(self, "موفق", "نمودار با موفقیت وارد شد")
                    self._load_charts()
                else:
                    QMessageBox.critical(self, "خطا", "خطا در واردات نمودار")
                    
            except Exception as e:
                QMessageBox.critical(self, "خطا", f"خطا در خواندن فایل: {str(e)}")
    
    def _export_chart(self):
        """صادرات نمودار"""
        if self.charts_table.currentRow() < 0:
            QMessageBox.warning(self, "خطا", "لطفاً نمودار مورد نظر را انتخاب کنید")
            return
        
        # شناسایی نمودار انتخاب شده
        charts = self.composite_service.get_all_charts()
        if self.charts_table.currentRow() >= len(charts):
            return
        
        chart = charts[self.charts_table.currentRow()]
        
        file_path, _ = QFileDialog.getSaveFileName(
            self, "صادرات نمودار", f"{chart.name}.json", "JSON Files (*.json)"
        )
        
        if file_path:
            try:
                config_json = self.composite_service.export_chart_config(chart.id)
                if config_json:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(config_json)
                    QMessageBox.information(self, "موفق", "نمودار با موفقیت صادر شد")
                else:
                    QMessageBox.critical(self, "خطا", "خطا در صادرات نمودار")
                    
            except Exception as e:
                QMessageBox.critical(self, "خطا", f"خطا در ذخیره فایل: {str(e)}")
    
    def _update_charts(self):
        """بروزرسانی نمودارها"""
        # بروزرسانی وضعیت
        self._refresh_status()
    
    def _refresh_status(self):
        """بروزرسانی وضعیت سرویس"""
        if hasattr(self.composite_service, 'get_service_status'):
            status = self.composite_service.get_service_status()
            for key, label in self.status_labels.items():
                value = status.get(key, 0)
                label.setText(str(value))
    
    def _clear_cache(self):
        """پاک کردن کش"""
        reply = QMessageBox.question(
            self, "تأیید", "آیا مطمئن هستید که می‌خواهید کش را پاک کنید؟",
            QMessageBox.Yes | QMessageBox.No
        )
        
        if reply == QMessageBox.Yes:
            if hasattr(self.composite_service, 'clear_all_cache'):
                self.composite_service.clear_all_cache()
                QMessageBox.information(self, "موفق", "کش با موفقیت پاک شد")
                self._refresh_status()
    
    def _on_expression_changed(self, expression: str):
        """مدیریت تغییر عبارت"""
        # بروزرسانی نام پیش‌فرض نمودار
        if not self.chart_name_edit.text():
            # ایجاد نام از عبارت
            short_expr = expression[:30] + "..." if len(expression) > 30 else expression
            self.chart_name_edit.setText(f"Chart: {short_expr}")
    
    def _on_variable_needed(self, variable_name: str):
        """مدیریت نیاز به متغیر جدید"""
        # ایجاد خودکار متغیر
        dialog = VariableDefinitionDialog(variable_name, self)
        if dialog.exec_() == QDialog.Accepted:
            variable = dialog.get_variable()
            if variable:
                self.expression_builder.defined_variables[variable.name] = variable
                self.expression_builder._update_variables_list()