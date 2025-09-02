"""
Custom Indicator Builder - TradingView-like custom indicator creation
Allows users to create custom indicators using simple mathematical operations
"""

from typing import List, Dict, Any, Optional, Callable, Union
from dataclasses import dataclass
from enum import Enum
import pandas as pd
import numpy as np
from abc import ABC, abstractmethod

from .base import BaseIndicator
from ..domain.models import OHLCVData


class OperationType(Enum):
    """Mathematical operation types"""
    ADD = "+"
    SUBTRACT = "-"
    MULTIPLY = "*"
    DIVIDE = "/"
    POWER = "**"
    MAX = "max"
    MIN = "min"
    ABS = "abs"
    SMA = "sma"
    EMA = "ema"
    HIGHEST = "highest"
    LOWEST = "lowest"
    CHANGE = "change"
    PERCENT_CHANGE = "pct_change"


class SourceType(Enum):
    """Data source types"""
    OPEN = "open"
    HIGH = "high"
    LOW = "low"
    CLOSE = "close"
    VOLUME = "volume"
    HL2 = "hl2"
    HLC3 = "hlc3"
    OHLC4 = "ohlc4"
    CUSTOM = "custom"


@dataclass
class IndicatorOperation:
    """Single operation in custom indicator"""
    operation: OperationType
    source: Union[SourceType, str, float]
    parameters: Dict[str, Any]
    output_name: str


@dataclass
class CustomIndicatorTemplate:
    """Template for creating custom indicators"""
    name: str
    description: str
    operations: List[IndicatorOperation]
    plot_settings: Dict[str, Any]
    parameters: Dict[str, Any]


class CustomIndicatorBuilder:
    """Builder for creating custom indicators"""
    
    def __init__(self):
        self.operations: List[IndicatorOperation] = []
        self.variables: Dict[str, Any] = {}
        self.name = "Custom Indicator"
        self.description = ""
        self.plot_settings = {}
        
    def reset(self):
        """Reset builder to start fresh"""
        self.operations.clear()
        self.variables.clear()
        self.name = "Custom Indicator"
        self.description = ""
        self.plot_settings = {}
        return self
    
    def set_name(self, name: str):
        """Set indicator name"""
        self.name = name
        return self
    
    def set_description(self, description: str):
        """Set indicator description"""
        self.description = description
        return self
    
    def add_variable(self, name: str, value: Any):
        """Add a variable/parameter"""
        self.variables[name] = value
        return self
    
    def add_source(self, name: str, source: SourceType):
        """Add a data source"""
        self.operations.append(IndicatorOperation(
            operation=OperationType.ADD,  # Placeholder
            source=source,
            parameters={},
            output_name=name
        ))
        return self
    
    def add_sma(self, source: str, period: int, output_name: str):
        """Add Simple Moving Average operation"""
        self.operations.append(IndicatorOperation(
            operation=OperationType.SMA,
            source=source,
            parameters={"period": period},
            output_name=output_name
        ))
        return self
    
    def add_ema(self, source: str, period: int, output_name: str):
        """Add Exponential Moving Average operation"""
        self.operations.append(IndicatorOperation(
            operation=OperationType.EMA,
            source=source,
            parameters={"period": period},
            output_name=output_name
        ))
        return self
    
    def add_arithmetic(self, operation: OperationType, source1: str, 
                      source2: Union[str, float], output_name: str):
        """Add arithmetic operation"""
        self.operations.append(IndicatorOperation(
            operation=operation,
            source=source1,
            parameters={"operand": source2},
            output_name=output_name
        ))
        return self
    
    def add_highest(self, source: str, period: int, output_name: str):
        """Add highest value over period"""
        self.operations.append(IndicatorOperation(
            operation=OperationType.HIGHEST,
            source=source,
            parameters={"period": period},
            output_name=output_name
        ))
        return self
    
    def add_lowest(self, source: str, period: int, output_name: str):
        """Add lowest value over period"""
        self.operations.append(IndicatorOperation(
            operation=OperationType.LOWEST,
            source=source,
            parameters={"period": period},
            output_name=output_name
        ))
        return self
    
    def add_change(self, source: str, periods: int, output_name: str):
        """Add change over periods"""
        self.operations.append(IndicatorOperation(
            operation=OperationType.CHANGE,
            source=source,
            parameters={"periods": periods},
            output_name=output_name
        ))
        return self
    
    def add_percent_change(self, source: str, periods: int, output_name: str):
        """Add percentage change over periods"""
        self.operations.append(IndicatorOperation(
            operation=OperationType.PERCENT_CHANGE,
            source=source,
            parameters={"periods": periods},
            output_name=output_name
        ))
        return self
    
    def set_plot_settings(self, **settings):
        """Set plot settings"""
        self.plot_settings.update(settings)
        return self
    
    def build(self) -> 'CustomIndicator':
        """Build the custom indicator"""
        template = CustomIndicatorTemplate(
            name=self.name,
            description=self.description,
            operations=self.operations.copy(),
            plot_settings=self.plot_settings.copy(),
            parameters=self.variables.copy()
        )
        
        return CustomIndicator(template)


class CustomIndicator(BaseIndicator):
    """Custom indicator created from template"""
    
    def __init__(self, template: CustomIndicatorTemplate):
        super().__init__()
        self.template = template
        self.name = template.name
        self.description = template.description
        self.category = "Custom"
        
        # Store computed values
        self.computed_values = {}
        self.results = {}
    
    def calculate(self, data: List[OHLCVData]) -> Dict[str, Any]:
        """Calculate custom indicator"""
        df = self._to_dataframe(data)
        if len(df) < 1:
            return self._empty_result()
        
        # Initialize data sources
        sources = self._initialize_sources(df)
        
        # Execute operations in sequence
        for operation in self.template.operations:
            self._execute_operation(operation, sources, df)
        
        # Prepare final results
        self.results = {}
        for name, values in sources.items():
            if not name.startswith('_'):  # Skip internal variables
                self.results[name] = values
        
        return self.results
    
    def _initialize_sources(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Initialize basic data sources"""
        sources = {
            'open': df['open'].values,
            'high': df['high'].values,
            'low': df['low'].values,
            'close': df['close'].values,
            'volume': df['volume'].values,
            'hl2': ((df['high'] + df['low']) / 2).values,
            'hlc3': ((df['high'] + df['low'] + df['close']) / 3).values,
            'ohlc4': ((df['open'] + df['high'] + df['low'] + df['close']) / 4).values
        }
        
        # Add template parameters as constants
        for name, value in self.template.parameters.items():
            sources[name] = value
        
        return sources
    
    def _execute_operation(self, operation: IndicatorOperation, 
                          sources: Dict[str, Any], df: pd.DataFrame):
        """Execute a single operation"""
        try:
            if operation.operation == OperationType.SMA:
                result = self._calculate_sma(sources, operation)
            elif operation.operation == OperationType.EMA:
                result = self._calculate_ema(sources, operation)
            elif operation.operation == OperationType.ADD:
                result = self._calculate_arithmetic(sources, operation, np.add)
            elif operation.operation == OperationType.SUBTRACT:
                result = self._calculate_arithmetic(sources, operation, np.subtract)
            elif operation.operation == OperationType.MULTIPLY:
                result = self._calculate_arithmetic(sources, operation, np.multiply)
            elif operation.operation == OperationType.DIVIDE:
                result = self._calculate_arithmetic(sources, operation, np.divide)
            elif operation.operation == OperationType.HIGHEST:
                result = self._calculate_highest(sources, operation)
            elif operation.operation == OperationType.LOWEST:
                result = self._calculate_lowest(sources, operation)
            elif operation.operation == OperationType.CHANGE:
                result = self._calculate_change(sources, operation)
            elif operation.operation == OperationType.PERCENT_CHANGE:
                result = self._calculate_percent_change(sources, operation)
            elif operation.operation == OperationType.ABS:
                result = self._calculate_abs(sources, operation)
            elif operation.operation == OperationType.MAX:
                result = self._calculate_max(sources, operation)
            elif operation.operation == OperationType.MIN:
                result = self._calculate_min(sources, operation)
            else:
                result = None
            
            if result is not None:
                sources[operation.output_name] = result
                
        except Exception as e:
            # Handle calculation errors gracefully
            print(f"Error executing operation {operation.operation}: {e}")
            sources[operation.output_name] = [None] * len(df)
    
    def _get_source_data(self, sources: Dict[str, Any], source_key: str) -> np.ndarray:
        """Get source data as numpy array"""
        if isinstance(source_key, str) and source_key in sources:
            data = sources[source_key]
            if isinstance(data, (list, np.ndarray)):
                return np.array(data)
            else:
                # Scalar value - broadcast to array
                return np.full(len(sources['close']), data)
        elif isinstance(source_key, (int, float)):
            # Constant value
            return np.full(len(sources['close']), source_key)
        else:
            raise ValueError(f"Invalid source: {source_key}")
    
    def _calculate_sma(self, sources: Dict[str, Any], operation: IndicatorOperation) -> List[float]:
        """Calculate Simple Moving Average"""
        data = self._get_source_data(sources, operation.source)
        period = operation.parameters['period']
        
        result = []
        for i in range(len(data)):
            if i < period - 1:
                result.append(None)
            else:
                avg = np.mean(data[i-period+1:i+1])
                result.append(avg)
        
        return result
    
    def _calculate_ema(self, sources: Dict[str, Any], operation: IndicatorOperation) -> List[float]:
        """Calculate Exponential Moving Average"""
        data = self._get_source_data(sources, operation.source)
        period = operation.parameters['period']
        alpha = 2.0 / (period + 1)
        
        result = []
        ema_prev = None
        
        for i, value in enumerate(data):
            if ema_prev is None:
                ema_prev = value
                result.append(value)
            else:
                ema = alpha * value + (1 - alpha) * ema_prev
                result.append(ema)
                ema_prev = ema
        
        return result
    
    def _calculate_arithmetic(self, sources: Dict[str, Any], operation: IndicatorOperation, 
                            func: Callable) -> List[float]:
        """Calculate arithmetic operation"""
        data1 = self._get_source_data(sources, operation.source)
        operand = operation.parameters['operand']
        
        if isinstance(operand, str):
            data2 = self._get_source_data(sources, operand)
        else:
            data2 = np.full(len(data1), operand)
        
        try:
            result = func(data1, data2)
            return result.tolist()
        except:
            return [None] * len(data1)
    
    def _calculate_highest(self, sources: Dict[str, Any], operation: IndicatorOperation) -> List[float]:
        """Calculate highest value over period"""
        data = self._get_source_data(sources, operation.source)
        period = operation.parameters['period']
        
        result = []
        for i in range(len(data)):
            if i < period - 1:
                result.append(None)
            else:
                highest = np.max(data[i-period+1:i+1])
                result.append(highest)
        
        return result
    
    def _calculate_lowest(self, sources: Dict[str, Any], operation: IndicatorOperation) -> List[float]:
        """Calculate lowest value over period"""
        data = self._get_source_data(sources, operation.source)
        period = operation.parameters['period']
        
        result = []
        for i in range(len(data)):
            if i < period - 1:
                result.append(None)
            else:
                lowest = np.min(data[i-period+1:i+1])
                result.append(lowest)
        
        return result
    
    def _calculate_change(self, sources: Dict[str, Any], operation: IndicatorOperation) -> List[float]:
        """Calculate change over periods"""
        data = self._get_source_data(sources, operation.source)
        periods = operation.parameters['periods']
        
        result = []
        for i in range(len(data)):
            if i < periods:
                result.append(None)
            else:
                change = data[i] - data[i - periods]
                result.append(change)
        
        return result
    
    def _calculate_percent_change(self, sources: Dict[str, Any], operation: IndicatorOperation) -> List[float]:
        """Calculate percentage change over periods"""
        data = self._get_source_data(sources, operation.source)
        periods = operation.parameters['periods']
        
        result = []
        for i in range(len(data)):
            if i < periods:
                result.append(None)
            else:
                if data[i - periods] != 0:
                    pct_change = ((data[i] - data[i - periods]) / data[i - periods]) * 100
                    result.append(pct_change)
                else:
                    result.append(None)
        
        return result
    
    def _calculate_abs(self, sources: Dict[str, Any], operation: IndicatorOperation) -> List[float]:
        """Calculate absolute value"""
        data = self._get_source_data(sources, operation.source)
        return np.abs(data).tolist()
    
    def _calculate_max(self, sources: Dict[str, Any], operation: IndicatorOperation) -> List[float]:
        """Calculate maximum of two sources"""
        data1 = self._get_source_data(sources, operation.source)
        operand = operation.parameters['operand']
        data2 = self._get_source_data(sources, operand)
        
        return np.maximum(data1, data2).tolist()
    
    def _calculate_min(self, sources: Dict[str, Any], operation: IndicatorOperation) -> List[float]:
        """Calculate minimum of two sources"""
        data1 = self._get_source_data(sources, operation.source)
        operand = operation.parameters['operand']
        data2 = self._get_source_data(sources, operand)
        
        return np.minimum(data1, data2).tolist()


class IndicatorPresets:
    """Predefined custom indicator templates"""
    
    @staticmethod
    def price_momentum() -> CustomIndicatorTemplate:
        """Price Momentum: (Close - Close[n]) / Close[n] * 100"""
        builder = CustomIndicatorBuilder()
        builder.set_name("Price Momentum")
        builder.set_description("Rate of change in price over specified periods")
        builder.add_variable("period", 14)
        builder.add_percent_change("close", 14, "momentum")
        return builder.build().template
    
    @staticmethod
    def custom_rsi() -> CustomIndicatorTemplate:
        """Custom RSI using SMA instead of RMA"""
        builder = CustomIndicatorBuilder()
        builder.set_name("Custom RSI (SMA)")
        builder.set_description("RSI using Simple Moving Average for smoothing")
        builder.add_variable("period", 14)
        
        # Calculate price changes
        builder.add_change("close", 1, "price_change")
        
        # Separate gains and losses would require more complex operations
        # This is a simplified version
        builder.add_sma("close", 14, "avg_close")
        builder.add_arithmetic(OperationType.DIVIDE, "close", "avg_close", "relative_strength")
        builder.add_arithmetic(OperationType.MULTIPLY, "relative_strength", 100, "custom_rsi")
        
        return builder.build().template
    
    @staticmethod
    def volatility_ratio() -> CustomIndicatorTemplate:
        """Volatility Ratio: High-Low spread relative to close"""
        builder = CustomIndicatorBuilder()
        builder.set_name("Volatility Ratio")
        builder.set_description("Measures daily volatility as percentage of close price")
        
        builder.add_arithmetic(OperationType.SUBTRACT, "high", "low", "hl_spread")
        builder.add_arithmetic(OperationType.DIVIDE, "hl_spread", "close", "volatility_raw")
        builder.add_arithmetic(OperationType.MULTIPLY, "volatility_raw", 100, "volatility_ratio")
        
        return builder.build().template
    
    @staticmethod
    def trend_strength() -> CustomIndicatorTemplate:
        """Trend Strength: Difference between fast and slow moving averages"""
        builder = CustomIndicatorBuilder()
        builder.set_name("Trend Strength")
        builder.set_description("Measures trend strength using MA difference")
        builder.add_variable("fast_period", 10)
        builder.add_variable("slow_period", 30)
        
        builder.add_sma("close", 10, "fast_ma")
        builder.add_sma("close", 30, "slow_ma")
        builder.add_arithmetic(OperationType.SUBTRACT, "fast_ma", "slow_ma", "ma_diff")
        builder.add_arithmetic(OperationType.DIVIDE, "ma_diff", "slow_ma", "trend_strength_raw")
        builder.add_arithmetic(OperationType.MULTIPLY, "trend_strength_raw", 100, "trend_strength")
        
        return builder.build().template
    
    @staticmethod
    def volume_momentum() -> CustomIndicatorTemplate:
        """Volume Momentum: Rate of change in volume"""
        builder = CustomIndicatorBuilder()
        builder.set_name("Volume Momentum")
        builder.set_description("Rate of change in trading volume")
        builder.add_variable("period", 10)
        
        builder.add_percent_change("volume", 10, "volume_momentum")
        builder.add_sma("volume_momentum", 5, "volume_momentum_smooth")
        
        return builder.build().template


# Factory for creating preset indicators
class CustomIndicatorFactory:
    """Factory for creating custom indicators from presets"""
    
    @staticmethod
    def create_from_preset(preset_name: str) -> CustomIndicator:
        """Create indicator from preset"""
        presets = {
            'price_momentum': IndicatorPresets.price_momentum,
            'custom_rsi': IndicatorPresets.custom_rsi,
            'volatility_ratio': IndicatorPresets.volatility_ratio,
            'trend_strength': IndicatorPresets.trend_strength,
            'volume_momentum': IndicatorPresets.volume_momentum
        }
        
        if preset_name not in presets:
            available = ', '.join(presets.keys())
            raise ValueError(f"Unknown preset '{preset_name}'. Available: {available}")
        
        template = presets[preset_name]()
        return CustomIndicator(template)
    
    @staticmethod
    def get_available_presets() -> List[str]:
        """Get list of available preset indicators"""
        return ['price_momentum', 'custom_rsi', 'volatility_ratio', 'trend_strength', 'volume_momentum']