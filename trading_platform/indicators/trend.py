"""
Trend-following indicators with TradingView-like features
Implements comprehensive trend analysis tools with custom parameters
"""

from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import pandas as pd
import numpy as np
from abc import ABC, abstractmethod

from .base import BaseIndicator
from ..domain.models import OHLCVData


class TrendDirection(Enum):
    """Trend direction enumeration"""
    BULLISH = "bullish"
    BEARISH = "bearish"
    SIDEWAYS = "sideways"
    UNKNOWN = "unknown"


class MAType(Enum):
    """Moving average types"""
    SMA = "sma"
    EMA = "ema" 
    WMA = "wma"
    HULL = "hull"
    TEMA = "tema"
    DEMA = "dema"
    KAMA = "kama"


@dataclass
class TrendSignal:
    """Trend-based signal"""
    timestamp: pd.Timestamp
    signal_type: str  # 'trend_change', 'breakout', 'pullback', etc.
    direction: TrendDirection
    strength: float  # Signal strength 0-1
    price: float
    description: str


class TrendIndicator(BaseIndicator, ABC):
    """Base class for trend-following indicators"""
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.category = "Trend"


class SuperTrend(TrendIndicator):
    """SuperTrend indicator - TradingView style with custom parameters"""
    
    def __init__(
        self,
        atr_period: int = 10,     # ATR period
        factor: float = 3.0,      # Multiplier factor
        change_atr_calculation: bool = False,  # Use different ATR calculation
        highlight_state: bool = True,  # Highlight trend state
        show_signals: bool = True      # Show buy/sell signals
    ):
        super().__init__()
        self.atr_period = atr_period
        self.factor = factor
        self.change_atr_calculation = change_atr_calculation
        self.highlight_state = highlight_state
        self.show_signals = show_signals
        
        self.supertrend_values = []
        self.trend_direction = []
        self.signals = []
    
    def calculate(self, data: List[OHLCVData]) -> Dict[str, Any]:
        """Calculate SuperTrend"""
        df = self._to_dataframe(data)
        if len(df) < self.atr_period:
            return self._empty_result()
        
        # Calculate ATR
        atr = self._calculate_atr(df, self.atr_period, self.change_atr_calculation)
        
        # Calculate basic upper and lower bands
        hl2 = (df['high'] + df['low']) / 2
        
        basic_upper_band = hl2 + (self.factor * atr)
        basic_lower_band = hl2 - (self.factor * atr)
        
        # Initialize arrays
        final_upper_band = []
        final_lower_band = []
        supertrend = []
        trend_dir = []
        
        for i in range(len(df)):
            if i == 0:
                final_upper_band.append(basic_upper_band.iloc[i])
                final_lower_band.append(basic_lower_band.iloc[i])
                supertrend.append(basic_lower_band.iloc[i])
                trend_dir.append(1)  # 1 for up, -1 for down
            else:
                # Calculate final upper band
                if (basic_upper_band.iloc[i] < final_upper_band[i-1] or 
                    df.iloc[i-1]['close'] > final_upper_band[i-1]):
                    final_upper_band.append(basic_upper_band.iloc[i])
                else:
                    final_upper_band.append(final_upper_band[i-1])
                
                # Calculate final lower band
                if (basic_lower_band.iloc[i] > final_lower_band[i-1] or 
                    df.iloc[i-1]['close'] < final_lower_band[i-1]):
                    final_lower_band.append(basic_lower_band.iloc[i])
                else:
                    final_lower_band.append(final_lower_band[i-1])
                
                # Determine trend direction
                if (df.iloc[i]['close'] <= final_lower_band[i] and 
                    df.iloc[i-1]['close'] <= final_lower_band[i-1]):
                    trend_dir.append(-1)  # Downtrend
                elif (df.iloc[i]['close'] >= final_upper_band[i] and 
                      df.iloc[i-1]['close'] >= final_upper_band[i-1]):
                    trend_dir.append(1)   # Uptrend
                else:
                    trend_dir.append(trend_dir[i-1])  # Continue previous trend
                
                # Calculate SuperTrend value
                if trend_dir[i] == 1:
                    supertrend.append(final_lower_band[i])
                else:
                    supertrend.append(final_upper_band[i])
        
        self.supertrend_values = supertrend
        self.trend_direction = trend_dir
        
        # Generate signals
        if self.show_signals:
            self._generate_supertrend_signals(df, trend_dir)
        
        return {
            'supertrend': supertrend,
            'trend_direction': trend_dir,
            'upper_band': final_upper_band,
            'lower_band': final_lower_band,
            'signals': self.signals
        }
    
    def _calculate_atr(self, df: pd.DataFrame, period: int, change_calculation: bool) -> pd.Series:
        """Calculate Average True Range"""
        high = df['high']
        low = df['low']
        close = df['close']
        
        if change_calculation:
            # Alternative ATR calculation
            true_range = np.maximum(
                high - low,
                np.maximum(
                    np.abs(high - close.shift(1)),
                    np.abs(low - close.shift(1))
                )
            )
        else:
            # Standard ATR calculation
            tr1 = high - low
            tr2 = np.abs(high - close.shift(1))
            tr3 = np.abs(low - close.shift(1))
            true_range = np.maximum(tr1, np.maximum(tr2, tr3))
        
        return true_range.rolling(window=period).mean()
    
    def _generate_supertrend_signals(self, df: pd.DataFrame, trend_dir: List[int]):
        """Generate SuperTrend signals"""
        self.signals = []
        
        for i in range(1, len(trend_dir)):
            # Trend change from down to up (Buy signal)
            if trend_dir[i] == 1 and trend_dir[i-1] == -1:
                self.signals.append(TrendSignal(
                    timestamp=df.iloc[i].name,
                    signal_type='buy',
                    direction=TrendDirection.BULLISH,
                    strength=0.8,
                    price=df.iloc[i]['close'],
                    description='SuperTrend Buy Signal'
                ))
            
            # Trend change from up to down (Sell signal)
            elif trend_dir[i] == -1 and trend_dir[i-1] == 1:
                self.signals.append(TrendSignal(
                    timestamp=df.iloc[i].name,
                    signal_type='sell',
                    direction=TrendDirection.BEARISH,
                    strength=0.8,
                    price=df.iloc[i]['close'],
                    description='SuperTrend Sell Signal'
                ))


class ParabolicSAR(TrendIndicator):
    """Parabolic SAR with TradingView customization"""
    
    def __init__(
        self,
        start: float = 0.02,      # Initial acceleration factor
        increment: float = 0.02,   # Acceleration increment
        maximum: float = 0.2,      # Maximum acceleration
        show_levels: bool = True   # Show support/resistance levels
    ):
        super().__init__()
        self.start = start
        self.increment = increment
        self.maximum = maximum
        self.show_levels = show_levels
        
        self.sar_values = []
        self.trend_direction = []
        self.acceleration_factor = []
        self.signals = []
    
    def calculate(self, data: List[OHLCVData]) -> Dict[str, Any]:
        """Calculate Parabolic SAR"""
        df = self._to_dataframe(data)
        if len(df) < 2:
            return self._empty_result()
        
        sar = []
        trend = []  # 1 for up, -1 for down
        af = []
        ep = []  # Extreme point
        
        # Initialize
        sar.append(df.iloc[0]['low'])
        trend.append(1)
        af.append(self.start)
        ep.append(df.iloc[0]['high'])
        
        for i in range(1, len(df)):
            high = df.iloc[i]['high']
            low = df.iloc[i]['low']
            
            prev_sar = sar[i-1]
            prev_trend = trend[i-1]
            prev_af = af[i-1]
            prev_ep = ep[i-1]
            
            # Calculate current SAR
            current_sar = prev_sar + prev_af * (prev_ep - prev_sar)
            
            # Determine trend
            if prev_trend == 1:  # Uptrend
                if low <= current_sar:
                    # Trend reversal to downtrend
                    current_trend = -1
                    current_sar = prev_ep  # Use previous extreme point
                    current_af = self.start
                    current_ep = low
                else:
                    # Continue uptrend
                    current_trend = 1
                    if high > prev_ep:
                        current_ep = high
                        current_af = min(prev_af + self.increment, self.maximum)
                    else:
                        current_ep = prev_ep
                        current_af = prev_af
                    
                    # SAR cannot be above previous two lows
                    current_sar = min(current_sar, df.iloc[i-1]['low'])
                    if i > 1:
                        current_sar = min(current_sar, df.iloc[i-2]['low'])
            
            else:  # Downtrend
                if high >= current_sar:
                    # Trend reversal to uptrend
                    current_trend = 1
                    current_sar = prev_ep  # Use previous extreme point
                    current_af = self.start
                    current_ep = high
                else:
                    # Continue downtrend
                    current_trend = -1
                    if low < prev_ep:
                        current_ep = low
                        current_af = min(prev_af + self.increment, self.maximum)
                    else:
                        current_ep = prev_ep
                        current_af = prev_af
                    
                    # SAR cannot be below previous two highs
                    current_sar = max(current_sar, df.iloc[i-1]['high'])
                    if i > 1:
                        current_sar = max(current_sar, df.iloc[i-2]['high'])
            
            sar.append(current_sar)
            trend.append(current_trend)
            af.append(current_af)
            ep.append(current_ep)
        
        self.sar_values = sar
        self.trend_direction = trend
        self.acceleration_factor = af
        
        # Generate signals
        self._generate_sar_signals(df, trend)
        
        return {
            'sar': sar,
            'trend_direction': trend,
            'acceleration_factor': af,
            'extreme_points': ep,
            'signals': self.signals
        }
    
    def _generate_sar_signals(self, df: pd.DataFrame, trend: List[int]):
        """Generate Parabolic SAR signals"""
        self.signals = []
        
        for i in range(1, len(trend)):
            # Trend change signals
            if trend[i] == 1 and trend[i-1] == -1:
                self.signals.append(TrendSignal(
                    timestamp=df.iloc[i].name,
                    signal_type='buy',
                    direction=TrendDirection.BULLISH,
                    strength=0.7,
                    price=df.iloc[i]['close'],
                    description='PSAR Bullish Reversal'
                ))
            
            elif trend[i] == -1 and trend[i-1] == 1:
                self.signals.append(TrendSignal(
                    timestamp=df.iloc[i].name,
                    signal_type='sell',
                    direction=TrendDirection.BEARISH,
                    strength=0.7,
                    price=df.iloc[i]['close'],
                    description='PSAR Bearish Reversal'
                ))


class AdaptiveMovingAverage(TrendIndicator):
    """Adaptive Moving Average (KAMA) - Kaufman's Adaptive MA"""
    
    def __init__(
        self,
        length: int = 14,         # Efficiency ratio period
        fast_length: int = 2,     # Fast EMA constant
        slow_length: int = 30,    # Slow EMA constant
        source: str = "close"     # Price source
    ):
        super().__init__()
        self.length = length
        self.fast_length = fast_length
        self.slow_length = slow_length
        self.source = source
        
        self.kama_values = []
        self.efficiency_ratio = []
        self.signals = []
    
    def calculate(self, data: List[OHLCVData]) -> Dict[str, Any]:
        """Calculate KAMA"""
        df = self._to_dataframe(data)
        if len(df) < self.length + 1:
            return self._empty_result()
        
        # Get source data
        if self.source == "hlc3":
            source_data = (df['high'] + df['low'] + df['close']) / 3
        elif self.source == "hl2":
            source_data = (df['high'] + df['low']) / 2
        else:
            source_data = df[self.source]
        
        kama = []
        efficiency = []
        
        # Calculate smoothing constants
        fast_sc = 2.0 / (self.fast_length + 1)
        slow_sc = 2.0 / (self.slow_length + 1)
        
        for i in range(len(source_data)):
            if i < self.length:
                kama.append(None)
                efficiency.append(None)
            else:
                # Calculate efficiency ratio
                change = abs(source_data.iloc[i] - source_data.iloc[i - self.length])
                volatility = sum(abs(source_data.iloc[j] - source_data.iloc[j-1]) 
                               for j in range(i - self.length + 1, i + 1))
                
                if volatility != 0:
                    er = change / volatility
                else:
                    er = 0
                
                efficiency.append(er)
                
                # Calculate smoothing constant
                sc = (er * (fast_sc - slow_sc) + slow_sc) ** 2
                
                # Calculate KAMA
                if i == self.length:
                    # First KAMA value
                    kama_value = source_data.iloc[i]
                else:
                    kama_value = kama[i-1] + sc * (source_data.iloc[i] - kama[i-1])
                
                kama.append(kama_value)
        
        self.kama_values = kama
        self.efficiency_ratio = efficiency
        
        # Generate trend signals
        self._generate_kama_signals(df, source_data, kama)
        
        return {
            'kama': kama,
            'efficiency_ratio': efficiency,
            'signals': self.signals
        }
    
    def _generate_kama_signals(self, df: pd.DataFrame, source_data: pd.Series, kama: List[float]):
        """Generate KAMA trend signals"""
        self.signals = []
        
        for i in range(2, len(kama)):
            if kama[i] is None or kama[i-1] is None or kama[i-2] is None:
                continue
            
            # Price crosses above KAMA (bullish)
            if (source_data.iloc[i] > kama[i] and 
                source_data.iloc[i-1] <= kama[i-1]):
                self.signals.append(TrendSignal(
                    timestamp=df.iloc[i].name,
                    signal_type='bullish_cross',
                    direction=TrendDirection.BULLISH,
                    strength=0.6,
                    price=df.iloc[i]['close'],
                    description='Price crosses above KAMA'
                ))
            
            # Price crosses below KAMA (bearish)
            elif (source_data.iloc[i] < kama[i] and 
                  source_data.iloc[i-1] >= kama[i-1]):
                self.signals.append(TrendSignal(
                    timestamp=df.iloc[i].name,
                    signal_type='bearish_cross',
                    direction=TrendDirection.BEARISH,
                    strength=0.6,
                    price=df.iloc[i]['close'],
                    description='Price crosses below KAMA'
                ))
            
            # KAMA direction change (trend change)
            elif (kama[i] > kama[i-1] > kama[i-2]):  # KAMA turning up
                self.signals.append(TrendSignal(
                    timestamp=df.iloc[i].name,
                    signal_type='trend_change',
                    direction=TrendDirection.BULLISH,
                    strength=0.4,
                    price=df.iloc[i]['close'],
                    description='KAMA turning bullish'
                ))
            
            elif (kama[i] < kama[i-1] < kama[i-2]):  # KAMA turning down
                self.signals.append(TrendSignal(
                    timestamp=df.iloc[i].name,
                    signal_type='trend_change',
                    direction=TrendDirection.BEARISH,
                    strength=0.4,
                    price=df.iloc[i]['close'],
                    description='KAMA turning bearish'
                ))


class HullMovingAverage(TrendIndicator):
    """Hull Moving Average - Fast and smooth trend indicator"""
    
    def __init__(
        self,
        length: int = 21,         # HMA period
        source: str = "close",    # Price source
        show_signals: bool = True  # Show trend change signals
    ):
        super().__init__()
        self.length = length
        self.source = source
        self.show_signals = show_signals
        
        self.hma_values = []
        self.trend_direction = []
        self.signals = []
    
    def calculate(self, data: List[OHLCVData]) -> Dict[str, Any]:
        """Calculate Hull MA"""
        df = self._to_dataframe(data)
        if len(df) < self.length:
            return self._empty_result()
        
        # Get source data
        source_data = df[self.source] if self.source in df.columns else df['close']
        
        # Calculate Hull MA
        half_length = int(self.length / 2)
        sqrt_length = int(np.sqrt(self.length))
        
        # WMA with half length
        wma_half = self._calculate_wma(source_data, half_length)
        
        # WMA with full length  
        wma_full = self._calculate_wma(source_data, self.length)
        
        # Calculate 2*WMA(n/2) - WMA(n)
        raw_hma = []
        for i in range(len(source_data)):
            if (i < half_length - 1 or i < self.length - 1 or 
                wma_half[i] is None or wma_full[i] is None):
                raw_hma.append(None)
            else:
                raw_hma.append(2 * wma_half[i] - wma_full[i])
        
        # Apply WMA with sqrt(length) to the result
        self.hma_values = self._calculate_wma(raw_hma, sqrt_length)
        
        # Determine trend direction
        self._calculate_hma_trend()
        
        # Generate signals
        if self.show_signals:
            self._generate_hma_signals(df)
        
        return {
            'hma': self.hma_values,
            'trend_direction': self.trend_direction,
            'signals': self.signals
        }
    
    def _calculate_wma(self, data, period: int) -> List[float]:
        """Calculate Weighted Moving Average"""
        if isinstance(data, pd.Series):
            data = data.values
        elif isinstance(data, list) and any(x is None for x in data):
            # Handle list with None values
            data = [x if x is not None else 0 for x in data]
        
        wma = []
        weights = np.arange(1, period + 1)
        weight_sum = np.sum(weights)
        
        for i in range(len(data)):
            if i < period - 1:
                wma.append(None)
            else:
                if isinstance(data, list) and any(x is None for x in data[i-period+1:i+1]):
                    wma.append(None)
                else:
                    values = data[i-period+1:i+1]
                    weighted_sum = np.sum(values * weights)
                    wma.append(weighted_sum / weight_sum)
        
        return wma
    
    def _calculate_hma_trend(self):
        """Calculate HMA trend direction"""
        self.trend_direction = []
        
        for i in range(len(self.hma_values)):
            if i < 2 or self.hma_values[i] is None or self.hma_values[i-1] is None:
                self.trend_direction.append(TrendDirection.UNKNOWN)
            else:
                # Simple trend based on HMA slope
                if self.hma_values[i] > self.hma_values[i-1]:
                    self.trend_direction.append(TrendDirection.BULLISH)
                elif self.hma_values[i] < self.hma_values[i-1]:
                    self.trend_direction.append(TrendDirection.BEARISH)
                else:
                    self.trend_direction.append(TrendDirection.SIDEWAYS)
    
    def _generate_hma_signals(self, df: pd.DataFrame):
        """Generate HMA trend signals"""
        self.signals = []
        
        for i in range(1, len(self.trend_direction)):
            if (self.trend_direction[i] == TrendDirection.BULLISH and 
                self.trend_direction[i-1] != TrendDirection.BULLISH):
                self.signals.append(TrendSignal(
                    timestamp=df.iloc[i].name,
                    signal_type='trend_change',
                    direction=TrendDirection.BULLISH,
                    strength=0.6,
                    price=df.iloc[i]['close'],
                    description='HMA Bullish Trend'
                ))
            
            elif (self.trend_direction[i] == TrendDirection.BEARISH and 
                  self.trend_direction[i-1] != TrendDirection.BEARISH):
                self.signals.append(TrendSignal(
                    timestamp=df.iloc[i].name,
                    signal_type='trend_change',
                    direction=TrendDirection.BEARISH,
                    strength=0.6,
                    price=df.iloc[i]['close'],
                    description='HMA Bearish Trend'
                ))


class LinearRegression(TrendIndicator):
    """Linear Regression indicator with trend analysis"""
    
    def __init__(
        self,
        length: int = 14,         # Regression period
        source: str = "close",    # Price source
        show_channel: bool = True, # Show regression channel
        deviation_multiplier: float = 2.0  # Channel deviation
    ):
        super().__init__()
        self.length = length
        self.source = source
        self.show_channel = show_channel
        self.deviation_multiplier = deviation_multiplier
        
        self.linreg_values = []
        self.upper_channel = []
        self.lower_channel = []
        self.slope_values = []
        self.r_squared = []
        self.signals = []
    
    def calculate(self, data: List[OHLCVData]) -> Dict[str, Any]:
        """Calculate Linear Regression"""
        df = self._to_dataframe(data)
        if len(df) < self.length:
            return self._empty_result()
        
        source_data = df[self.source] if self.source in df.columns else df['close']
        
        linreg = []
        slopes = []
        r_squared_vals = []
        upper_band = []
        lower_band = []
        
        for i in range(len(source_data)):
            if i < self.length - 1:
                linreg.append(None)
                slopes.append(None)
                r_squared_vals.append(None)
                upper_band.append(None)
                lower_band.append(None)
            else:
                # Get data for regression
                y_values = source_data.iloc[i-self.length+1:i+1].values
                x_values = np.arange(self.length)
                
                # Calculate linear regression
                coeffs = np.polyfit(x_values, y_values, 1)
                slope = coeffs[0]
                intercept = coeffs[1]
                
                # Current regression value (end point)
                current_linreg = slope * (self.length - 1) + intercept
                
                # Calculate R-squared
                y_mean = np.mean(y_values)
                ss_res = np.sum((y_values - (slope * x_values + intercept)) ** 2)
                ss_tot = np.sum((y_values - y_mean) ** 2)
                r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0
                
                linreg.append(current_linreg)
                slopes.append(slope)
                r_squared_vals.append(r_squared)
                
                # Calculate channel bands if requested
                if self.show_channel:
                    # Calculate standard deviation of residuals
                    residuals = y_values - (slope * x_values + intercept)
                    std_dev = np.std(residuals)
                    
                    upper_band.append(current_linreg + self.deviation_multiplier * std_dev)
                    lower_band.append(current_linreg - self.deviation_multiplier * std_dev)
                else:
                    upper_band.append(None)
                    lower_band.append(None)
        
        self.linreg_values = linreg
        self.slope_values = slopes
        self.r_squared = r_squared_vals
        self.upper_channel = upper_band
        self.lower_channel = lower_band
        
        # Generate signals
        self._generate_linreg_signals(df, source_data, linreg, slopes)
        
        return {
            'linreg': linreg,
            'slope': slopes,
            'r_squared': r_squared_vals,
            'upper_channel': upper_band,
            'lower_channel': lower_band,
            'signals': self.signals
        }
    
    def _generate_linreg_signals(self, df: pd.DataFrame, source_data: pd.Series, 
                               linreg: List[float], slopes: List[float]):
        """Generate Linear Regression signals"""
        self.signals = []
        
        for i in range(1, len(linreg)):
            if linreg[i] is None or slopes[i] is None:
                continue
            
            # Slope change signals
            if i > 1 and slopes[i-1] is not None:
                # Slope turns positive (bullish)
                if slopes[i] > 0 and slopes[i-1] <= 0:
                    self.signals.append(TrendSignal(
                        timestamp=df.iloc[i].name,
                        signal_type='trend_change',
                        direction=TrendDirection.BULLISH,
                        strength=min(abs(slopes[i]) * 100, 1.0),
                        price=df.iloc[i]['close'],
                        description='Linear Regression Bullish Trend'
                    ))
                
                # Slope turns negative (bearish)
                elif slopes[i] < 0 and slopes[i-1] >= 0:
                    self.signals.append(TrendSignal(
                        timestamp=df.iloc[i].name,
                        signal_type='trend_change',
                        direction=TrendDirection.BEARISH,
                        strength=min(abs(slopes[i]) * 100, 1.0),
                        price=df.iloc[i]['close'],
                        description='Linear Regression Bearish Trend'
                    ))
            
            # Price vs regression line signals
            price = source_data.iloc[i]
            
            # Price breaks above regression line
            if (price > linreg[i] and 
                i > 0 and source_data.iloc[i-1] <= linreg[i-1]):
                self.signals.append(TrendSignal(
                    timestamp=df.iloc[i].name,
                    signal_type='breakout',
                    direction=TrendDirection.BULLISH,
                    strength=0.5,
                    price=df.iloc[i]['close'],
                    description='Price breaks above regression line'
                ))
            
            # Price breaks below regression line
            elif (price < linreg[i] and 
                  i > 0 and source_data.iloc[i-1] >= linreg[i-1]):
                self.signals.append(TrendSignal(
                    timestamp=df.iloc[i].name,
                    signal_type='breakdown',
                    direction=TrendDirection.BEARISH,
                    strength=0.5,
                    price=df.iloc[i]['close'],
                    description='Price breaks below regression line'
                ))