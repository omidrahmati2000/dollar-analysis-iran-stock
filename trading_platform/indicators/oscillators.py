"""
Advanced Oscillator Indicators - TradingView Style
Complete implementation with customizable parameters
"""
import pandas as pd
import numpy as np
from typing import Dict, Any, Tuple, Optional, Union
from dataclasses import dataclass
from enum import Enum

from .base import OscillatorIndicator
from ..core.exceptions import IndicatorException


class RSISource(Enum):
    """RSI calculation sources"""
    CLOSE = "close"
    OPEN = "open" 
    HIGH = "high"
    LOW = "low"
    HL2 = "hl2"  # (high + low) / 2
    HLC3 = "hlc3"  # (high + low + close) / 3
    OHLC4 = "ohlc4"  # (open + high + low + close) / 4


class RSI(OscillatorIndicator):
    """
    Relative Strength Index - TradingView Style
    Features: Custom source, smoothing options, divergence detection
    """
    
    def __init__(
        self, 
        length: int = 14,
        source: RSISource = RSISource.CLOSE,
        smoothing_method: str = "rma",  # rma, sma, ema
        smoothing_length: int = 1,
        overbought: float = 70.0,
        oversold: float = 30.0
    ):
        super().__init__(
            length=length,
            source=source,
            smoothing_method=smoothing_method,
            smoothing_length=smoothing_length,
            overbought=overbought,
            oversold=oversold
        )
    
    @property
    def name(self) -> str:
        return f"RSI_{self._params['length']}"
    
    @property
    def overbought_level(self) -> float:
        return self._params['overbought']
    
    @property
    def oversold_level(self) -> float:
        return self._params['oversold']
    
    def calculate(self, data: pd.DataFrame) -> pd.DataFrame:
        """Calculate RSI with TradingView features"""
        self._check_data(data)
        
        # Get source data
        source_data = self._get_source_data(data, self._params['source'])
        
        # Calculate price changes
        delta = source_data.diff()
        gain = delta.where(delta > 0, 0)
        loss = -delta.where(delta < 0, 0)
        
        # Apply smoothing method
        length = self._params['length']
        method = self._params['smoothing_method']
        
        if method == "rma":  # TradingView's default RMA (Wilder's smoothing)
            avg_gain = self._rma(gain, length)
            avg_loss = self._rma(loss, length)
        elif method == "sma":
            avg_gain = gain.rolling(window=length).mean()
            avg_loss = loss.rolling(window=length).mean()
        elif method == "ema":
            avg_gain = gain.ewm(span=length, adjust=False).mean()
            avg_loss = loss.ewm(span=length, adjust=False).mean()
        else:
            raise IndicatorException(f"Unknown smoothing method: {method}")
        
        # Calculate RSI
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        
        # Apply additional smoothing if specified
        if self._params['smoothing_length'] > 1:
            rsi = rsi.rolling(window=self._params['smoothing_length']).mean()
        
        # Detect divergences
        divergences = self._detect_divergences(source_data, rsi)
        
        result = pd.DataFrame({
            'RSI': rsi,
            'Overbought': self.overbought_level,
            'Oversold': self.oversold_level,
            'Bullish_Divergence': divergences['bullish'],
            'Bearish_Divergence': divergences['bearish']
        })
        
        return result
    
    def _rma(self, series: pd.Series, length: int) -> pd.Series:
        """TradingView's RMA (Running Moving Average / Wilder's Smoothing)"""
        alpha = 1 / length
        return series.ewm(alpha=alpha, adjust=False).mean()
    
    def _detect_divergences(self, price: pd.Series, indicator: pd.Series) -> Dict[str, pd.Series]:
        """Detect bullish and bearish divergences"""
        # Simplified divergence detection
        bullish_div = pd.Series(False, index=price.index)
        bearish_div = pd.Series(False, index=price.index)
        
        # Look for divergences over rolling windows
        window = 20
        for i in range(window, len(price)):
            price_window = price.iloc[i-window:i+1]
            ind_window = indicator.iloc[i-window:i+1]
            
            # Bullish divergence: price makes lower low, indicator makes higher low
            price_min_idx = price_window.idxmin()
            ind_min_idx = ind_window.idxmin()
            
            if (price_window.iloc[-1] < price_window.min() and 
                ind_window.iloc[-1] > ind_window.min()):
                bullish_div.iloc[i] = True
                
            # Bearish divergence: price makes higher high, indicator makes lower high
            if (price_window.iloc[-1] > price_window.max() and 
                ind_window.iloc[-1] < ind_window.max()):
                bearish_div.iloc[i] = True
        
        return {'bullish': bullish_div, 'bearish': bearish_div}
    
    def _validate_parameters(self) -> None:
        """Validate RSI parameters"""
        if self._params.get('length', 0) < 2:
            raise IndicatorException("RSI length must be at least 2")


class MACD(OscillatorIndicator):
    """
    MACD - TradingView Style
    Features: Custom sources, different MA types, histogram coloring
    """
    
    def __init__(
        self,
        fast_length: int = 12,
        slow_length: int = 26, 
        signal_smoothing: int = 9,
        source: RSISource = RSISource.CLOSE,
        fast_type: str = "ema",  # ema, sma, wma
        slow_type: str = "ema",
        signal_type: str = "ema"
    ):
        super().__init__(
            fast_length=fast_length,
            slow_length=slow_length,
            signal_smoothing=signal_smoothing,
            source=source,
            fast_type=fast_type,
            slow_type=slow_type,
            signal_type=signal_type
        )
    
    @property
    def name(self) -> str:
        return "MACD"
    
    def calculate(self, data: pd.DataFrame) -> pd.DataFrame:
        """Calculate MACD with TradingView features"""
        self._check_data(data)
        
        source_data = self._get_source_data(data, self._params['source'])
        
        # Calculate fast and slow moving averages
        fast_ma = self._get_ma(source_data, self._params['fast_length'], self._params['fast_type'])
        slow_ma = self._get_ma(source_data, self._params['slow_length'], self._params['slow_type'])
        
        # Calculate MACD line
        macd_line = fast_ma - slow_ma
        
        # Calculate signal line
        signal_line = self._get_ma(macd_line, self._params['signal_smoothing'], self._params['signal_type'])
        
        # Calculate histogram
        histogram = macd_line - signal_line
        
        # Color coding for histogram
        histogram_color = pd.Series('gray', index=histogram.index)
        histogram_color[histogram > histogram.shift(1)] = 'lime'  # Rising
        histogram_color[histogram < histogram.shift(1)] = 'red'   # Falling
        histogram_color[histogram > 0] = 'green'  # Above zero
        histogram_color[(histogram < 0) & (histogram > histogram.shift(1))] = 'maroon'  # Below zero but rising
        
        result = pd.DataFrame({
            'MACD': macd_line,
            'Signal': signal_line,
            'Histogram': histogram,
            'Histogram_Color': histogram_color,
            'Zero_Line': 0
        })
        
        return result
    
    def _get_ma(self, data: pd.Series, length: int, ma_type: str) -> pd.Series:
        """Get moving average by type"""
        if ma_type == "sma":
            return data.rolling(window=length).mean()
        elif ma_type == "ema":
            return data.ewm(span=length, adjust=False).mean()
        elif ma_type == "wma":
            weights = np.arange(1, length + 1)
            return data.rolling(window=length).apply(
                lambda x: np.dot(x, weights) / weights.sum(), raw=True
            )
        else:
            raise IndicatorException(f"Unknown MA type: {ma_type}")
    
    def _validate_parameters(self) -> None:
        """Validate MACD parameters"""
        if self._params['fast_length'] >= self._params['slow_length']:
            raise IndicatorException("Fast length must be less than slow length")


class StochasticOscillator(OscillatorIndicator):
    """
    Stochastic Oscillator - TradingView Style
    Features: %K smoothing, %D smoothing, custom levels
    """
    
    def __init__(
        self,
        k_period: int = 14,
        k_slowing: int = 1,
        d_period: int = 3,
        d_method: str = "sma",  # sma, ema
        overbought: float = 80.0,
        oversold: float = 20.0
    ):
        super().__init__(
            k_period=k_period,
            k_slowing=k_slowing,
            d_period=d_period,
            d_method=d_method,
            overbought=overbought,
            oversold=oversold
        )
    
    @property
    def name(self) -> str:
        return "Stochastic"
    
    @property
    def overbought_level(self) -> float:
        return self._params['overbought']
    
    @property
    def oversold_level(self) -> float:
        return self._params['oversold']
    
    def calculate(self, data: pd.DataFrame) -> pd.DataFrame:
        """Calculate Stochastic with TradingView features"""
        self._check_data(data)
        
        k_period = self._params['k_period']
        
        # Calculate raw %K
        lowest_low = data['low'].rolling(window=k_period).min()
        highest_high = data['high'].rolling(window=k_period).max()
        
        raw_k = 100 * ((data['close'] - lowest_low) / (highest_high - lowest_low))
        
        # Apply %K slowing
        if self._params['k_slowing'] > 1:
            k_percent = raw_k.rolling(window=self._params['k_slowing']).mean()
        else:
            k_percent = raw_k
        
        # Calculate %D
        if self._params['d_method'] == "sma":
            d_percent = k_percent.rolling(window=self._params['d_period']).mean()
        else:  # ema
            d_percent = k_percent.ewm(span=self._params['d_period']).mean()
        
        result = pd.DataFrame({
            'K': k_percent,
            'D': d_percent,
            'Overbought': self.overbought_level,
            'Oversold': self.oversold_level
        })
        
        return result
    
    def _validate_parameters(self) -> None:
        """Validate Stochastic parameters"""
        if self._params.get('k_period', 0) < 1:
            raise IndicatorException("Stochastic K period must be positive")


class UltimateOscillator(OscillatorIndicator):
    """
    Ultimate Oscillator - TradingView Style
    Multi-timeframe momentum oscillator
    """
    
    def __init__(
        self,
        short_period: int = 7,
        medium_period: int = 14,
        long_period: int = 28,
        short_weight: float = 4.0,
        medium_weight: float = 2.0,
        long_weight: float = 1.0,
        overbought: float = 70.0,
        oversold: float = 30.0
    ):
        super().__init__(
            short_period=short_period,
            medium_period=medium_period,
            long_period=long_period,
            short_weight=short_weight,
            medium_weight=medium_weight,
            long_weight=long_weight,
            overbought=overbought,
            oversold=oversold
        )
    
    @property
    def name(self) -> str:
        return "UO"
    
    @property
    def overbought_level(self) -> float:
        return self._params['overbought']
    
    @property
    def oversold_level(self) -> float:
        return self._params['oversold']
    
    def calculate(self, data: pd.DataFrame) -> pd.DataFrame:
        """Calculate Ultimate Oscillator"""
        self._check_data(data)
        
        # Calculate True Range and Buying Pressure
        prev_close = data['close'].shift(1)
        tr1 = data['high'] - data['low']
        tr2 = np.abs(data['high'] - prev_close)
        tr3 = np.abs(data['low'] - prev_close)
        true_range = np.maximum(tr1, np.maximum(tr2, tr3))
        
        buying_pressure = data['close'] - np.minimum(data['low'], prev_close)
        
        # Calculate averages for three periods
        periods = [
            self._params['short_period'],
            self._params['medium_period'], 
            self._params['long_period']
        ]
        weights = [
            self._params['short_weight'],
            self._params['medium_weight'],
            self._params['long_weight']
        ]
        
        raw_uo_values = []
        for period in periods:
            bp_sum = buying_pressure.rolling(window=period).sum()
            tr_sum = true_range.rolling(window=period).sum()
            raw_uo_values.append(bp_sum / tr_sum)
        
        # Calculate weighted Ultimate Oscillator
        total_weight = sum(weights)
        uo = 100 * (
            (weights[0] * raw_uo_values[0] + 
             weights[1] * raw_uo_values[1] + 
             weights[2] * raw_uo_values[2]) / total_weight
        )
        
        result = pd.DataFrame({
            'UO': uo,
            'Overbought': self.overbought_level,
            'Oversold': self.oversold_level
        })
        
        return result
    
    def _validate_parameters(self) -> None:
        """Validate Ultimate Oscillator parameters"""
        periods = [
            self._params['short_period'],
            self._params['medium_period'],
            self._params['long_period']
        ]
        if not (periods[0] < periods[1] < periods[2]):
            raise IndicatorException("Periods must be in ascending order")


class AwesomeOscillator(OscillatorIndicator):
    """
    Awesome Oscillator (AO) - Bill Williams
    Features: Color coding, saucer signals
    """
    
    def __init__(
        self,
        fast_period: int = 5,
        slow_period: int = 34,
        source: RSISource = RSISource.HL2
    ):
        super().__init__(
            fast_period=fast_period,
            slow_period=slow_period,
            source=source
        )
    
    @property
    def name(self) -> str:
        return "AO"
    
    def calculate(self, data: pd.DataFrame) -> pd.DataFrame:
        """Calculate Awesome Oscillator"""
        self._check_data(data)
        
        source_data = self._get_source_data(data, self._params['source'])
        
        # Calculate SMAs
        fast_sma = source_data.rolling(window=self._params['fast_period']).mean()
        slow_sma = source_data.rolling(window=self._params['slow_period']).mean()
        
        # Calculate AO
        ao = fast_sma - slow_sma
        
        # Color coding
        ao_color = pd.Series('red', index=ao.index)
        ao_color[ao > ao.shift(1)] = 'green'
        
        # Detect saucer signals
        saucer_bull = self._detect_saucer_bull(ao)
        saucer_bear = self._detect_saucer_bear(ao)
        
        result = pd.DataFrame({
            'AO': ao,
            'AO_Color': ao_color,
            'Zero_Line': 0,
            'Saucer_Bull': saucer_bull,
            'Saucer_Bear': saucer_bear
        })
        
        return result
    
    def _detect_saucer_bull(self, ao: pd.Series) -> pd.Series:
        """Detect bullish saucer signals"""
        signals = pd.Series(False, index=ao.index)
        
        for i in range(2, len(ao)):
            if (ao.iloc[i-2] < ao.iloc[i-1] and 
                ao.iloc[i-1] < ao.iloc[i] and
                ao.iloc[i-2] < 0 and ao.iloc[i-1] < 0 and ao.iloc[i] < 0):
                signals.iloc[i] = True
        
        return signals
    
    def _detect_saucer_bear(self, ao: pd.Series) -> pd.Series:
        """Detect bearish saucer signals"""
        signals = pd.Series(False, index=ao.index)
        
        for i in range(2, len(ao)):
            if (ao.iloc[i-2] > ao.iloc[i-1] and 
                ao.iloc[i-1] > ao.iloc[i] and
                ao.iloc[i-2] > 0 and ao.iloc[i-1] > 0 and ao.iloc[i] > 0):
                signals.iloc[i] = True
        
        return signals
    
    def _validate_parameters(self) -> None:
        """Validate AO parameters"""
        if self._params['fast_period'] >= self._params['slow_period']:
            raise IndicatorException("Fast period must be less than slow period")


class AcceleratorOscillator(OscillatorIndicator):
    """
    Accelerator Oscillator (AC) - Bill Williams
    Measures acceleration/deceleration of Awesome Oscillator
    """
    
    def __init__(
        self,
        ao_fast: int = 5,
        ao_slow: int = 34,
        ac_period: int = 5,
        source: RSISource = RSISource.HL2
    ):
        super().__init__(
            ao_fast=ao_fast,
            ao_slow=ao_slow,
            ac_period=ac_period,
            source=source
        )
    
    @property 
    def name(self) -> str:
        return "AC"
    
    def calculate(self, data: pd.DataFrame) -> pd.DataFrame:
        """Calculate Accelerator Oscillator"""
        self._check_data(data)
        
        # First calculate Awesome Oscillator
        ao_indicator = AwesomeOscillator(
            self._params['ao_fast'],
            self._params['ao_slow'],
            self._params['source']
        )
        ao_result = ao_indicator.calculate(data)
        ao = ao_result['AO']
        
        # Calculate AO SMA
        ao_sma = ao.rolling(window=self._params['ac_period']).mean()
        
        # Calculate AC
        ac = ao - ao_sma
        
        # Color coding
        ac_color = pd.Series('red', index=ac.index)
        ac_color[ac > ac.shift(1)] = 'green'
        
        result = pd.DataFrame({
            'AC': ac,
            'AC_Color': ac_color,
            'Zero_Line': 0
        })
        
        return result
    
    def _validate_parameters(self) -> None:
        """Validate AC parameters"""
        if self._params['ao_fast'] >= self._params['ao_slow']:
            raise IndicatorException("AO fast period must be less than slow period")


# Add more advanced oscillators...

class TSI(OscillatorIndicator):
    """
    True Strength Index - TradingView Style
    Double smoothed momentum oscillator
    """
    
    def __init__(
        self,
        long_length: int = 25,
        short_length: int = 13,
        signal_length: int = 13,
        source: RSISource = RSISource.CLOSE
    ):
        super().__init__(
            long_length=long_length,
            short_length=short_length,
            signal_length=signal_length,
            source=source
        )
    
    @property
    def name(self) -> str:
        return "TSI"
    
    def calculate(self, data: pd.DataFrame) -> pd.DataFrame:
        """Calculate True Strength Index"""
        self._check_data(data)
        
        source_data = self._get_source_data(data, self._params['source'])
        
        # Calculate momentum
        momentum = source_data.diff()
        abs_momentum = momentum.abs()
        
        # Double smoothing
        long_len = self._params['long_length']
        short_len = self._params['short_length']
        
        # First smoothing
        smooth_momentum = momentum.ewm(span=long_len).mean()
        smooth_abs_momentum = abs_momentum.ewm(span=long_len).mean()
        
        # Second smoothing  
        double_smooth_momentum = smooth_momentum.ewm(span=short_len).mean()
        double_smooth_abs_momentum = smooth_abs_momentum.ewm(span=short_len).mean()
        
        # Calculate TSI
        tsi = 100 * (double_smooth_momentum / double_smooth_abs_momentum)
        
        # Calculate signal line
        signal = tsi.ewm(span=self._params['signal_length']).mean()
        
        result = pd.DataFrame({
            'TSI': tsi,
            'Signal': signal,
            'Zero_Line': 0,
            'Overbought': 25,
            'Oversold': -25
        })
        
        return result
    
    def _validate_parameters(self) -> None:
        """Validate TSI parameters"""
        if self._params.get('long_length', 0) < 1:
            raise IndicatorException("TSI long length must be positive")


# Add helper methods to base class
def _get_source_data(self, data: pd.DataFrame, source: RSISource) -> pd.Series:
    """Get source data based on source type"""
    if source == RSISource.CLOSE:
        return data['close']
    elif source == RSISource.OPEN:
        return data['open']
    elif source == RSISource.HIGH:
        return data['high']
    elif source == RSISource.LOW:
        return data['low']
    elif source == RSISource.HL2:
        return (data['high'] + data['low']) / 2
    elif source == RSISource.HLC3:
        return (data['high'] + data['low'] + data['close']) / 3
    elif source == RSISource.OHLC4:
        return (data['open'] + data['high'] + data['low'] + data['close']) / 4
    else:
        raise IndicatorException(f"Unknown source: {source}")

# Monkey patch the method to all oscillator classes
for cls in [RSI, MACD, StochasticOscillator, UltimateOscillator, 
            AwesomeOscillator, AcceleratorOscillator, TSI]:
    cls._get_source_data = _get_source_data