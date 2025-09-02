"""
Volatility indicators
"""
import pandas as pd
import numpy as np

from .base import VolatilityIndicator
from ..core.exceptions import IndicatorException


class BollingerBands(VolatilityIndicator):
    """Bollinger Bands"""
    
    def __init__(self, period: int = 20, std_dev: float = 2.0):
        super().__init__(period=period, std_dev=std_dev)
    
    @property
    def name(self) -> str:
        return f"BB_{self._params['period']}"
    
    def calculate(self, data: pd.DataFrame) -> pd.DataFrame:
        """Calculate Bollinger Bands"""
        self._check_data(data)
        
        sma = data['close'].rolling(window=self._params['period']).mean()
        std = data['close'].rolling(window=self._params['period']).std()
        
        upper_band = sma + (std * self._params['std_dev'])
        lower_band = sma - (std * self._params['std_dev'])
        
        result = pd.DataFrame({
            'BB_Upper': upper_band,
            'BB_Middle': sma,
            'BB_Lower': lower_band,
            'BB_Width': upper_band - lower_band,
            'BB_Percent': (data['close'] - lower_band) / (upper_band - lower_band)
        })
        
        return result
    
    def _validate_parameters(self) -> None:
        """Validate Bollinger Bands parameters"""
        if self._params.get('period', 0) < 2:
            raise IndicatorException("Bollinger Bands period must be at least 2")
        if self._params.get('std_dev', 0) <= 0:
            raise IndicatorException("Standard deviation must be positive")


class ATR(VolatilityIndicator):
    """Average True Range"""
    
    def __init__(self, period: int = 14):
        super().__init__(period=period)
    
    @property
    def name(self) -> str:
        return f"ATR_{self._params['period']}"
    
    @property
    def required_columns(self) -> list:
        return ['high', 'low', 'close']
    
    def calculate(self, data: pd.DataFrame) -> pd.Series:
        """Calculate ATR"""
        self._check_data(data)
        
        high_low = data['high'] - data['low']
        high_close = np.abs(data['high'] - data['close'].shift())
        low_close = np.abs(data['low'] - data['close'].shift())
        
        true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        atr = true_range.rolling(window=self._params['period']).mean()
        
        return atr
    
    def _validate_parameters(self) -> None:
        """Validate ATR parameters"""
        if self._params.get('period', 0) < 1:
            raise IndicatorException("ATR period must be positive")


class KeltnerChannels(VolatilityIndicator):
    """Keltner Channels"""
    
    def __init__(self, period: int = 20, multiplier: float = 2.0):
        super().__init__(period=period, multiplier=multiplier)
    
    @property
    def name(self) -> str:
        return f"KC_{self._params['period']}"
    
    @property
    def required_columns(self) -> list:
        return ['high', 'low', 'close']
    
    def calculate(self, data: pd.DataFrame) -> pd.DataFrame:
        """Calculate Keltner Channels"""
        self._check_data(data)
        
        # Calculate EMA of typical price
        typical_price = (data['high'] + data['low'] + data['close']) / 3
        ema = typical_price.ewm(span=self._params['period'], adjust=False).mean()
        
        # Calculate ATR
        atr_indicator = ATR(period=self._params['period'])
        atr = atr_indicator.calculate(data)
        
        # Calculate bands
        upper_band = ema + (atr * self._params['multiplier'])
        lower_band = ema - (atr * self._params['multiplier'])
        
        result = pd.DataFrame({
            'KC_Upper': upper_band,
            'KC_Middle': ema,
            'KC_Lower': lower_band
        })
        
        return result
    
    def _validate_parameters(self) -> None:
        """Validate Keltner Channels parameters"""
        if self._params.get('period', 0) < 1:
            raise IndicatorException("Keltner Channels period must be positive")
        if self._params.get('multiplier', 0) <= 0:
            raise IndicatorException("Multiplier must be positive")


class DonchianChannels(VolatilityIndicator):
    """Donchian Channels"""
    
    def __init__(self, period: int = 20):
        super().__init__(period=period)
    
    @property
    def name(self) -> str:
        return f"DC_{self._params['period']}"
    
    @property
    def required_columns(self) -> list:
        return ['high', 'low']
    
    def calculate(self, data: pd.DataFrame) -> pd.DataFrame:
        """Calculate Donchian Channels"""
        self._check_data(data)
        
        upper_band = data['high'].rolling(window=self._params['period']).max()
        lower_band = data['low'].rolling(window=self._params['period']).min()
        middle_band = (upper_band + lower_band) / 2
        
        result = pd.DataFrame({
            'DC_Upper': upper_band,
            'DC_Middle': middle_band,
            'DC_Lower': lower_band
        })
        
        return result
    
    def _validate_parameters(self) -> None:
        """Validate Donchian Channels parameters"""
        if self._params.get('period', 0) < 1:
            raise IndicatorException("Donchian Channels period must be positive")


class StandardDeviation(VolatilityIndicator):
    """Standard Deviation"""
    
    def __init__(self, period: int = 20):
        super().__init__(period=period)
    
    @property
    def name(self) -> str:
        return f"STD_{self._params['period']}"
    
    def calculate(self, data: pd.DataFrame) -> pd.Series:
        """Calculate Standard Deviation"""
        self._check_data(data)
        return data['close'].rolling(window=self._params['period']).std()
    
    def _validate_parameters(self) -> None:
        """Validate Standard Deviation parameters"""
        if self._params.get('period', 0) < 2:
            raise IndicatorException("Standard Deviation period must be at least 2")