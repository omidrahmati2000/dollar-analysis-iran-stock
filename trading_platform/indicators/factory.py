"""
Abstract Factory pattern for creating indicators
"""
from typing import Dict, List, Type
from ..core.interfaces import IIndicator, IIndicatorFactory
from ..core.exceptions import IndicatorException

from .moving_averages import SMA, EMA, WMA, DEMA, TEMA, VWAP
from .oscillators import (
    RSI, MACD, StochasticOscillator, CCI, WilliamsR, MFI,
    UltimateOscillator, AwesomeOscillator, AcceleratorOscillator, TSI
)
from .volatility import BollingerBands, ATR, KeltnerChannels, DonchianChannels, StandardDeviation
from .volume import (
    VolumeProfile, OnBalanceVolume, VolumeWeightedAveragePrice,
    VolumeOscillator, AccumulationDistribution, ChaikinMoneyFlow, VolumeRateOfChange
)
from .trend import (
    SuperTrend, ParabolicSAR, AdaptiveMovingAverage, HullMovingAverage, LinearRegression
)
from .support_resistance import (
    PivotPointsStandard, HorizontalLevels, DynamicLevels, 
    FibonacciRetracement, VolumeProfile as VolumeProfileSR
)


class IndicatorFactory(IIndicatorFactory):
    """
    Factory for creating technical indicators
    Implements Abstract Factory pattern
    """
    
    def __init__(self):
        self._indicators: Dict[str, Type[IIndicator]] = {
            # Moving Averages
            'SMA': SMA,
            'EMA': EMA,
            'WMA': WMA,
            'DEMA': DEMA,
            'TEMA': TEMA,
            'VWAP': VWAP,
            
            # Oscillators
            'RSI': RSI,
            'MACD': MACD,
            'STOCHASTIC': StochasticOscillator,
            'CCI': CCI,
            'WILLIAMS_R': WilliamsR,
            'MFI': MFI,
            'ULTIMATE_OSCILLATOR': UltimateOscillator,
            'AWESOME_OSCILLATOR': AwesomeOscillator,
            'ACCELERATOR_OSCILLATOR': AcceleratorOscillator,
            'TSI': TSI,
            
            # Volatility
            'BOLLINGER': BollingerBands,
            'ATR': ATR,
            'KELTNER': KeltnerChannels,
            'DONCHIAN': DonchianChannels,
            'STD': StandardDeviation,
            
            # Volume Indicators
            'VOLUME_PROFILE': VolumeProfile,
            'OBV': OnBalanceVolume,
            'VWAP_VOLUME': VolumeWeightedAveragePrice,
            'VOLUME_OSCILLATOR': VolumeOscillator,
            'AD': AccumulationDistribution,
            'CMF': ChaikinMoneyFlow,
            'VROC': VolumeRateOfChange,
            
            # Trend Indicators
            'SUPER_TREND': SuperTrend,
            'PARABOLIC_SAR': ParabolicSAR,
            'KAMA': AdaptiveMovingAverage,
            'HULL_MA': HullMovingAverage,
            'LINEAR_REGRESSION': LinearRegression,
            
            # Support/Resistance
            'PIVOT_POINTS': PivotPointsStandard,
            'HORIZONTAL_LEVELS': HorizontalLevels,
            'DYNAMIC_LEVELS': DynamicLevels,
            'FIBONACCI': FibonacciRetracement,
            'VOLUME_PROFILE_SR': VolumeProfileSR
        }
    
    def create_indicator(self, indicator_type: str, **params) -> IIndicator:
        """Create an indicator of specified type"""
        indicator_type = indicator_type.upper()
        
        if indicator_type not in self._indicators:
            raise IndicatorException(
                f"Unknown indicator type: {indicator_type}. "
                f"Available types: {', '.join(self.get_available_indicators())}"
            )
        
        indicator_class = self._indicators[indicator_type]
        return indicator_class(**params)
    
    def get_available_indicators(self) -> List[str]:
        """Get list of available indicators"""
        return list(self._indicators.keys())
    
    def register_indicator(self, name: str, indicator_class: Type[IIndicator]) -> None:
        """Register a custom indicator"""
        if not issubclass(indicator_class, IIndicator):
            raise IndicatorException(
                f"Indicator class must implement IIndicator interface"
            )
        self._indicators[name.upper()] = indicator_class
    
    def get_indicator_info(self, indicator_type: str) -> Dict:
        """Get information about an indicator"""
        indicator_type = indicator_type.upper()
        
        if indicator_type not in self._indicators:
            raise IndicatorException(f"Unknown indicator type: {indicator_type}")
        
        indicator_class = self._indicators[indicator_type]
        
        # Create a temporary instance to get info
        try:
            if indicator_type == 'VWAP':
                temp_instance = indicator_class()
            else:
                # Most indicators have default parameters
                temp_instance = indicator_class()
        except:
            # If default construction fails, try with common parameters
            temp_instance = indicator_class(period=14)
        
        return {
            'name': indicator_type,
            'class': indicator_class.__name__,
            'type': getattr(temp_instance, 'indicator_type', 'unknown'),
            'required_columns': temp_instance.required_columns,
            'parameters': temp_instance.get_parameters()
        }