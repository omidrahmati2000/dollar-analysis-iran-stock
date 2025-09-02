"""
Moving average indicators
"""
import pandas as pd
import numpy as np
from typing import Optional

from .base import TrendIndicator
from ..core.exceptions import IndicatorException


class SMA(TrendIndicator):
    """Simple Moving Average"""
    
    def __init__(self, period: int = 20):
        super().__init__(period=period)
    
    @property
    def name(self) -> str:
        return f"SMA_{self._params['period']}"
    
    def calculate(self, data: pd.DataFrame) -> pd.Series:
        """Calculate SMA"""
        self._check_data(data)
        return data['close'].rolling(window=self._params['period']).mean()
    
    def _validate_parameters(self) -> None:
        """Validate SMA parameters"""
        if self._params.get('period', 0) < 1:
            raise IndicatorException("SMA period must be positive")


class EMA(TrendIndicator):
    """Exponential Moving Average"""
    
    def __init__(self, period: int = 20):
        super().__init__(period=period)
    
    @property
    def name(self) -> str:
        return f"EMA_{self._params['period']}"
    
    def calculate(self, data: pd.DataFrame) -> pd.Series:
        """Calculate EMA"""
        self._check_data(data)
        return data['close'].ewm(span=self._params['period'], adjust=False).mean()
    
    def _validate_parameters(self) -> None:
        """Validate EMA parameters"""
        if self._params.get('period', 0) < 1:
            raise IndicatorException("EMA period must be positive")


class WMA(TrendIndicator):
    """Weighted Moving Average"""
    
    def __init__(self, period: int = 20):
        super().__init__(period=period)
    
    @property
    def name(self) -> str:
        return f"WMA_{self._params['period']}"
    
    def calculate(self, data: pd.DataFrame) -> pd.Series:
        """Calculate WMA"""
        self._check_data(data)
        period = self._params['period']
        weights = np.arange(1, period + 1)
        
        def weighted_mean(values):
            if len(values) == period:
                return np.dot(values, weights) / weights.sum()
            return np.nan
        
        return data['close'].rolling(window=period).apply(weighted_mean, raw=True)
    
    def _validate_parameters(self) -> None:
        """Validate WMA parameters"""
        if self._params.get('period', 0) < 1:
            raise IndicatorException("WMA period must be positive")


class DEMA(TrendIndicator):
    """Double Exponential Moving Average"""
    
    def __init__(self, period: int = 20):
        super().__init__(period=period)
    
    @property
    def name(self) -> str:
        return f"DEMA_{self._params['period']}"
    
    def calculate(self, data: pd.DataFrame) -> pd.Series:
        """Calculate DEMA"""
        self._check_data(data)
        ema1 = data['close'].ewm(span=self._params['period'], adjust=False).mean()
        ema2 = ema1.ewm(span=self._params['period'], adjust=False).mean()
        return 2 * ema1 - ema2
    
    def _validate_parameters(self) -> None:
        """Validate DEMA parameters"""
        if self._params.get('period', 0) < 1:
            raise IndicatorException("DEMA period must be positive")


class TEMA(TrendIndicator):
    """Triple Exponential Moving Average"""
    
    def __init__(self, period: int = 20):
        super().__init__(period=period)
    
    @property
    def name(self) -> str:
        return f"TEMA_{self._params['period']}"
    
    def calculate(self, data: pd.DataFrame) -> pd.Series:
        """Calculate TEMA"""
        self._check_data(data)
        ema1 = data['close'].ewm(span=self._params['period'], adjust=False).mean()
        ema2 = ema1.ewm(span=self._params['period'], adjust=False).mean()
        ema3 = ema2.ewm(span=self._params['period'], adjust=False).mean()
        return 3 * ema1 - 3 * ema2 + ema3
    
    def _validate_parameters(self) -> None:
        """Validate TEMA parameters"""
        if self._params.get('period', 0) < 1:
            raise IndicatorException("TEMA period must be positive")


class VWAP(TrendIndicator):
    """Volume Weighted Average Price"""
    
    def __init__(self):
        super().__init__()
    
    @property
    def name(self) -> str:
        return "VWAP"
    
    @property
    def required_columns(self) -> list:
        return ['high', 'low', 'close', 'volume']
    
    def calculate(self, data: pd.DataFrame) -> pd.Series:
        """Calculate VWAP"""
        self._check_data(data)
        typical_price = (data['high'] + data['low'] + data['close']) / 3
        cumulative_tpv = (typical_price * data['volume']).cumsum()
        cumulative_volume = data['volume'].cumsum()
        return cumulative_tpv / cumulative_volume
    
    def _validate_parameters(self) -> None:
        """No parameters to validate for VWAP"""
        pass