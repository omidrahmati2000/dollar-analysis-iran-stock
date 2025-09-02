"""
Composite Chart Service - سرویس نمودارهای ترکیبی
مدیریت نمودارهای پیچیده با چندین سمبل و عبارات ریاضی
"""

from typing import Dict, List, Any, Optional, Tuple, Union
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
import json
import logging

from .data_alignment_service import DataAlignmentService
from .expression_engine import ExpressionEngine, ExpressionVariable, ExpressionResult
from ..domain.models import OHLCVData
from ..core.events import EventBus, Event


class ChartType(Enum):
    """انواع نمودار"""
    LINE = "line"
    AREA = "area"
    HISTOGRAM = "histogram"
    OSCILLATOR = "oscillator"


class DisplayLocation(Enum):
    """محل نمایش نمودار"""
    MAIN_PANEL = "main"      # روی نمودار اصلی
    SUB_PANEL = "sub"        # پنل جداگانه زیر نمودار
    OVERLAY = "overlay"      # روی نمودار اصلی (شفاف)


@dataclass
class ChartStyle:
    """تنظیمات ظاهری نمودار"""
    color: str = "#2196F3"
    line_width: int = 2
    line_style: str = "solid"  # solid, dashed, dotted
    fill_opacity: float = 0.3
    show_markers: bool = False
    marker_size: int = 4


@dataclass
class CompositeChart:
    """تعریف نمودار ترکیبی"""
    id: str
    name: str
    expression: str
    variables: Dict[str, ExpressionVariable]
    chart_type: ChartType
    display_location: DisplayLocation
    style: ChartStyle
    enabled: bool = True
    auto_update: bool = True
    created_at: datetime = field(default_factory=datetime.now)
    last_updated: Optional[datetime] = None
    
    # داده‌های محاسبه شده
    calculated_data: Optional[ExpressionResult] = None
    statistics: Dict[str, float] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """تبدیل به دیکشنری"""
        return {
            'id': self.id,
            'name': self.name,
            'expression': self.expression,
            'variables': {
                name: {
                    'name': var.name,
                    'symbol': var.symbol,
                    'price_type': var.price_type,
                    'description': var.description
                }
                for name, var in self.variables.items()
            },
            'chart_type': self.chart_type.value,
            'display_location': self.display_location.value,
            'style': {
                'color': self.style.color,
                'line_width': self.style.line_width,
                'line_style': self.style.line_style,
                'fill_opacity': self.style.fill_opacity,
                'show_markers': self.style.show_markers,
                'marker_size': self.style.marker_size
            },
            'enabled': self.enabled,
            'auto_update': self.auto_update,
            'created_at': self.created_at.isoformat(),
            'last_updated': self.last_updated.isoformat() if self.last_updated else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CompositeChart':
        """ایجاد از دیکشنری"""
        variables = {}
        for name, var_data in data.get('variables', {}).items():
            variables[name] = ExpressionVariable(
                name=var_data['name'],
                symbol=var_data['symbol'],
                price_type=var_data.get('price_type', 'close'),
                description=var_data.get('description', '')
            )
        
        style_data = data.get('style', {})
        style = ChartStyle(
            color=style_data.get('color', '#2196F3'),
            line_width=style_data.get('line_width', 2),
            line_style=style_data.get('line_style', 'solid'),
            fill_opacity=style_data.get('fill_opacity', 0.3),
            show_markers=style_data.get('show_markers', False),
            marker_size=style_data.get('marker_size', 4)
        )
        
        return cls(
            id=data['id'],
            name=data['name'],
            expression=data['expression'],
            variables=variables,
            chart_type=ChartType(data.get('chart_type', 'line')),
            display_location=DisplayLocation(data.get('display_location', 'sub')),
            style=style,
            enabled=data.get('enabled', True),
            auto_update=data.get('auto_update', True),
            created_at=datetime.fromisoformat(data['created_at']) if 'created_at' in data else datetime.now(),
            last_updated=datetime.fromisoformat(data['last_updated']) if data.get('last_updated') else None
        )


class CompositeChartService:
    """سرویس مدیریت نمودارهای ترکیبی"""
    
    def __init__(self, data_alignment_service: DataAlignmentService, event_bus: EventBus):
        self.data_service = data_alignment_service
        self.expression_engine = ExpressionEngine(data_alignment_service)
        self.event_bus = event_bus
        self.logger = logging.getLogger(__name__)
        
        # نمودارهای فعال
        self.active_charts: Dict[str, CompositeChart] = {}
        
        # تنظیمات
        self.default_date_range = timedelta(days=365)
        self.max_charts = 20
        
        # کش محاسبات
        self._chart_cache: Dict[str, Dict[str, Any]] = {}
        
        # اشتراک در رویدادها
        self.event_bus.subscribe("new_market_data", self._handle_data_update)
        self.event_bus.subscribe("chart_settings_changed", self._handle_settings_change)
    
    def create_chart(self, name: str, expression: str, 
                    variables: Dict[str, ExpressionVariable],
                    chart_type: ChartType = ChartType.LINE,
                    display_location: DisplayLocation = DisplayLocation.SUB_PANEL,
                    style: Optional[ChartStyle] = None) -> str:
        """ایجاد نمودار ترکیبی جدید"""
        
        if len(self.active_charts) >= self.max_charts:
            raise ValueError(f"Maximum number of charts ({self.max_charts}) reached")
        
        # اعتبارسنجی عبارت
        validation = self.expression_engine.validate_expression(expression, variables)
        if not validation['valid']:
            raise ValueError(f"Invalid expression: {validation['error']}")
        
        # ایجاد ID یکتا
        chart_id = f"chart_{len(self.active_charts)}_{int(datetime.now().timestamp())}"
        
        # تنظیمات پیش‌فرض
        if style is None:
            style = ChartStyle()
        
        # ایجاد نمودار
        chart = CompositeChart(
            id=chart_id,
            name=name,
            expression=expression,
            variables=variables,
            chart_type=chart_type,
            display_location=display_location,
            style=style
        )
        
        self.active_charts[chart_id] = chart
        
        # محاسبه اولیه
        self._calculate_chart(chart_id)
        
        # ارسال رویداد
        self.event_bus.emit(Event("composite_chart_created", {
            'chart_id': chart_id,
            'name': name,
            'expression': expression
        }))
        
        self.logger.info(f"Created composite chart: {name} ({chart_id})")
        return chart_id
    
    def update_chart(self, chart_id: str, **updates) -> bool:
        """بروزرسانی نمودار"""
        if chart_id not in self.active_charts:
            return False
        
        chart = self.active_charts[chart_id]
        updated = False
        
        # بروزرسانی فیلدها
        if 'name' in updates:
            chart.name = updates['name']
            updated = True
        
        if 'expression' in updates:
            # اعتبارسنجی عبارت جدید
            validation = self.expression_engine.validate_expression(
                updates['expression'], chart.variables
            )
            if validation['valid']:
                chart.expression = updates['expression']
                updated = True
            else:
                raise ValueError(f"Invalid expression: {validation['error']}")
        
        if 'variables' in updates:
            chart.variables = updates['variables']
            updated = True
        
        if 'style' in updates:
            chart.style = updates['style']
            updated = True
        
        if 'enabled' in updates:
            chart.enabled = updates['enabled']
            updated = True
        
        if updated:
            chart.last_updated = datetime.now()
            # پاک کردن کش
            self._clear_chart_cache(chart_id)
            # محاسبه مجدد
            if chart.enabled:
                self._calculate_chart(chart_id)
            
            # ارسال رویداد
            self.event_bus.emit(Event("composite_chart_updated", {
                'chart_id': chart_id,
                'updates': list(updates.keys())
            }))
        
        return updated
    
    def delete_chart(self, chart_id: str) -> bool:
        """حذف نمودار"""
        if chart_id not in self.active_charts:
            return False
        
        chart_name = self.active_charts[chart_id].name
        del self.active_charts[chart_id]
        
        # پاک کردن کش
        self._clear_chart_cache(chart_id)
        
        # ارسال رویداد
        self.event_bus.emit(Event("composite_chart_deleted", {
            'chart_id': chart_id,
            'name': chart_name
        }))
        
        self.logger.info(f"Deleted composite chart: {chart_name} ({chart_id})")
        return True
    
    def get_chart(self, chart_id: str) -> Optional[CompositeChart]:
        """دریافت نمودار"""
        return self.active_charts.get(chart_id)
    
    def get_all_charts(self) -> List[CompositeChart]:
        """دریافت همه نمودارها"""
        return list(self.active_charts.values())
    
    def get_chart_data(self, chart_id: str, start_date: Optional[datetime] = None,
                      end_date: Optional[datetime] = None) -> Optional[Dict[str, Any]]:
        """دریافت داده‌های نمودار"""
        
        if chart_id not in self.active_charts:
            return None
        
        chart = self.active_charts[chart_id]
        
        if not chart.enabled:
            return None
        
        # تنظیم بازه زمانی پیش‌فرض
        if end_date is None:
            end_date = datetime.now()
        if start_date is None:
            start_date = end_date - self.default_date_range
        
        # بررسی کش
        cache_key = f"{chart_id}_{start_date}_{end_date}"
        if cache_key in self._chart_cache:
            cached_data = self._chart_cache[cache_key]
            if (datetime.now() - cached_data['timestamp']).seconds < 300:  # 5 دقیقه
                return cached_data['data']
        
        try:
            # محاسبه عبارت
            result = self.expression_engine.evaluate_expression(
                chart.expression, chart.variables, start_date, end_date
            )
            
            if not result.success:
                self.logger.error(f"Failed to calculate chart {chart_id}: {result.error}")
                return None
            
            # آماده‌سازی داده‌های نمودار
            chart_data = {
                'id': chart_id,
                'name': chart.name,
                'expression': chart.expression,
                'chart_type': chart.chart_type.value,
                'display_location': chart.display_location.value,
                'style': chart.style.__dict__,
                'data_points': [
                    {
                        'timestamp': ts.isoformat(),
                        'value': val if not np.isnan(val) else None,
                        'formatted_time': ts.strftime('%Y-%m-%d %H:%M'),
                        'day_of_week': ts.weekday()
                    }
                    for ts, val in zip(result.timestamps, result.values)
                    if not np.isnan(val)  # فیلتر کردن مقادیر نامعتبر
                ],
                'statistics': self._calculate_statistics(result.values),
                'metadata': {
                    'total_points': len(result.timestamps),
                    'valid_points': len([v for v in result.values if not np.isnan(v)]),
                    'variables_used': result.variables_used,
                    'date_range': {
                        'start': start_date.isoformat(),
                        'end': end_date.isoformat()
                    }
                }
            }
            
            # بروزرسانی نمودار
            chart.calculated_data = result
            chart.statistics = chart_data['statistics']
            chart.last_updated = datetime.now()
            
            # کش کردن
            self._chart_cache[cache_key] = {
                'data': chart_data,
                'timestamp': datetime.now()
            }
            
            return chart_data
            
        except Exception as e:
            self.logger.error(f"Error getting chart data for {chart_id}: {e}")
            return None
    
    def _calculate_chart(self, chart_id: str):
        """محاسبه داده‌های نمودار"""
        if chart_id not in self.active_charts:
            return
        
        chart = self.active_charts[chart_id]
        
        if not chart.enabled or not chart.auto_update:
            return
        
        # محاسبه با بازه زمانی پیش‌فرض
        end_date = datetime.now()
        start_date = end_date - self.default_date_range
        
        self.get_chart_data(chart_id, start_date, end_date)
    
    def _calculate_statistics(self, values: List[float]) -> Dict[str, float]:
        """محاسبه آمار نمودار"""
        clean_values = [v for v in values if not np.isnan(v) and v is not None]
        
        if not clean_values:
            return {}
        
        return {
            'count': len(clean_values),
            'min': float(min(clean_values)),
            'max': float(max(clean_values)),
            'mean': float(np.mean(clean_values)),
            'median': float(np.median(clean_values)),
            'std': float(np.std(clean_values)),
            'variance': float(np.var(clean_values)),
            'first_value': float(clean_values[0]),
            'last_value': float(clean_values[-1]),
            'total_change': float(clean_values[-1] - clean_values[0]),
            'percent_change': float(((clean_values[-1] - clean_values[0]) / clean_values[0]) * 100) if clean_values[0] != 0 else 0,
            'positive_count': len([v for v in clean_values if v > 0]),
            'negative_count': len([v for v in clean_values if v < 0]),
            'zero_count': len([v for v in clean_values if v == 0])
        }
    
    def create_predefined_charts(self) -> List[str]:
        """ایجاد نمودارهای از پیش تعریف شده"""
        predefined_charts = []
        
        try:
            # نمودار نسبت دلار به طلا
            dollar_gold_vars = {
                'USD': ExpressionVariable('USD', 'USD/IRR', 'close', 'US Dollar'),
                'GOLD': ExpressionVariable('GOLD', 'GOLD/IRR', 'close', 'Gold Price')
            }
            
            chart_id = self.create_chart(
                name="Dollar/Gold Ratio",
                expression="USD / GOLD",
                variables=dollar_gold_vars,
                chart_type=ChartType.LINE,
                display_location=DisplayLocation.SUB_PANEL,
                style=ChartStyle(color="#FF9800", line_width=2)
            )
            predefined_charts.append(chart_id)
            
            # نمودار قدرت نسبی سهم
            if True:  # اگر سهام در دسترس باشد
                stock_market_vars = {
                    'STOCK': ExpressionVariable('STOCK', 'STOCK_SYMBOL', 'close', 'Stock Price'),
                    'MARKET': ExpressionVariable('MARKET', 'MARKET_INDEX', 'close', 'Market Index')
                }
                
                chart_id = self.create_chart(
                    name="Relative Strength",
                    expression="(STOCK / MARKET) * 100",
                    variables=stock_market_vars,
                    chart_type=ChartType.LINE,
                    display_location=DisplayLocation.SUB_PANEL,
                    style=ChartStyle(color="#4CAF50", line_width=2)
                )
                predefined_charts.append(chart_id)
            
        except Exception as e:
            self.logger.error(f"Error creating predefined charts: {e}")
        
        return predefined_charts
    
    def export_chart_config(self, chart_id: str) -> Optional[str]:
        """صادرات تنظیمات نمودار"""
        if chart_id not in self.active_charts:
            return None
        
        chart = self.active_charts[chart_id]
        config = chart.to_dict()
        
        return json.dumps(config, indent=2, ensure_ascii=False)
    
    def import_chart_config(self, config_json: str) -> Optional[str]:
        """واردات تنظیمات نمودار"""
        try:
            config = json.loads(config_json)
            chart = CompositeChart.from_dict(config)
            
            # ایجاد ID جدید برای جلوگیری از تداخل
            new_id = f"imported_{int(datetime.now().timestamp())}"
            chart.id = new_id
            
            self.active_charts[new_id] = chart
            
            # محاسبه اولیه
            self._calculate_chart(new_id)
            
            return new_id
            
        except Exception as e:
            self.logger.error(f"Error importing chart config: {e}")
            return None
    
    def _handle_data_update(self, event: Event):
        """مدیریت بروزرسانی داده‌ها"""
        # بروزرسانی نمودارهای فعال
        for chart_id, chart in self.active_charts.items():
            if chart.enabled and chart.auto_update:
                # پاک کردن کش
                self._clear_chart_cache(chart_id)
                # محاسبه مجدد
                self._calculate_chart(chart_id)
    
    def _handle_settings_change(self, event: Event):
        """مدیریت تغییر تنظیمات"""
        chart_id = event.data.get('chart_id')
        if chart_id and chart_id in self.active_charts:
            settings = event.data.get('settings', {})
            self.update_chart(chart_id, **settings)
    
    def _clear_chart_cache(self, chart_id: str):
        """پاک کردن کش نمودار"""
        keys_to_remove = [key for key in self._chart_cache.keys() if key.startswith(chart_id)]
        for key in keys_to_remove:
            del self._chart_cache[key]
    
    def clear_all_cache(self):
        """پاک کردن همه کش"""
        self._chart_cache.clear()
        self.expression_engine.clear_cache()
        self.logger.info("Composite chart cache cleared")
    
    def get_service_status(self) -> Dict[str, Any]:
        """وضعیت سرویس"""
        return {
            'active_charts': len(self.active_charts),
            'max_charts': self.max_charts,
            'cache_size': len(self._chart_cache),
            'enabled_charts': len([c for c in self.active_charts.values() if c.enabled]),
            'auto_update_charts': len([c for c in self.active_charts.values() if c.auto_update])
        }