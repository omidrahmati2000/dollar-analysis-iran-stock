"""
Support/Resistance indicators with TradingView-like features
Implements comprehensive support and resistance analysis tools
"""

from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import pandas as pd
import numpy as np
from abc import ABC, abstractmethod

from .base import BaseIndicator
from ..domain.models import OHLCVData


class LevelType(Enum):
    """Support/Resistance level types"""
    SUPPORT = "support"
    RESISTANCE = "resistance"
    PIVOT = "pivot"
    DYNAMIC = "dynamic"


class LevelStrength(Enum):
    """Level strength classification"""
    WEAK = "weak"
    MEDIUM = "medium"
    STRONG = "strong"
    VERY_STRONG = "very_strong"


@dataclass
class SupportResistanceLevel:
    """Support/Resistance level data"""
    price: float
    level_type: LevelType
    strength: LevelStrength
    touches: int  # Number of times price touched this level
    volume: float  # Average volume at this level
    first_touch: pd.Timestamp
    last_touch: pd.Timestamp
    is_broken: bool = False
    break_timestamp: Optional[pd.Timestamp] = None


class SupportResistanceIndicator(BaseIndicator, ABC):
    """Base class for support/resistance indicators"""
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.category = "Support/Resistance"


class PivotPointsStandard(SupportResistanceIndicator):
    """Standard Pivot Points - TradingView style"""
    
    def __init__(
        self,
        type_pivot: str = "traditional",  # traditional, fibonacci, woodie, camarilla, demark
        show_levels: List[str] = None,    # Which levels to show
        extend_lines: bool = True,        # Extend lines to current bar
        show_labels: bool = True          # Show level labels
    ):
        super().__init__()
        self.type_pivot = type_pivot
        self.show_levels = show_levels or ["PP", "R1", "R2", "R3", "S1", "S2", "S3"]
        self.extend_lines = extend_lines
        self.show_labels = show_labels
        
        self.pivot_levels = {}
        self.current_levels = {}
    
    def calculate(self, data: List[OHLCVData]) -> Dict[str, Any]:
        """Calculate Pivot Points"""
        df = self._to_dataframe(data)
        if len(df) < 2:
            return self._empty_result()
        
        # Group by date to calculate daily pivots
        df['date'] = df.index.date
        daily_groups = df.groupby('date')
        
        all_levels = {}
        
        for date, group in daily_groups:
            if len(group) == 0:
                continue
                
            high = group['high'].max()
            low = group['low'].min()
            close = group['close'].iloc[-1]  # Last close of the day
            
            # Calculate pivot levels based on type
            if self.type_pivot == "traditional":
                levels = self._calculate_traditional_pivots(high, low, close)
            elif self.type_pivot == "fibonacci":
                levels = self._calculate_fibonacci_pivots(high, low, close)
            elif self.type_pivot == "woodie":
                levels = self._calculate_woodie_pivots(high, low, close)
            elif self.type_pivot == "camarilla":
                levels = self._calculate_camarilla_pivots(high, low, close)
            elif self.type_pivot == "demark":
                levels = self._calculate_demark_pivots(high, low, close, group['open'].iloc[0])
            else:
                levels = self._calculate_traditional_pivots(high, low, close)
            
            all_levels[date] = levels
        
        self.pivot_levels = all_levels
        
        # Get current levels (latest date)
        if all_levels:
            latest_date = max(all_levels.keys())
            self.current_levels = all_levels[latest_date]
        
        return {
            'pivot_levels': all_levels,
            'current_levels': self.current_levels,
            'type': self.type_pivot
        }
    
    def _calculate_traditional_pivots(self, high: float, low: float, close: float) -> Dict[str, float]:
        """Calculate traditional pivot points"""
        pp = (high + low + close) / 3
        
        levels = {
            'PP': pp,
            'R1': 2 * pp - low,
            'R2': pp + (high - low),
            'R3': high + 2 * (pp - low),
            'S1': 2 * pp - high,
            'S2': pp - (high - low),
            'S3': low - 2 * (high - pp)
        }
        
        return levels
    
    def _calculate_fibonacci_pivots(self, high: float, low: float, close: float) -> Dict[str, float]:
        """Calculate Fibonacci pivot points"""
        pp = (high + low + close) / 3
        range_hl = high - low
        
        levels = {
            'PP': pp,
            'R1': pp + 0.382 * range_hl,
            'R2': pp + 0.618 * range_hl,
            'R3': pp + range_hl,
            'S1': pp - 0.382 * range_hl,
            'S2': pp - 0.618 * range_hl,
            'S3': pp - range_hl
        }
        
        return levels
    
    def _calculate_woodie_pivots(self, high: float, low: float, close: float) -> Dict[str, float]:
        """Calculate Woodie's pivot points"""
        pp = (high + low + 2 * close) / 4
        
        levels = {
            'PP': pp,
            'R1': 2 * pp - low,
            'R2': pp + high - low,
            'R3': high + 2 * (pp - low),
            'S1': 2 * pp - high,
            'S2': pp - high + low,
            'S3': low - 2 * (high - pp)
        }
        
        return levels
    
    def _calculate_camarilla_pivots(self, high: float, low: float, close: float) -> Dict[str, float]:
        """Calculate Camarilla pivot points"""
        range_hl = high - low
        
        levels = {
            'PP': close,
            'R1': close + range_hl * 1.1 / 12,
            'R2': close + range_hl * 1.1 / 6,
            'R3': close + range_hl * 1.1 / 4,
            'R4': close + range_hl * 1.1 / 2,
            'S1': close - range_hl * 1.1 / 12,
            'S2': close - range_hl * 1.1 / 6,
            'S3': close - range_hl * 1.1 / 4,
            'S4': close - range_hl * 1.1 / 2
        }
        
        return levels
    
    def _calculate_demark_pivots(self, high: float, low: float, close: float, open_price: float) -> Dict[str, float]:
        """Calculate DeMark pivot points"""
        # X calculation based on relationship between open and close
        if close < open_price:
            x = high + 2 * low + close
        elif close > open_price:
            x = 2 * high + low + close
        else:
            x = high + low + 2 * close
        
        pp = x / 4
        
        levels = {
            'PP': pp,
            'R1': x / 2 - low,
            'S1': x / 2 - high
        }
        
        return levels


class HorizontalLevels(SupportResistanceIndicator):
    """Horizontal Support/Resistance Levels Detection"""
    
    def __init__(
        self,
        lookback: int = 50,           # Lookback period for level detection
        min_touches: int = 2,         # Minimum touches to confirm level
        tolerance_percent: float = 0.1, # Price tolerance for level grouping (%)
        min_strength_distance: int = 10, # Minimum bars between strength levels
        volume_confirmation: bool = True  # Use volume for confirmation
    ):
        super().__init__()
        self.lookback = lookback
        self.min_touches = min_touches
        self.tolerance_percent = tolerance_percent / 100
        self.min_strength_distance = min_strength_distance
        self.volume_confirmation = volume_confirmation
        
        self.support_levels = []
        self.resistance_levels = []
        self.all_levels = []
    
    def calculate(self, data: List[OHLCVData]) -> Dict[str, Any]:
        """Calculate horizontal support/resistance levels"""
        df = self._to_dataframe(data)
        if len(df) < self.lookback * 2:
            return self._empty_result()
        
        # Find potential levels (local highs and lows)
        potential_levels = self._find_potential_levels(df)
        
        # Group nearby levels together
        grouped_levels = self._group_levels(potential_levels, df)
        
        # Classify levels as support or resistance
        self._classify_levels(grouped_levels, df)
        
        return {
            'support_levels': self.support_levels,
            'resistance_levels': self.resistance_levels,
            'all_levels': self.all_levels
        }
    
    def _find_potential_levels(self, df: pd.DataFrame) -> List[Tuple[float, int, str]]:
        """Find potential support/resistance levels"""
        potential_levels = []
        
        # Find local highs and lows
        for i in range(self.lookback, len(df) - self.lookback):
            current_high = df.iloc[i]['high']
            current_low = df.iloc[i]['low']
            
            # Check for local high
            is_local_high = True
            for j in range(max(0, i - self.lookback), min(len(df), i + self.lookback + 1)):
                if j != i and df.iloc[j]['high'] > current_high:
                    is_local_high = False
                    break
            
            if is_local_high:
                potential_levels.append((current_high, i, 'resistance'))
            
            # Check for local low
            is_local_low = True
            for j in range(max(0, i - self.lookback), min(len(df), i + self.lookback + 1)):
                if j != i and df.iloc[j]['low'] < current_low:
                    is_local_low = False
                    break
            
            if is_local_low:
                potential_levels.append((current_low, i, 'support'))
        
        return potential_levels
    
    def _group_levels(self, potential_levels: List[Tuple[float, int, str]], df: pd.DataFrame) -> List[SupportResistanceLevel]:
        """Group nearby levels together"""
        if not potential_levels:
            return []
        
        # Sort by price
        potential_levels.sort(key=lambda x: x[0])
        
        grouped = []
        current_group = [potential_levels[0]]
        
        for i in range(1, len(potential_levels)):
            price, index, level_type = potential_levels[i]
            last_price = current_group[-1][0]
            
            # Check if within tolerance
            if abs(price - last_price) / last_price <= self.tolerance_percent:
                current_group.append(potential_levels[i])
            else:
                # Process current group
                if len(current_group) >= self.min_touches:
                    level = self._create_level_from_group(current_group, df)
                    grouped.append(level)
                
                current_group = [potential_levels[i]]
        
        # Process last group
        if len(current_group) >= self.min_touches:
            level = self._create_level_from_group(current_group, df)
            grouped.append(level)
        
        return grouped
    
    def _create_level_from_group(self, group: List[Tuple[float, int, str]], df: pd.DataFrame) -> SupportResistanceLevel:
        """Create support/resistance level from group of touches"""
        prices = [item[0] for item in group]
        indices = [item[1] for item in group]
        types = [item[2] for item in group]
        
        # Calculate average price
        avg_price = np.mean(prices)
        
        # Determine level type (majority vote)
        level_type = LevelType.SUPPORT if types.count('support') > types.count('resistance') else LevelType.RESISTANCE
        
        # Calculate strength based on touches and volume
        touches = len(group)
        strength = self._calculate_strength(touches, indices, df)
        
        # Calculate average volume at this level
        volumes = [df.iloc[idx]['volume'] for idx in indices if idx < len(df)]
        avg_volume = np.mean(volumes) if volumes else 0
        
        # Get timestamps
        timestamps = [df.index[idx] for idx in indices if idx < len(df)]
        first_touch = min(timestamps) if timestamps else df.index[0]
        last_touch = max(timestamps) if timestamps else df.index[-1]
        
        return SupportResistanceLevel(
            price=avg_price,
            level_type=level_type,
            strength=strength,
            touches=touches,
            volume=avg_volume,
            first_touch=first_touch,
            last_touch=last_touch
        )
    
    def _calculate_strength(self, touches: int, indices: List[int], df: pd.DataFrame) -> LevelStrength:
        """Calculate level strength"""
        # Base strength on number of touches
        if touches >= 5:
            return LevelStrength.VERY_STRONG
        elif touches >= 4:
            return LevelStrength.STRONG
        elif touches >= 3:
            return LevelStrength.MEDIUM
        else:
            return LevelStrength.WEAK
    
    def _classify_levels(self, levels: List[SupportResistanceLevel], df: pd.DataFrame):
        """Classify levels into support and resistance"""
        self.support_levels = []
        self.resistance_levels = []
        self.all_levels = levels
        
        for level in levels:
            if level.level_type == LevelType.SUPPORT:
                self.support_levels.append(level)
            else:
                self.resistance_levels.append(level)


class DynamicLevels(SupportResistanceIndicator):
    """Dynamic Support/Resistance using moving averages"""
    
    def __init__(
        self,
        ma_periods: List[int] = [20, 50, 100, 200],  # MA periods to use as dynamic levels
        ma_type: str = "sma",                        # MA type
        show_as_levels: bool = True,                 # Show as horizontal levels vs lines
        level_extension: int = 10                    # Bars to extend levels
    ):
        super().__init__()
        self.ma_periods = ma_periods
        self.ma_type = ma_type
        self.show_as_levels = show_as_levels
        self.level_extension = level_extension
        
        self.dynamic_levels = {}
        self.current_levels = []
    
    def calculate(self, data: List[OHLCVData]) -> Dict[str, Any]:
        """Calculate dynamic support/resistance levels"""
        df = self._to_dataframe(data)
        if len(df) < max(self.ma_periods):
            return self._empty_result()
        
        # Calculate moving averages
        mas = {}
        for period in self.ma_periods:
            ma_values = self._calculate_ma(df['close'].values, period, self.ma_type)
            mas[f"MA{period}"] = ma_values
        
        self.dynamic_levels = mas
        
        # Get current levels (last values)
        current_levels = []
        for name, values in mas.items():
            if values and values[-1] is not None:
                # Determine if acting as support or resistance
                current_price = df['close'].iloc[-1]
                level_price = values[-1]
                
                if current_price > level_price:
                    level_type = LevelType.SUPPORT
                else:
                    level_type = LevelType.RESISTANCE
                
                current_levels.append({
                    'name': name,
                    'price': level_price,
                    'type': level_type,
                    'values': values
                })
        
        self.current_levels = current_levels
        
        return {
            'dynamic_levels': mas,
            'current_levels': current_levels
        }


class FibonacciRetracement(SupportResistanceIndicator):
    """Fibonacci Retracement Levels - TradingView style"""
    
    def __init__(
        self,
        show_levels: List[float] = None,      # Which Fibonacci levels to show
        extend_lines: bool = True,            # Extend lines
        show_labels: bool = True,             # Show level labels
        use_log_scale: bool = False,          # Use logarithmic scale
        trend_based: bool = True              # Automatically detect trend for levels
    ):
        super().__init__()
        self.show_levels = show_levels or [0.0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0]
        self.extend_lines = extend_lines
        self.show_labels = show_labels
        self.use_log_scale = use_log_scale
        self.trend_based = trend_based
        
        self.fib_levels = {}
        self.swing_high = None
        self.swing_low = None
    
    def calculate(self, data: List[OHLCVData]) -> Dict[str, Any]:
        """Calculate Fibonacci retracement levels"""
        df = self._to_dataframe(data)
        if len(df) < 20:
            return self._empty_result()
        
        # Find significant swing high and low
        swing_points = self._find_swing_points(df)
        
        if not swing_points:
            return self._empty_result()
        
        self.swing_high = swing_points['high']
        self.swing_low = swing_points['low']
        
        # Calculate Fibonacci levels
        high_price = self.swing_high['price']
        low_price = self.swing_low['price']
        
        if self.use_log_scale:
            # Logarithmic Fibonacci levels
            log_high = np.log(high_price)
            log_low = np.log(low_price)
            log_diff = log_high - log_low
            
            levels = {}
            for fib_ratio in self.show_levels:
                level_log = log_high - (fib_ratio * log_diff)
                levels[f"{fib_ratio:.3f}"] = np.exp(level_log)
        else:
            # Linear Fibonacci levels
            diff = high_price - low_price
            
            levels = {}
            for fib_ratio in self.show_levels:
                level_price = high_price - (fib_ratio * diff)
                levels[f"{fib_ratio:.3f}"] = level_price
        
        self.fib_levels = levels
        
        return {
            'fib_levels': levels,
            'swing_high': self.swing_high,
            'swing_low': self.swing_low,
            'range': high_price - low_price
        }
    
    def _find_swing_points(self, df: pd.DataFrame) -> Optional[Dict[str, Any]]:
        """Find significant swing high and low points"""
        lookback = min(50, len(df) // 4)
        
        if len(df) < lookback * 2:
            return None
        
        # Find recent significant high and low
        recent_data = df.iloc[-lookback:]
        
        swing_high_idx = recent_data['high'].idxmax()
        swing_low_idx = recent_data['low'].idxmin()
        
        swing_high = {
            'price': df.loc[swing_high_idx, 'high'],
            'timestamp': swing_high_idx,
            'index': df.index.get_loc(swing_high_idx)
        }
        
        swing_low = {
            'price': df.loc[swing_low_idx, 'low'],
            'timestamp': swing_low_idx,
            'index': df.index.get_loc(swing_low_idx)
        }
        
        return {'high': swing_high, 'low': swing_low}


class VolumeProfile(SupportResistanceIndicator):
    """Volume Profile for Support/Resistance identification"""
    
    def __init__(
        self,
        rows: int = 24,                    # Number of price levels
        value_area_percent: float = 70.0,   # Value area percentage
        poc_extension: bool = True,         # Extend POC as support/resistance
        vah_val_extension: bool = True,     # Extend VAH/VAL as support/resistance
        min_volume_threshold: float = 0.05  # Minimum volume threshold for level
    ):
        super().__init__()
        self.rows = rows
        self.value_area_percent = value_area_percent / 100
        self.poc_extension = poc_extension
        self.vah_val_extension = vah_val_extension
        self.min_volume_threshold = min_volume_threshold
        
        self.volume_levels = []
        self.poc_level = None
        self.vah_level = None
        self.val_level = None
    
    def calculate(self, data: List[OHLCVData]) -> Dict[str, Any]:
        """Calculate Volume Profile levels"""
        df = self._to_dataframe(data)
        if len(df) < 10:
            return self._empty_result()
        
        # Calculate price range
        price_high = df['high'].max()
        price_low = df['low'].min()
        price_range = price_high - price_low
        level_size = price_range / self.rows
        
        # Initialize volume levels
        volume_levels = []
        for i in range(self.rows):
            level_price = price_low + (i * level_size) + (level_size / 2)  # Middle of level
            volume_levels.append({
                'price': level_price,
                'volume': 0.0,
                'low_bound': price_low + (i * level_size),
                'high_bound': price_low + ((i + 1) * level_size)
            })
        
        # Distribute volume across levels
        total_volume = 0
        for _, row in df.iterrows():
            bar_volume = row['volume']
            total_volume += bar_volume
            
            # Distribute volume based on price action within the bar
            high = row['high']
            low = row['low']
            
            # Find overlapping levels
            for level in volume_levels:
                # Calculate overlap between bar range and level range
                overlap_low = max(low, level['low_bound'])
                overlap_high = min(high, level['high_bound'])
                
                if overlap_high > overlap_low:
                    # Proportional volume distribution
                    overlap_ratio = (overlap_high - overlap_low) / (high - low) if high != low else 1.0
                    level['volume'] += bar_volume * overlap_ratio
        
        # Normalize volumes and filter significant levels
        if total_volume > 0:
            significant_levels = []
            for level in volume_levels:
                volume_ratio = level['volume'] / total_volume
                if volume_ratio >= self.min_volume_threshold:
                    significant_levels.append({
                        'price': level['price'],
                        'volume': level['volume'],
                        'volume_ratio': volume_ratio,
                        'strength': self._calculate_volume_strength(volume_ratio)
                    })
        
        # Sort by volume (descending)
        significant_levels.sort(key=lambda x: x['volume'], reverse=True)
        
        # Identify key levels
        if significant_levels:
            # Point of Control (highest volume)
            self.poc_level = significant_levels[0]
            
            # Calculate Value Area High and Low
            target_volume = total_volume * self.value_area_percent
            current_volume = 0
            value_area_levels = []
            
            for level in significant_levels:
                value_area_levels.append(level)
                current_volume += level['volume']
                
                if current_volume >= target_volume:
                    break
            
            if value_area_levels:
                value_area_prices = [level['price'] for level in value_area_levels]
                self.vah_level = {'price': max(value_area_prices), 'volume': 0}
                self.val_level = {'price': min(value_area_prices), 'volume': 0}
        
        self.volume_levels = significant_levels
        
        return {
            'volume_levels': significant_levels,
            'poc': self.poc_level,
            'vah': self.vah_level,
            'val': self.val_level,
            'total_volume': total_volume
        }
    
    def _calculate_volume_strength(self, volume_ratio: float) -> LevelStrength:
        """Calculate strength based on volume ratio"""
        if volume_ratio >= 0.15:
            return LevelStrength.VERY_STRONG
        elif volume_ratio >= 0.10:
            return LevelStrength.STRONG
        elif volume_ratio >= 0.07:
            return LevelStrength.MEDIUM
        else:
            return LevelStrength.WEAK