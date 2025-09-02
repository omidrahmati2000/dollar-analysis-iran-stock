"""
Expression Engine - موتور محاسبه عبارات ریاضی پیشرفته
برای ایجاد نمودارهای ترکیبی و اسیلاتورهای سفارشی مثل TradingView
"""

from typing import Dict, List, Any, Optional, Union, Set, Callable
from dataclasses import dataclass
from enum import Enum
import pandas as pd
import numpy as np
import re
import ast
import operator
import math
from datetime import datetime
import logging

from .data_alignment_service import DataAlignmentService, AlignedDataPoint


class ExpressionType(Enum):
    """نوع عبارت"""
    SIMPLE = "simple"           # A/B
    COMPLEX = "complex"         # (A*B + C)/D^2
    FUNCTION = "function"       # SMA(A, 20)
    CONDITIONAL = "conditional" # IF(A>B, A, B)


@dataclass
class ExpressionVariable:
    """متغیر در عبارت ریاضی"""
    name: str              # نام متغیر (مثل A, B, AAPL)
    symbol: str            # نماد (مثل AAPL, USD/IRR)
    price_type: str = 'close'  # نوع قیمت (close, open, high, low)
    description: str = ""
    
    def __str__(self):
        return f"{self.name}({self.symbol}.{self.price_type})"


@dataclass
class ExpressionResult:
    """نتیجه محاسبه عبارت"""
    values: List[float]
    timestamps: List[datetime]
    expression: str
    variables_used: List[str]
    metadata: Dict[str, Any]
    success: bool = True
    error: Optional[str] = None


class MathFunctions:
    """توابع ریاضی قابل استفاده در عبارات"""
    
    @staticmethod
    def sma(values: List[float], period: int) -> List[float]:
        """Simple Moving Average"""
        if len(values) < period:
            return [np.nan] * len(values)
        
        result = []
        for i in range(len(values)):
            if i < period - 1:
                result.append(np.nan)
            else:
                avg = np.mean(values[i-period+1:i+1])
                result.append(avg)
        return result
    
    @staticmethod
    def ema(values: List[float], period: int) -> List[float]:
        """Exponential Moving Average"""
        if not values:
            return []
        
        alpha = 2.0 / (period + 1)
        result = [values[0]]
        
        for i in range(1, len(values)):
            ema_val = alpha * values[i] + (1 - alpha) * result[-1]
            result.append(ema_val)
        
        return result
    
    @staticmethod
    def max_val(values: List[float], period: int) -> List[float]:
        """Maximum value over period"""
        result = []
        for i in range(len(values)):
            if i < period - 1:
                result.append(np.nan)
            else:
                max_val = max(values[i-period+1:i+1])
                result.append(max_val)
        return result
    
    @staticmethod
    def min_val(values: List[float], period: int) -> List[float]:
        """Minimum value over period"""
        result = []
        for i in range(len(values)):
            if i < period - 1:
                result.append(np.nan)
            else:
                min_val = min(values[i-period+1:i+1])
                result.append(min_val)
        return result
    
    @staticmethod
    def stdev(values: List[float], period: int) -> List[float]:
        """Standard deviation over period"""
        result = []
        for i in range(len(values)):
            if i < period - 1:
                result.append(np.nan)
            else:
                std_val = np.std(values[i-period+1:i+1])
                result.append(std_val)
        return result
    
    @staticmethod
    def log(values: List[float]) -> List[float]:
        """Natural logarithm"""
        return [math.log(v) if v > 0 else np.nan for v in values]
    
    @staticmethod
    def abs_val(values: List[float]) -> List[float]:
        """Absolute value"""
        return [abs(v) for v in values]
    
    @staticmethod
    def pow_val(values: List[float], power: float) -> List[float]:
        """Power function"""
        return [v ** power if not np.isnan(v) else np.nan for v in values]
    
    @staticmethod
    def sqrt_val(values: List[float]) -> List[float]:
        """Square root"""
        return [math.sqrt(v) if v >= 0 else np.nan for v in values]


class ExpressionParser:
    """پارسر عبارات ریاضی"""
    
    def __init__(self):
        # عملگرهای مجاز
        self.operators = {
            ast.Add: operator.add,
            ast.Sub: operator.sub,
            ast.Mult: operator.mul,
            ast.Div: operator.truediv,
            ast.Pow: operator.pow,
            ast.Mod: operator.mod,
        }
        
        # توابع مجاز
        self.functions = {
            'SMA': MathFunctions.sma,
            'EMA': MathFunctions.ema,
            'MAX': MathFunctions.max_val,
            'MIN': MathFunctions.min_val,
            'STDEV': MathFunctions.stdev,
            'LOG': MathFunctions.log,
            'ABS': MathFunctions.abs_val,
            'POW': MathFunctions.pow_val,
            'SQRT': MathFunctions.sqrt_val,
            'SIN': lambda x: [math.sin(v) for v in x],
            'COS': lambda x: [math.cos(v) for v in x],
            'TAN': lambda x: [math.tan(v) for v in x],
        }
        
        self.logger = logging.getLogger(__name__)
    
    def parse_expression(self, expression: str) -> Dict[str, Any]:
        """پارس کردن عبارت ریاضی"""
        try:
            # پاک کردن فضاهای اضافی
            expression = expression.strip()
            
            # یافتن متغیرها
            variables = self._extract_variables(expression)
            
            # یافتن توابع
            functions = self._extract_functions(expression)
            
            # بررسی syntax
            self._validate_syntax(expression)
            
            return {
                'expression': expression,
                'variables': variables,
                'functions': functions,
                'type': self._determine_expression_type(expression),
                'valid': True,
                'error': None
            }
            
        except Exception as e:
            self.logger.error(f"Error parsing expression '{expression}': {e}")
            return {
                'expression': expression,
                'variables': [],
                'functions': [],
                'type': ExpressionType.SIMPLE,
                'valid': False,
                'error': str(e)
            }
    
    def _extract_variables(self, expression: str) -> List[str]:
        """استخراج متغیرها از عبارت"""
        # الگوی متغیرها: حروف بزرگ یا کوچک، اعداد، و نقطه و خط تیره
        variable_pattern = r'\b[A-Za-z][A-Za-z0-9._/-]*\b'
        
        variables = set()
        matches = re.findall(variable_pattern, expression)
        
        for match in matches:
            # حذف کلمات کلیدی و توابع
            if (match.upper() not in self.functions and 
                match.upper() not in ['IF', 'THEN', 'ELSE', 'AND', 'OR', 'NOT']):
                variables.add(match)
        
        return list(variables)
    
    def _extract_functions(self, expression: str) -> List[str]:
        """استخراج توابع از عبارت"""
        function_pattern = r'\b([A-Z]+)\s*\('
        functions = set()
        
        matches = re.findall(function_pattern, expression)
        for match in matches:
            if match in self.functions:
                functions.add(match)
        
        return list(functions)
    
    def _validate_syntax(self, expression: str) -> bool:
        """اعتبارسنجی syntax عبارت"""
        try:
            # جایگزینی متغیرها با مقادیر نمونه برای بررسی syntax
            temp_expression = expression
            variables = self._extract_variables(expression)
            
            for var in variables:
                temp_expression = temp_expression.replace(var, '1.0')
            
            # جایگزینی توابع با مقادیر نمونه
            functions = self._extract_functions(expression)
            for func in functions:
                pattern = rf'\b{func}\s*\([^)]+\)'
                temp_expression = re.sub(pattern, '1.0', temp_expression)
            
            # تلاش برای compile کردن
            ast.parse(temp_expression, mode='eval')
            return True
            
        except Exception as e:
            raise ValueError(f"Invalid syntax: {e}")
    
    def _determine_expression_type(self, expression: str) -> ExpressionType:
        """تعیین نوع عبارت"""
        if 'IF' in expression.upper():
            return ExpressionType.CONDITIONAL
        elif any(func in expression.upper() for func in self.functions.keys()):
            return ExpressionType.FUNCTION
        elif len(self._extract_variables(expression)) > 2:
            return ExpressionType.COMPLEX
        else:
            return ExpressionType.SIMPLE


class ExpressionEngine:
    """موتور اصلی محاسبه عبارات ریاضی"""
    
    def __init__(self, data_alignment_service: DataAlignmentService):
        self.data_service = data_alignment_service
        self.parser = ExpressionParser()
        self.math_functions = MathFunctions()
        self.logger = logging.getLogger(__name__)
        
        # کش محاسبات
        self._calculation_cache: Dict[str, ExpressionResult] = {}
    
    def evaluate_expression(self, expression: str, variables: Dict[str, ExpressionVariable],
                           start_date: datetime, end_date: datetime,
                           market: str = 'GLOBAL') -> ExpressionResult:
        """محاسبه عبارت ریاضی"""
        
        # بررسی کش
        cache_key = f"{expression}_{start_date}_{end_date}_{hash(str(variables))}"
        if cache_key in self._calculation_cache:
            return self._calculation_cache[cache_key]
        
        try:
            # پارس کردن عبارت
            parsed = self.parser.parse_expression(expression)
            
            if not parsed['valid']:
                return ExpressionResult(
                    values=[], timestamps=[], expression=expression,
                    variables_used=[], metadata={}, success=False,
                    error=parsed['error']
                )
            
            # دریافت داده‌های متغیرها
            symbols_needed = list(set(var.symbol for var in variables.values()))
            aligned_data = self.data_service.align_multiple_symbols(
                symbols_needed, start_date, end_date, 'forward_fill', market
            )
            
            if not aligned_data:
                return ExpressionResult(
                    values=[], timestamps=[], expression=expression,
                    variables_used=list(variables.keys()), metadata={},
                    success=False, error="No aligned data available"
                )
            
            # محاسبه مقادیر
            result_values = self._calculate_expression_values(
                expression, variables, aligned_data
            )
            
            timestamps = [point.timestamp for point in aligned_data]
            
            result = ExpressionResult(
                values=result_values,
                timestamps=timestamps,
                expression=expression,
                variables_used=list(variables.keys()),
                metadata={
                    'symbols': symbols_needed,
                    'data_points': len(aligned_data),
                    'expression_type': parsed['type'].value,
                    'functions_used': parsed['functions']
                },
                success=True
            )
            
            # کش کردن نتیجه
            self._calculation_cache[cache_key] = result
            return result
            
        except Exception as e:
            self.logger.error(f"Error evaluating expression '{expression}': {e}")
            return ExpressionResult(
                values=[], timestamps=[], expression=expression,
                variables_used=list(variables.keys()), metadata={},
                success=False, error=str(e)
            )
    
    def _calculate_expression_values(self, expression: str, 
                                   variables: Dict[str, ExpressionVariable],
                                   aligned_data: List[AlignedDataPoint]) -> List[float]:
        """محاسبه مقادیر عبارت"""
        
        # آماده‌سازی داده‌های متغیرها
        variable_data = {}
        for var_name, var_config in variables.items():
            values = []
            for point in aligned_data:
                value = point.get_symbol_price(var_config.symbol, var_config.price_type)
                values.append(value if value is not None else np.nan)
            variable_data[var_name] = values
        
        # جایگزینی توابع در عبارت
        processed_expression = self._process_functions(expression, variable_data)
        
        # محاسبه نقطه به نقطه
        results = []
        for i in range(len(aligned_data)):
            try:
                # جایگزینی متغیرها با مقادیر
                point_expression = processed_expression
                for var_name, values in variable_data.items():
                    value = values[i] if not np.isnan(values[i]) else 0
                    point_expression = point_expression.replace(var_name, str(value))
                
                # محاسبه
                if point_expression and point_expression != processed_expression:
                    result = eval(point_expression)
                    results.append(float(result) if not np.isnan(result) else np.nan)
                else:
                    results.append(np.nan)
                    
            except Exception as e:
                self.logger.warning(f"Error calculating point {i}: {e}")
                results.append(np.nan)
        
        return results
    
    def _process_functions(self, expression: str, variable_data: Dict[str, List[float]]) -> str:
        """پردازش توابع در عبارت"""
        processed = expression
        
        # پیدا کردن و جایگزینی توابع
        function_pattern = r'([A-Z]+)\s*\(([^)]+)\)'
        
        def replace_function(match):
            func_name = match.group(1)
            func_args = match.group(2).strip()
            
            if func_name in self.parser.functions:
                # پارس کردن آرگومان‌ها
                args = [arg.strip() for arg in func_args.split(',')]
                
                # اولین آرگومان باید متغیر باشد
                if args[0] in variable_data:
                    values = variable_data[args[0]]
                    
                    # آرگومان‌های اضافی (مثل period)
                    extra_args = []
                    for arg in args[1:]:
                        try:
                            extra_args.append(int(arg))
                        except ValueError:
                            try:
                                extra_args.append(float(arg))
                            except ValueError:
                                extra_args.append(arg)
                    
                    # محاسبه تابع
                    try:
                        func = self.parser.functions[func_name]
                        if extra_args:
                            result_values = func(values, *extra_args)
                        else:
                            result_values = func(values)
                        
                        # ایجاد متغیر جدید برای نتیجه تابع
                        result_var = f"__{func_name}_RESULT__"
                        variable_data[result_var] = result_values
                        
                        return result_var
                        
                    except Exception as e:
                        self.logger.error(f"Error processing function {func_name}: {e}")
                        return "0"
            
            return match.group(0)  # بدون تغییر برگردان
        
        processed = re.sub(function_pattern, replace_function, processed)
        return processed
    
    def create_composite_chart(self, expression: str, variables: Dict[str, ExpressionVariable],
                              start_date: datetime, end_date: datetime,
                              chart_name: str = "Composite Chart") -> Dict[str, Any]:
        """ایجاد نمودار ترکیبی"""
        
        result = self.evaluate_expression(expression, variables, start_date, end_date)
        
        if not result.success:
            return {
                'success': False,
                'error': result.error,
                'chart_data': None
            }
        
        # آماده‌سازی داده‌های نمودار
        chart_data = {
            'name': chart_name,
            'expression': expression,
            'data': [
                {
                    'timestamp': ts.isoformat(),
                    'value': val if not np.isnan(val) else None
                }
                for ts, val in zip(result.timestamps, result.values)
            ],
            'variables': {
                name: {
                    'symbol': var.symbol,
                    'price_type': var.price_type,
                    'description': var.description
                }
                for name, var in variables.items()
            },
            'metadata': result.metadata,
            'chart_type': 'line',  # نمودارهای ترکیبی همیشه خطی هستند
            'color': '#2196F3'
        }
        
        return {
            'success': True,
            'error': None,
            'chart_data': chart_data,
            'statistics': self._calculate_chart_statistics(result.values)
        }
    
    def _calculate_chart_statistics(self, values: List[float]) -> Dict[str, float]:
        """محاسبه آمار نمودار"""
        clean_values = [v for v in values if not np.isnan(v)]
        
        if not clean_values:
            return {}
        
        return {
            'min': min(clean_values),
            'max': max(clean_values), 
            'mean': np.mean(clean_values),
            'median': np.median(clean_values),
            'std': np.std(clean_values),
            'first': clean_values[0],
            'last': clean_values[-1],
            'change': clean_values[-1] - clean_values[0],
            'change_percent': ((clean_values[-1] - clean_values[0]) / clean_values[0]) * 100 if clean_values[0] != 0 else 0
        }
    
    def get_expression_suggestions(self, partial_expression: str) -> List[Dict[str, str]]:
        """پیشنهادات برای تکمیل عبارت"""
        suggestions = []
        
        # پیشنهاد توابع
        for func_name in self.parser.functions.keys():
            if func_name.startswith(partial_expression.upper()):
                suggestions.append({
                    'type': 'function',
                    'text': func_name,
                    'description': f'{func_name} function'
                })
        
        # پیشنهاد عملگرها
        operators = ['+', '-', '*', '/', '^', '(', ')']
        for op in operators:
            if partial_expression.endswith(' '):
                suggestions.append({
                    'type': 'operator',
                    'text': op,
                    'description': f'Operator {op}'
                })
        
        return suggestions
    
    def validate_expression(self, expression: str, variables: Dict[str, ExpressionVariable]) -> Dict[str, Any]:
        """اعتبارسنجی عبارت"""
        try:
            parsed = self.parser.parse_expression(expression)
            
            if not parsed['valid']:
                return {
                    'valid': False,
                    'error': parsed['error'],
                    'missing_variables': []
                }
            
            # بررسی وجود متغیرها
            missing_vars = []
            for var in parsed['variables']:
                if var not in variables:
                    missing_vars.append(var)
            
            return {
                'valid': len(missing_vars) == 0,
                'error': f"Missing variables: {', '.join(missing_vars)}" if missing_vars else None,
                'missing_variables': missing_vars,
                'expression_type': parsed['type'].value,
                'functions_used': parsed['functions']
            }
            
        except Exception as e:
            return {
                'valid': False,
                'error': str(e),
                'missing_variables': []
            }
    
    def clear_cache(self):
        """پاک کردن کش محاسبات"""
        self._calculation_cache.clear()
        self.logger.info("Expression engine cache cleared")