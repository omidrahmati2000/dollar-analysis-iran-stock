"""
Base indicator classes following Strategy pattern
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import pandas as pd
import numpy as np

from ..core.interfaces import IIndicator
from ..core.exceptions import IndicatorException


class BaseIndicator(IIndicator):
    """Base class for all indicators"""
    
    def __init__(self, **params):
        self._params = params
        self._validate_parameters()
    
    @abstractmethod
    def calculate(self, data: pd.DataFrame) -> pd.Series:
        """Calculate indicator values"""
        pass
    
    @abstractmethod
    def _validate_parameters(self) -> None:
        """Validate indicator parameters"""
        pass
    
    def get_parameters(self) -> Dict[str, Any]:
        """Get indicator parameters"""
        return self._params.copy()
    
    def set_parameters(self, **kwargs) -> None:
        """Set indicator parameters"""
        self._params.update(kwargs)
        self._validate_parameters()
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Get indicator name"""
        pass
    
    @property
    def required_columns(self) -> list:
        """Get required DataFrame columns"""
        return ['close']
    
    def _check_data(self, data: pd.DataFrame) -> None:
        """Check if data has required columns"""
        missing_cols = set(self.required_columns) - set(data.columns)
        if missing_cols:
            raise IndicatorException(
                f"Missing required columns for {self.name}: {missing_cols}"
            )


class TrendIndicator(BaseIndicator):
    """Base class for trend indicators"""
    
    @property
    def indicator_type(self) -> str:
        return "trend"


class OscillatorIndicator(BaseIndicator):
    """Base class for oscillator indicators"""
    
    @property
    def indicator_type(self) -> str:
        return "oscillator"
    
    @property
    def overbought_level(self) -> Optional[float]:
        """Get overbought level"""
        return None
    
    @property
    def oversold_level(self) -> Optional[float]:
        """Get oversold level"""
        return None


class VolumeIndicator(BaseIndicator):
    """Base class for volume indicators"""
    
    @property
    def indicator_type(self) -> str:
        return "volume"
    
    @property
    def required_columns(self) -> list:
        return ['close', 'volume']


class VolatilityIndicator(BaseIndicator):
    """Base class for volatility indicators"""
    
    @property
    def indicator_type(self) -> str:
        return "volatility"