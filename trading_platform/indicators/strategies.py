"""
Indicator Combination Strategies - TradingView-like strategy builder
Combines multiple indicators to create comprehensive trading strategies
"""

from typing import Dict, List, Any, Optional, Callable, Union, Tuple
from dataclasses import dataclass
from enum import Enum
import pandas as pd
import numpy as np
from abc import ABC, abstractmethod

from .factory import IndicatorFactory
from ..domain.models import OHLCVData


class SignalType(Enum):
    """Trading signal types"""
    BUY = "buy"
    SELL = "sell"
    STRONG_BUY = "strong_buy"
    STRONG_SELL = "strong_sell"
    HOLD = "hold"
    NEUTRAL = "neutral"


class ConfirmationType(Enum):
    """Signal confirmation types"""
    ALL_MUST_AGREE = "all_must_agree"
    MAJORITY_VOTE = "majority_vote"
    ANY_TRIGGER = "any_trigger"
    WEIGHTED_AVERAGE = "weighted_average"


@dataclass
class StrategySignal:
    """Trading strategy signal"""
    timestamp: pd.Timestamp
    signal: SignalType
    strength: float  # 0.0 to 1.0
    price: float
    contributing_indicators: List[str]
    description: str
    metadata: Dict[str, Any] = None


@dataclass
class IndicatorWeight:
    """Weight configuration for indicators in strategy"""
    indicator_name: str
    weight: float
    required: bool = False  # Must participate in signal


class TradingStrategy(ABC):
    """Base class for trading strategies"""
    
    def __init__(self, name: str, description: str):
        self.name = name
        self.description = description
        self.indicators = {}
        self.factory = IndicatorFactory()
        self.signals = []
    
    @abstractmethod
    def calculate_signals(self, data: List[OHLCVData]) -> List[StrategySignal]:
        """Calculate trading signals based on indicator combination"""
        pass
    
    def add_indicator(self, name: str, indicator_type: str, **params):
        """Add an indicator to the strategy"""
        indicator = self.factory.create_indicator(indicator_type, **params)
        self.indicators[name] = indicator
        return self
    
    def get_indicator_signals(self, data: List[OHLCVData]) -> Dict[str, Any]:
        """Get signals from all indicators"""
        results = {}
        for name, indicator in self.indicators.items():
            try:
                result = indicator.calculate(data)
                results[name] = result
            except Exception as e:
                print(f"Error calculating {name}: {e}")
                results[name] = None
        return results


class MovingAverageCrossoverStrategy(TradingStrategy):
    """Moving Average Crossover Strategy"""
    
    def __init__(
        self,
        fast_period: int = 9,
        slow_period: int = 21,
        confirmation_period: int = 5,
        use_volume_confirmation: bool = True
    ):
        super().__init__(
            "Moving Average Crossover",
            "Buy when fast MA crosses above slow MA, sell when opposite"
        )
        
        self.fast_period = fast_period
        self.slow_period = slow_period
        self.confirmation_period = confirmation_period
        self.use_volume_confirmation = use_volume_confirmation
        
        # Add indicators
        self.add_indicator("fast_ma", "EMA", period=fast_period)
        self.add_indicator("slow_ma", "EMA", period=slow_period)
        
        if use_volume_confirmation:
            self.add_indicator("volume_sma", "SMA", period=20)  # Volume needs different implementation
    
    def calculate_signals(self, data: List[OHLCVData]) -> List[StrategySignal]:
        """Calculate MA crossover signals"""
        if len(data) < max(self.fast_period, self.slow_period) + 10:
            return []
        
        indicator_data = self.get_indicator_signals(data)
        if not indicator_data.get("fast_ma") or not indicator_data.get("slow_ma"):
            return []
        
        fast_ma = indicator_data["fast_ma"]["values"]
        slow_ma = indicator_data["slow_ma"]["values"]
        
        df = pd.DataFrame([{
            'timestamp': item.timestamp,
            'open': item.open_price,
            'high': item.high_price,
            'low': item.low_price,
            'close': item.close_price,
            'volume': item.volume
        } for item in data])
        
        signals = []
        
        for i in range(max(self.fast_period, self.slow_period), len(fast_ma)):
            if fast_ma[i] is None or slow_ma[i] is None:
                continue
            
            # Check for crossover
            current_fast = fast_ma[i]
            current_slow = slow_ma[i]
            prev_fast = fast_ma[i-1]
            prev_slow = slow_ma[i-1]
            
            if prev_fast is None or prev_slow is None:
                continue
            
            # Bullish crossover (fast MA crosses above slow MA)
            if current_fast > current_slow and prev_fast <= prev_slow:
                strength = self._calculate_crossover_strength(
                    fast_ma[i-self.confirmation_period:i+1],
                    slow_ma[i-self.confirmation_period:i+1],
                    df.iloc[i-self.confirmation_period:i+1] if self.use_volume_confirmation else None
                )
                
                signal_type = SignalType.STRONG_BUY if strength > 0.7 else SignalType.BUY
                
                signals.append(StrategySignal(
                    timestamp=df.iloc[i]['timestamp'],
                    signal=signal_type,
                    strength=strength,
                    price=df.iloc[i]['close'],
                    contributing_indicators=['fast_ma', 'slow_ma'],
                    description=f"Bullish MA crossover (EMA{self.fast_period} > EMA{self.slow_period})"
                ))
            
            # Bearish crossover (fast MA crosses below slow MA)
            elif current_fast < current_slow and prev_fast >= prev_slow:
                strength = self._calculate_crossover_strength(
                    fast_ma[i-self.confirmation_period:i+1],
                    slow_ma[i-self.confirmation_period:i+1],
                    df.iloc[i-self.confirmation_period:i+1] if self.use_volume_confirmation else None
                )
                
                signal_type = SignalType.STRONG_SELL if strength > 0.7 else SignalType.SELL
                
                signals.append(StrategySignal(
                    timestamp=df.iloc[i]['timestamp'],
                    signal=signal_type,
                    strength=strength,
                    price=df.iloc[i]['close'],
                    contributing_indicators=['fast_ma', 'slow_ma'],
                    description=f"Bearish MA crossover (EMA{self.fast_period} < EMA{self.slow_period})"
                ))
        
        return signals
    
    def _calculate_crossover_strength(self, fast_values: List[float], 
                                    slow_values: List[float], 
                                    volume_data: Optional[pd.DataFrame] = None) -> float:
        """Calculate the strength of the crossover signal"""
        if len(fast_values) < 2 or len(slow_values) < 2:
            return 0.5
        
        # Base strength on MA separation
        current_separation = abs(fast_values[-1] - slow_values[-1])
        max_separation = max(abs(f - s) for f, s in zip(fast_values, slow_values))
        separation_strength = current_separation / max_separation if max_separation > 0 else 0.5
        
        # Add volume confirmation if available
        volume_strength = 0.5
        if volume_data is not None and len(volume_data) >= 2:
            current_volume = volume_data.iloc[-1]['volume']
            avg_volume = volume_data['volume'].mean()
            volume_strength = min(current_volume / avg_volume, 2.0) / 2.0 if avg_volume > 0 else 0.5
        
        # Combine strengths
        total_strength = (separation_strength * 0.7) + (volume_strength * 0.3)
        return min(max(total_strength, 0.1), 1.0)


class RSIMACDStrategy(TradingStrategy):
    """RSI + MACD Combination Strategy"""
    
    def __init__(
        self,
        rsi_period: int = 14,
        rsi_overbought: float = 70,
        rsi_oversold: float = 30,
        macd_fast: int = 12,
        macd_slow: int = 26,
        macd_signal: int = 9
    ):
        super().__init__(
            "RSI + MACD Strategy",
            "Combines RSI momentum with MACD trend confirmation"
        )
        
        self.rsi_overbought = rsi_overbought
        self.rsi_oversold = rsi_oversold
        
        # Add indicators
        self.add_indicator("rsi", "RSI", length=rsi_period, overbought=rsi_overbought, oversold=rsi_oversold)
        self.add_indicator("macd", "MACD", fast_length=macd_fast, slow_length=macd_slow, signal_length=macd_signal)
    
    def calculate_signals(self, data: List[OHLCVData]) -> List[StrategySignal]:
        """Calculate RSI + MACD combination signals"""
        indicator_data = self.get_indicator_signals(data)
        
        if not indicator_data.get("rsi") or not indicator_data.get("macd"):
            return []
        
        rsi_values = indicator_data["rsi"]["values"]
        macd_values = indicator_data["macd"]["macd"]
        macd_signal = indicator_data["macd"]["signal"]
        macd_histogram = indicator_data["macd"]["histogram"]
        
        df = pd.DataFrame([{
            'timestamp': item.timestamp,
            'close': item.close_price
        } for item in data])
        
        signals = []
        
        for i in range(26, len(rsi_values)):  # Start after MACD warmup
            if (rsi_values[i] is None or macd_values[i] is None or 
                macd_signal[i] is None or i == 0):
                continue
            
            rsi_current = rsi_values[i]
            rsi_prev = rsi_values[i-1]
            macd_current = macd_values[i]
            macd_signal_current = macd_signal[i]
            macd_hist_current = macd_histogram[i]
            macd_hist_prev = macd_histogram[i-1] if i > 0 else 0
            
            # Bullish signals
            if (rsi_current > self.rsi_oversold and rsi_prev <= self.rsi_oversold and  # RSI leaving oversold
                macd_current > macd_signal_current and  # MACD above signal
                macd_hist_current > macd_hist_prev):  # MACD histogram increasing
                
                strength = self._calculate_momentum_strength(
                    rsi_current, macd_hist_current, True
                )
                
                signals.append(StrategySignal(
                    timestamp=df.iloc[i]['timestamp'],
                    signal=SignalType.BUY,
                    strength=strength,
                    price=df.iloc[i]['close'],
                    contributing_indicators=['rsi', 'macd'],
                    description="RSI recovery from oversold + MACD bullish momentum"
                ))
            
            # Bearish signals
            elif (rsi_current < self.rsi_overbought and rsi_prev >= self.rsi_overbought and  # RSI leaving overbought
                  macd_current < macd_signal_current and  # MACD below signal
                  macd_hist_current < macd_hist_prev):  # MACD histogram decreasing
                
                strength = self._calculate_momentum_strength(
                    rsi_current, macd_hist_current, False
                )
                
                signals.append(StrategySignal(
                    timestamp=df.iloc[i]['timestamp'],
                    signal=SignalType.SELL,
                    strength=strength,
                    price=df.iloc[i]['close'],
                    contributing_indicators=['rsi', 'macd'],
                    description="RSI decline from overbought + MACD bearish momentum"
                ))
        
        return signals
    
    def _calculate_momentum_strength(self, rsi_value: float, macd_hist: float, is_bullish: bool) -> float:
        """Calculate momentum signal strength"""
        # RSI strength (distance from extreme)
        if is_bullish:
            rsi_strength = (50 - rsi_value) / (50 - self.rsi_oversold) if rsi_value < 50 else 0.5
        else:
            rsi_strength = (rsi_value - 50) / (self.rsi_overbought - 50) if rsi_value > 50 else 0.5
        
        # MACD histogram strength
        macd_strength = min(abs(macd_hist) / 2.0, 1.0)  # Normalize MACD histogram
        
        # Combine
        total_strength = (rsi_strength * 0.6) + (macd_strength * 0.4)
        return min(max(total_strength, 0.1), 1.0)


class BollingerBandsMeanReversionStrategy(TradingStrategy):
    """Bollinger Bands Mean Reversion Strategy with RSI confirmation"""
    
    def __init__(
        self,
        bb_period: int = 20,
        bb_std_dev: float = 2.0,
        rsi_period: int = 14,
        rsi_extreme_threshold: float = 80  # For extreme readings
    ):
        super().__init__(
            "Bollinger Bands Mean Reversion",
            "Mean reversion strategy using Bollinger Bands with RSI confirmation"
        )
        
        self.rsi_extreme_threshold = rsi_extreme_threshold
        
        # Add indicators
        self.add_indicator("bb", "BOLLINGER", period=bb_period, std_dev=bb_std_dev)
        self.add_indicator("rsi", "RSI", length=rsi_period)
    
    def calculate_signals(self, data: List[OHLCVData]) -> List[StrategySignal]:
        """Calculate mean reversion signals"""
        indicator_data = self.get_indicator_signals(data)
        
        if not indicator_data.get("bb") or not indicator_data.get("rsi"):
            return []
        
        bb_upper = indicator_data["bb"]["upper"]
        bb_lower = indicator_data["bb"]["lower"]
        bb_middle = indicator_data["bb"]["middle"]
        rsi_values = indicator_data["rsi"]["values"]
        
        df = pd.DataFrame([{
            'timestamp': item.timestamp,
            'high': item.high_price,
            'low': item.low_price,
            'close': item.close_price
        } for item in data])
        
        signals = []
        
        for i in range(20, len(bb_upper)):  # Start after BB warmup
            if (bb_upper[i] is None or bb_lower[i] is None or 
                bb_middle[i] is None or rsi_values[i] is None):
                continue
            
            close_price = df.iloc[i]['close']
            high_price = df.iloc[i]['high']
            low_price = df.iloc[i]['low']
            rsi_current = rsi_values[i]
            
            # Bullish mean reversion (price touches lower band + RSI oversold)
            if (low_price <= bb_lower[i] and 
                rsi_current < (100 - self.rsi_extreme_threshold) and
                close_price > bb_lower[i]):  # Closed back above lower band
                
                strength = self._calculate_mean_reversion_strength(
                    close_price, bb_lower[i], bb_upper[i], bb_middle[i], 
                    rsi_current, True
                )
                
                signals.append(StrategySignal(
                    timestamp=df.iloc[i]['timestamp'],
                    signal=SignalType.BUY,
                    strength=strength,
                    price=close_price,
                    contributing_indicators=['bb', 'rsi'],
                    description="Bollinger Band lower touch + RSI oversold"
                ))
            
            # Bearish mean reversion (price touches upper band + RSI overbought)
            elif (high_price >= bb_upper[i] and 
                  rsi_current > self.rsi_extreme_threshold and
                  close_price < bb_upper[i]):  # Closed back below upper band
                
                strength = self._calculate_mean_reversion_strength(
                    close_price, bb_upper[i], bb_lower[i], bb_middle[i], 
                    rsi_current, False
                )
                
                signals.append(StrategySignal(
                    timestamp=df.iloc[i]['timestamp'],
                    signal=SignalType.SELL,
                    strength=strength,
                    price=close_price,
                    contributing_indicators=['bb', 'rsi'],
                    description="Bollinger Band upper touch + RSI overbought"
                ))
        
        return signals
    
    def _calculate_mean_reversion_strength(self, price: float, band: float, 
                                         opposite_band: float, middle: float,
                                         rsi: float, is_bullish: bool) -> float:
        """Calculate mean reversion signal strength"""
        # Distance from band
        band_range = abs(opposite_band - band)
        if band_range == 0:
            return 0.5
            
        band_penetration = abs(price - band) / band_range
        
        # RSI extremeness
        if is_bullish:
            rsi_strength = (30 - rsi) / 30 if rsi < 30 else 0.5
        else:
            rsi_strength = (rsi - 70) / 30 if rsi > 70 else 0.5
        
        # Combine
        total_strength = (band_penetration * 0.4) + (rsi_strength * 0.6)
        return min(max(total_strength, 0.1), 1.0)


class MultiTimeframeStrategy(TradingStrategy):
    """Multi-timeframe strategy combining different timeframe signals"""
    
    def __init__(self):
        super().__init__(
            "Multi-Timeframe Strategy",
            "Combines signals from multiple timeframes for confirmation"
        )
        
        # This would need different data feeds for different timeframes
        # Simplified implementation for demonstration
        self.add_indicator("fast_ma", "EMA", period=9)
        self.add_indicator("slow_ma", "EMA", period=21)
        self.add_indicator("rsi", "RSI", length=14)
        self.add_indicator("macd", "MACD", fast_length=12, slow_length=26, signal_length=9)
    
    def calculate_signals(self, data: List[OHLCVData]) -> List[StrategySignal]:
        """Calculate multi-timeframe signals"""
        # This is a simplified version - in practice would need multiple timeframe data
        indicator_data = self.get_indicator_signals(data)
        
        # Combine multiple strategies
        ma_strategy = MovingAverageCrossoverStrategy()
        rsi_macd_strategy = RSIMACDStrategy()
        
        ma_signals = ma_strategy.calculate_signals(data)
        momentum_signals = rsi_macd_strategy.calculate_signals(data)
        
        # Combine signals (simplified consensus)
        combined_signals = []
        
        # Look for confluence of signals
        for ma_signal in ma_signals:
            for momentum_signal in momentum_signals:
                time_diff = abs((ma_signal.timestamp - momentum_signal.timestamp).total_seconds())
                
                # If signals are within 1 hour and same direction
                if (time_diff <= 3600 and 
                    self._signals_agree(ma_signal.signal, momentum_signal.signal)):
                    
                    combined_strength = (ma_signal.strength + momentum_signal.strength) / 2
                    
                    combined_signals.append(StrategySignal(
                        timestamp=ma_signal.timestamp,
                        signal=ma_signal.signal,
                        strength=min(combined_strength * 1.2, 1.0),  # Boost confidence
                        price=ma_signal.price,
                        contributing_indicators=['moving_averages', 'momentum_oscillators'],
                        description=f"Multi-strategy confluence: {ma_signal.description} + {momentum_signal.description}"
                    ))
        
        return combined_signals
    
    def _signals_agree(self, signal1: SignalType, signal2: SignalType) -> bool:
        """Check if two signals agree in direction"""
        bullish_signals = [SignalType.BUY, SignalType.STRONG_BUY]
        bearish_signals = [SignalType.SELL, SignalType.STRONG_SELL]
        
        return ((signal1 in bullish_signals and signal2 in bullish_signals) or
                (signal1 in bearish_signals and signal2 in bearish_signals))


class StrategyManager:
    """Manager for creating and running trading strategies"""
    
    def __init__(self):
        self.strategies = {}
        self._register_default_strategies()
    
    def _register_default_strategies(self):
        """Register built-in strategies"""
        self.strategies['ma_crossover'] = MovingAverageCrossoverStrategy
        self.strategies['rsi_macd'] = RSIMACDStrategy
        self.strategies['bb_mean_reversion'] = BollingerBandsMeanReversionStrategy
        self.strategies['multi_timeframe'] = MultiTimeframeStrategy
    
    def create_strategy(self, strategy_name: str, **params) -> TradingStrategy:
        """Create a strategy instance"""
        if strategy_name not in self.strategies:
            available = ', '.join(self.strategies.keys())
            raise ValueError(f"Unknown strategy '{strategy_name}'. Available: {available}")
        
        strategy_class = self.strategies[strategy_name]
        return strategy_class(**params)
    
    def register_custom_strategy(self, name: str, strategy_class):
        """Register a custom strategy"""
        if not issubclass(strategy_class, TradingStrategy):
            raise ValueError("Strategy must inherit from TradingStrategy")
        
        self.strategies[name] = strategy_class
    
    def get_available_strategies(self) -> List[str]:
        """Get list of available strategies"""
        return list(self.strategies.keys())
    
    def run_strategy_backtest(self, strategy: TradingStrategy, 
                            data: List[OHLCVData]) -> Dict[str, Any]:
        """Run simple backtest on strategy"""
        signals = strategy.calculate_signals(data)
        
        if not signals:
            return {
                'total_signals': 0,
                'buy_signals': 0,
                'sell_signals': 0,
                'avg_strength': 0
            }
        
        buy_signals = [s for s in signals if s.signal in [SignalType.BUY, SignalType.STRONG_BUY]]
        sell_signals = [s for s in signals if s.signal in [SignalType.SELL, SignalType.STRONG_SELL]]
        
        avg_strength = sum(s.strength for s in signals) / len(signals)
        
        return {
            'total_signals': len(signals),
            'buy_signals': len(buy_signals),
            'sell_signals': len(sell_signals),
            'avg_strength': avg_strength,
            'signals': signals,
            'strategy_name': strategy.name
        }