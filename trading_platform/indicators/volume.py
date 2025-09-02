"""
Volume-based indicators with TradingView-like features
Implements comprehensive volume analysis tools with custom parameters
"""

from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import pandas as pd
import numpy as np
from abc import ABC, abstractmethod

from .base import BaseIndicator
from ..domain.models import OHLCVData


class VolumeSource(Enum):
    """Volume data source options"""
    VOLUME = "volume"
    VOLUME_MA = "volume_ma"  # Moving average of volume


@dataclass
class VolumeSignal:
    """Volume-based signal"""
    timestamp: pd.Timestamp
    signal_type: str  # 'volume_spike', 'accumulation', 'distribution', etc.
    strength: float  # Signal strength 0-1
    price: float
    volume: float
    description: str


class VolumeIndicator(BaseIndicator, ABC):
    """Base class for volume-based indicators"""
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.category = "Volume"


class VolumeProfile(VolumeIndicator):
    """Volume Profile - TradingView style volume distribution"""
    
    def __init__(
        self,
        rows: int = 24,  # Number of price levels
        value_area_percent: float = 70.0,  # Value area percentage
        developing: bool = True,  # Show developing POC
        extend_poc: bool = True,  # Extend POC line
        extend_vah_val: bool = False,  # Extend VAH/VAL lines
    ):
        super().__init__()
        self.rows = rows
        self.value_area_percent = value_area_percent / 100.0
        self.developing = developing
        self.extend_poc = extend_poc
        self.extend_vah_val = extend_vah_val
        
        # Results
        self.poc_price = None  # Point of Control
        self.vah_price = None  # Value Area High
        self.val_price = None  # Value Area Low
        self.volume_profile = {}
    
    def calculate(self, data: List[OHLCVData]) -> Dict[str, Any]:
        """Calculate Volume Profile"""
        df = self._to_dataframe(data)
        if len(df) < 2:
            return self._empty_result()
        
        # Calculate price levels
        price_high = df['high'].max()
        price_low = df['low'].min()
        price_range = price_high - price_low
        level_size = price_range / self.rows
        
        # Initialize volume profile
        levels = []
        for i in range(self.rows):
            level_price = price_low + (i * level_size)
            levels.append({
                'price': level_price,
                'volume': 0.0,
                'tpo_count': 0
            })
        
        # Distribute volume across price levels
        for _, row in df.iterrows():
            # Calculate typical price for the bar
            typical_price = (row['high'] + row['low'] + row['close']) / 3
            
            # Find the appropriate level
            level_index = int((typical_price - price_low) / level_size)
            level_index = max(0, min(self.rows - 1, level_index))
            
            # Add volume to the level
            levels[level_index]['volume'] += row['volume']
            levels[level_index]['tpo_count'] += 1
        
        # Find Point of Control (highest volume level)
        poc_level = max(levels, key=lambda x: x['volume'])
        self.poc_price = poc_level['price']
        
        # Calculate Value Area
        total_volume = sum(level['volume'] for level in levels)
        target_volume = total_volume * self.value_area_percent
        
        # Sort levels by volume
        sorted_levels = sorted(levels, key=lambda x: x['volume'], reverse=True)
        
        value_area_volume = 0
        value_area_levels = []
        
        for level in sorted_levels:
            value_area_levels.append(level)
            value_area_volume += level['volume']
            
            if value_area_volume >= target_volume:
                break
        
        # Find VAH and VAL
        value_area_prices = [level['price'] for level in value_area_levels]
        self.vah_price = max(value_area_prices)
        self.val_price = min(value_area_prices)
        
        self.volume_profile = {level['price']: level['volume'] for level in levels}
        
        return {
            'poc': self.poc_price,
            'vah': self.vah_price,
            'val': self.val_price,
            'profile': self.volume_profile,
            'total_volume': total_volume
        }


class OnBalanceVolume(VolumeIndicator):
    """On Balance Volume (OBV) with TradingView features"""
    
    def __init__(
        self,
        source: str = "close",  # Price source for direction
        ma_type: str = "sma",  # Moving average type for signal line
        ma_length: int = 21,  # MA length for signal line
        show_ma: bool = False  # Show moving average signal line
    ):
        super().__init__()
        self.source = source
        self.ma_type = ma_type
        self.ma_length = ma_length
        self.show_ma = show_ma
        
        self.obv_values = []
        self.obv_ma = []
        self.signals = []
    
    def calculate(self, data: List[OHLCVData]) -> Dict[str, Any]:
        """Calculate OBV"""
        df = self._to_dataframe(data)
        if len(df) < 2:
            return self._empty_result()
        
        # Calculate OBV
        obv = [0.0]  # Start with 0
        
        for i in range(1, len(df)):
            prev_close = df.iloc[i-1]['close']
            curr_close = df.iloc[i]['close']
            volume = df.iloc[i]['volume']
            
            if curr_close > prev_close:
                obv_change = volume
            elif curr_close < prev_close:
                obv_change = -volume
            else:
                obv_change = 0
            
            obv.append(obv[-1] + obv_change)
        
        self.obv_values = obv
        
        # Calculate moving average if requested
        if self.show_ma and len(obv) >= self.ma_length:
            self.obv_ma = self._calculate_ma(obv, self.ma_length, self.ma_type)
        else:
            self.obv_ma = [None] * len(obv)
        
        # Generate signals
        self._generate_signals(df, obv)
        
        return {
            'obv': obv,
            'obv_ma': self.obv_ma,
            'signals': self.signals
        }
    
    def _generate_signals(self, df: pd.DataFrame, obv: List[float]):
        """Generate OBV signals"""
        self.signals = []
        
        if len(obv) < 20:
            return
        
        # Bullish/Bearish divergences
        for i in range(20, len(obv)):
            # Look for divergences in last 10 periods
            price_slice = df['close'].iloc[i-10:i+1]
            obv_slice = obv[i-10:i+1]
            
            # Price making higher highs but OBV making lower highs (bearish divergence)
            if (price_slice.iloc[-1] > price_slice.iloc[0] and 
                obv_slice[-1] < obv_slice[0]):
                
                self.signals.append(VolumeSignal(
                    timestamp=df.iloc[i].name,
                    signal_type='bearish_divergence',
                    strength=0.7,
                    price=df.iloc[i]['close'],
                    volume=df.iloc[i]['volume'],
                    description='OBV Bearish Divergence'
                ))
            
            # Price making lower lows but OBV making higher lows (bullish divergence)
            elif (price_slice.iloc[-1] < price_slice.iloc[0] and 
                  obv_slice[-1] > obv_slice[0]):
                
                self.signals.append(VolumeSignal(
                    timestamp=df.iloc[i].name,
                    signal_type='bullish_divergence',
                    strength=0.7,
                    price=df.iloc[i]['close'],
                    volume=df.iloc[i]['volume'],
                    description='OBV Bullish Divergence'
                ))


class VolumeWeightedAveragePrice(VolumeIndicator):
    """VWAP - Volume Weighted Average Price with bands"""
    
    def __init__(
        self,
        anchor: str = "session",  # session, week, month, auto
        source: str = "hlc3",  # Price source
        show_bands: bool = True,  # Show standard deviation bands
        stdev_mult1: float = 1.0,  # First band multiplier
        stdev_mult2: float = 2.0,  # Second band multiplier
        stdev_mult3: float = 3.0   # Third band multiplier
    ):
        super().__init__()
        self.anchor = anchor
        self.source = source
        self.show_bands = show_bands
        self.stdev_mult1 = stdev_mult1
        self.stdev_mult2 = stdev_mult2
        self.stdev_mult3 = stdev_mult3
        
        self.vwap_values = []
        self.upper_bands = [[], [], []]
        self.lower_bands = [[], [], []]
    
    def calculate(self, data: List[OHLCVData]) -> Dict[str, Any]:
        """Calculate VWAP"""
        df = self._to_dataframe(data)
        if len(df) < 1:
            return self._empty_result()
        
        # Calculate typical price based on source
        if self.source == "hlc3":
            typical_price = (df['high'] + df['low'] + df['close']) / 3
        elif self.source == "ohlc4":
            typical_price = (df['open'] + df['high'] + df['low'] + df['close']) / 4
        elif self.source == "hl2":
            typical_price = (df['high'] + df['low']) / 2
        else:  # close
            typical_price = df['close']
        
        # Calculate VWAP
        vwap = []
        cum_vol_price = 0
        cum_volume = 0
        
        # For standard deviation calculation
        sum_squared_diff = 0
        
        for i in range(len(df)):
            volume = df.iloc[i]['volume']
            price = typical_price.iloc[i]
            
            # Reset anchoring if needed
            if self._should_reset_anchor(df.index[i], df.index[i-1] if i > 0 else None):
                cum_vol_price = 0
                cum_volume = 0
                sum_squared_diff = 0
            
            cum_vol_price += price * volume
            cum_volume += volume
            
            if cum_volume > 0:
                vwap_value = cum_vol_price / cum_volume
            else:
                vwap_value = price
            
            vwap.append(vwap_value)
            
            # Calculate standard deviation for bands
            if self.show_bands and i > 0:
                # Sum of squared differences from VWAP
                sum_squared_diff += volume * (price - vwap_value) ** 2
                variance = sum_squared_diff / cum_volume if cum_volume > 0 else 0
                stdev = np.sqrt(variance)
                
                # Calculate bands
                for j, mult in enumerate([self.stdev_mult1, self.stdev_mult2, self.stdev_mult3]):
                    self.upper_bands[j].append(vwap_value + stdev * mult)
                    self.lower_bands[j].append(vwap_value - stdev * mult)
            else:
                for j in range(3):
                    self.upper_bands[j].append(None)
                    self.lower_bands[j].append(None)
        
        self.vwap_values = vwap
        
        return {
            'vwap': vwap,
            'upper1': self.upper_bands[0],
            'lower1': self.lower_bands[0],
            'upper2': self.upper_bands[1],
            'lower2': self.lower_bands[1],
            'upper3': self.upper_bands[2],
            'lower3': self.lower_bands[2]
        }
    
    def _should_reset_anchor(self, current_time, prev_time) -> bool:
        """Check if VWAP should reset based on anchor"""
        if prev_time is None:
            return True
        
        if self.anchor == "session":
            # Reset daily (simplified - in practice would check market sessions)
            return current_time.date() != prev_time.date()
        elif self.anchor == "week":
            return current_time.isocalendar()[1] != prev_time.isocalendar()[1]
        elif self.anchor == "month":
            return current_time.month != prev_time.month
        
        return False


class VolumeOscillator(VolumeIndicator):
    """Volume Oscillator - Difference between two volume moving averages"""
    
    def __init__(
        self,
        short_length: int = 5,   # Short MA period
        long_length: int = 10,   # Long MA period
        ma_type: str = "sma",    # MA type
        percentage: bool = True   # Show as percentage
    ):
        super().__init__()
        self.short_length = short_length
        self.long_length = long_length
        self.ma_type = ma_type
        self.percentage = percentage
        
        self.oscillator_values = []
        self.signal_line = []
    
    def calculate(self, data: List[OHLCVData]) -> Dict[str, Any]:
        """Calculate Volume Oscillator"""
        df = self._to_dataframe(data)
        if len(df) < max(self.short_length, self.long_length):
            return self._empty_result()
        
        volumes = df['volume'].values
        
        # Calculate moving averages
        short_ma = self._calculate_ma(volumes, self.short_length, self.ma_type)
        long_ma = self._calculate_ma(volumes, self.long_length, self.ma_type)
        
        # Calculate oscillator
        oscillator = []
        for i in range(len(volumes)):
            if i < max(self.short_length, self.long_length) - 1:
                oscillator.append(None)
            else:
                short_val = short_ma[i]
                long_val = long_ma[i]
                
                if long_val != 0:
                    if self.percentage:
                        osc_val = ((short_val - long_val) / long_val) * 100
                    else:
                        osc_val = short_val - long_val
                else:
                    osc_val = 0
                
                oscillator.append(osc_val)
        
        self.oscillator_values = oscillator
        
        # Calculate signal line (SMA of oscillator)
        valid_oscillator = [v for v in oscillator if v is not None]
        if len(valid_oscillator) >= 9:
            signal_ma = self._calculate_ma(valid_oscillator, 9, "sma")
            # Pad with None values
            padding = len(oscillator) - len(signal_ma)
            self.signal_line = [None] * padding + signal_ma
        else:
            self.signal_line = [None] * len(oscillator)
        
        return {
            'oscillator': oscillator,
            'signal': self.signal_line,
            'short_ma': short_ma,
            'long_ma': long_ma
        }


class AccumulationDistribution(VolumeIndicator):
    """Accumulation/Distribution Line with TradingView features"""
    
    def __init__(
        self,
        ma_type: str = "sma",     # Moving average type
        ma_length: int = 21,      # MA length
        show_ma: bool = False     # Show moving average
    ):
        super().__init__()
        self.ma_type = ma_type
        self.ma_length = ma_length
        self.show_ma = show_ma
        
        self.ad_values = []
        self.ad_ma = []
    
    def calculate(self, data: List[OHLCVData]) -> Dict[str, Any]:
        """Calculate A/D Line"""
        df = self._to_dataframe(data)
        if len(df) < 1:
            return self._empty_result()
        
        ad_line = [0.0]  # Start with 0
        
        for i in range(len(df)):
            high = df.iloc[i]['high']
            low = df.iloc[i]['low']
            close = df.iloc[i]['close']
            volume = df.iloc[i]['volume']
            
            # Calculate Money Flow Multiplier
            if high != low:
                mf_multiplier = ((close - low) - (high - close)) / (high - low)
            else:
                mf_multiplier = 0
            
            # Calculate Money Flow Volume
            mf_volume = mf_multiplier * volume
            
            # Add to A/D Line
            if i == 0:
                ad_value = mf_volume
            else:
                ad_value = ad_line[-1] + mf_volume
            
            ad_line.append(ad_value)
        
        # Remove the initial 0
        ad_line = ad_line[1:]
        self.ad_values = ad_line
        
        # Calculate moving average if requested
        if self.show_ma and len(ad_line) >= self.ma_length:
            self.ad_ma = self._calculate_ma(ad_line, self.ma_length, self.ma_type)
        else:
            self.ad_ma = [None] * len(ad_line)
        
        return {
            'ad': ad_line,
            'ad_ma': self.ad_ma
        }


class ChaikinMoneyFlow(VolumeIndicator):
    """Chaikin Money Flow (CMF) indicator"""
    
    def __init__(
        self,
        length: int = 21,         # CMF period
        threshold_upper: float = 0.1,  # Upper threshold
        threshold_lower: float = -0.1  # Lower threshold
    ):
        super().__init__()
        self.length = length
        self.threshold_upper = threshold_upper
        self.threshold_lower = threshold_lower
        
        self.cmf_values = []
        self.signals = []
    
    def calculate(self, data: List[OHLCVData]) -> Dict[str, Any]:
        """Calculate CMF"""
        df = self._to_dataframe(data)
        if len(df) < self.length:
            return self._empty_result()
        
        # Calculate Money Flow Volume for each period
        mf_volumes = []
        volumes = []
        
        for i in range(len(df)):
            high = df.iloc[i]['high']
            low = df.iloc[i]['low']
            close = df.iloc[i]['close']
            volume = df.iloc[i]['volume']
            
            # Calculate Money Flow Multiplier
            if high != low:
                mf_multiplier = ((close - low) - (high - close)) / (high - low)
            else:
                mf_multiplier = 0
            
            mf_volume = mf_multiplier * volume
            mf_volumes.append(mf_volume)
            volumes.append(volume)
        
        # Calculate CMF
        cmf = []
        for i in range(len(df)):
            if i < self.length - 1:
                cmf.append(None)
            else:
                # Sum of Money Flow Volume over period
                mf_sum = sum(mf_volumes[i-self.length+1:i+1])
                # Sum of Volume over period
                vol_sum = sum(volumes[i-self.length+1:i+1])
                
                if vol_sum != 0:
                    cmf_value = mf_sum / vol_sum
                else:
                    cmf_value = 0
                
                cmf.append(cmf_value)
        
        self.cmf_values = cmf
        
        # Generate signals
        self._generate_cmf_signals(df, cmf)
        
        return {
            'cmf': cmf,
            'upper_threshold': self.threshold_upper,
            'lower_threshold': self.threshold_lower,
            'signals': self.signals
        }
    
    def _generate_cmf_signals(self, df: pd.DataFrame, cmf: List[float]):
        """Generate CMF signals"""
        self.signals = []
        
        for i in range(1, len(cmf)):
            if cmf[i] is None or cmf[i-1] is None:
                continue
            
            # Strong buying pressure
            if cmf[i] > self.threshold_upper and cmf[i-1] <= self.threshold_upper:
                self.signals.append(VolumeSignal(
                    timestamp=df.iloc[i].name,
                    signal_type='strong_buying',
                    strength=min(cmf[i] / self.threshold_upper, 1.0),
                    price=df.iloc[i]['close'],
                    volume=df.iloc[i]['volume'],
                    description='Strong Buying Pressure'
                ))
            
            # Strong selling pressure
            elif cmf[i] < self.threshold_lower and cmf[i-1] >= self.threshold_lower:
                self.signals.append(VolumeSignal(
                    timestamp=df.iloc[i].name,
                    signal_type='strong_selling',
                    strength=min(abs(cmf[i]) / abs(self.threshold_lower), 1.0),
                    price=df.iloc[i]['close'],
                    volume=df.iloc[i]['volume'],
                    description='Strong Selling Pressure'
                ))


class VolumeRateOfChange(VolumeIndicator):
    """Volume Rate of Change - Momentum indicator for volume"""
    
    def __init__(
        self,
        length: int = 14,         # Period length
        threshold: float = 50.0   # Threshold for volume spike
    ):
        super().__init__()
        self.length = length
        self.threshold = threshold
        
        self.vroc_values = []
        self.signals = []
    
    def calculate(self, data: List[OHLCVData]) -> Dict[str, Any]:
        """Calculate Volume ROC"""
        df = self._to_dataframe(data)
        if len(df) < self.length + 1:
            return self._empty_result()
        
        volumes = df['volume'].values
        vroc = []
        
        for i in range(len(volumes)):
            if i < self.length:
                vroc.append(None)
            else:
                current_vol = volumes[i]
                past_vol = volumes[i - self.length]
                
                if past_vol != 0:
                    roc_value = ((current_vol - past_vol) / past_vol) * 100
                else:
                    roc_value = 0
                
                vroc.append(roc_value)
        
        self.vroc_values = vroc
        
        # Generate volume spike signals
        self._generate_vroc_signals(df, vroc)
        
        return {
            'vroc': vroc,
            'threshold': self.threshold,
            'signals': self.signals
        }
    
    def _generate_vroc_signals(self, df: pd.DataFrame, vroc: List[float]):
        """Generate Volume ROC signals"""
        self.signals = []
        
        for i, value in enumerate(vroc):
            if value is None:
                continue
            
            # Volume spike
            if value > self.threshold:
                self.signals.append(VolumeSignal(
                    timestamp=df.iloc[i].name,
                    signal_type='volume_spike',
                    strength=min(value / (self.threshold * 2), 1.0),
                    price=df.iloc[i]['close'],
                    volume=df.iloc[i]['volume'],
                    description=f'Volume Spike: {value:.1f}%'
                ))