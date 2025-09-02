"""
Signal Service - Manages trading signals from indicators
Handles signal generation, filtering, and alert management
"""

from typing import Dict, List, Any, Optional, Callable, Set
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timedelta
import threading
import json

from ..core.events import EventBus, Event
from ..indicators.strategies import StrategySignal, SignalType
from .indicator_service import IndicatorService


class AlertType(Enum):
    """Alert notification types"""
    POPUP = "popup"
    EMAIL = "email"
    SOUND = "sound"
    LOG = "log"


class SignalStrength(Enum):
    """Signal strength classification"""
    WEAK = "weak"          # 0.0 - 0.3
    MEDIUM = "medium"      # 0.3 - 0.6
    STRONG = "strong"      # 0.6 - 0.8
    VERY_STRONG = "very_strong"  # 0.8 - 1.0


@dataclass
class SignalAlert:
    """Alert configuration for signals"""
    name: str
    signal_types: List[SignalType]
    min_strength: float = 0.5
    indicators: List[str] = field(default_factory=list)  # Filter by indicators
    symbols: List[str] = field(default_factory=list)     # Filter by symbols
    alert_types: List[AlertType] = field(default_factory=lambda: [AlertType.POPUP])
    enabled: bool = True
    cooldown_minutes: int = 5  # Minimum time between similar alerts


@dataclass
class ProcessedSignal:
    """Processed signal with metadata"""
    signal: StrategySignal
    strength_category: SignalStrength
    symbol: str
    indicator_name: str
    processed_time: datetime
    alerted: bool = False
    alert_types_sent: List[AlertType] = field(default_factory=list)


class SignalFilter:
    """Filter for signal processing"""
    
    def __init__(self):
        self.min_strength: float = 0.0
        self.max_strength: float = 1.0
        self.allowed_signal_types: Set[SignalType] = set()
        self.allowed_indicators: Set[str] = set()
        self.allowed_symbols: Set[str] = set()
        self.time_range: Optional[tuple] = None  # (start_time, end_time)
    
    def matches(self, signal: ProcessedSignal) -> bool:
        """Check if signal matches filter criteria"""
        # Strength check
        if not (self.min_strength <= signal.signal.strength <= self.max_strength):
            return False
        
        # Signal type check
        if self.allowed_signal_types and signal.signal.signal not in self.allowed_signal_types:
            return False
        
        # Indicator check
        if self.allowed_indicators and signal.indicator_name not in self.allowed_indicators:
            return False
        
        # Symbol check
        if self.allowed_symbols and signal.symbol not in self.allowed_symbols:
            return False
        
        # Time range check
        if self.time_range:
            start_time, end_time = self.time_range
            if not (start_time <= signal.processed_time <= end_time):
                return False
        
        return True


class SignalService:
    """Service for managing trading signals and alerts"""
    
    def __init__(self, indicator_service: IndicatorService, event_bus: EventBus):
        self.indicator_service = indicator_service
        self.event_bus = event_bus
        
        # Signal storage
        self.processed_signals: List[ProcessedSignal] = []
        self.signal_history: Dict[str, List[ProcessedSignal]] = {}  # By symbol
        
        # Alert management
        self.alert_configs: Dict[str, SignalAlert] = {}
        self.alert_history: List[Dict[str, Any]] = []
        self.alert_cooldowns: Dict[str, datetime] = {}
        
        # Threading
        self._signal_lock = threading.RLock()
        
        # Subscribe to events
        self.event_bus.subscribe("indicator_calculated", self._handle_indicator_result)
        self.event_bus.subscribe("strategy_signals", self._handle_strategy_signals)
        
        # Default alert configurations
        self._setup_default_alerts()
    
    def _setup_default_alerts(self):
        """Setup default alert configurations"""
        # Strong buy/sell signals
        self.add_alert_config(
            name="Strong Signals",
            signal_types=[SignalType.STRONG_BUY, SignalType.STRONG_SELL],
            min_strength=0.7,
            alert_types=[AlertType.POPUP, AlertType.SOUND, AlertType.LOG]
        )
        
        # All buy/sell signals with medium strength
        self.add_alert_config(
            name="Trading Signals",
            signal_types=[SignalType.BUY, SignalType.SELL],
            min_strength=0.5,
            alert_types=[AlertType.LOG]
        )
    
    def add_alert_config(self, name: str, signal_types: List[SignalType],
                        min_strength: float = 0.5, **kwargs) -> bool:
        """Add a new alert configuration"""
        try:
            alert = SignalAlert(
                name=name,
                signal_types=signal_types,
                min_strength=min_strength,
                **kwargs
            )
            
            self.alert_configs[name] = alert
            
            self.event_bus.emit(Event("alert_config_added", {
                'name': name,
                'config': alert
            }))
            
            return True
            
        except Exception as e:
            print(f"Error adding alert config {name}: {e}")
            return False
    
    def remove_alert_config(self, name: str) -> bool:
        """Remove an alert configuration"""
        if name in self.alert_configs:
            del self.alert_configs[name]
            
            self.event_bus.emit(Event("alert_config_removed", {'name': name}))
            return True
        
        return False
    
    def process_indicator_signals(self, indicator_name: str, symbol: str,
                                result: Dict[str, Any]) -> List[ProcessedSignal]:
        """Process signals from indicator results"""
        signals = []
        
        try:
            # Look for signal data in indicator results
            if 'signals' in result:
                raw_signals = result['signals']
                
                for signal in raw_signals:
                    if isinstance(signal, StrategySignal):
                        processed = self._create_processed_signal(
                            signal, symbol, indicator_name
                        )
                        signals.append(processed)
            
            # Look for threshold crossings and generate signals
            generated_signals = self._generate_threshold_signals(
                indicator_name, symbol, result
            )
            signals.extend(generated_signals)
            
            # Store processed signals
            with self._signal_lock:
                self.processed_signals.extend(signals)
                
                if symbol not in self.signal_history:
                    self.signal_history[symbol] = []
                self.signal_history[symbol].extend(signals)
                
                # Keep history limited (last 1000 signals per symbol)
                if len(self.signal_history[symbol]) > 1000:
                    self.signal_history[symbol] = self.signal_history[symbol][-1000:]
            
            # Process alerts
            for signal in signals:
                self._check_and_trigger_alerts(signal)
            
            return signals
            
        except Exception as e:
            print(f"Error processing signals from {indicator_name}: {e}")
            return []
    
    def _create_processed_signal(self, signal: StrategySignal, symbol: str,
                               indicator_name: str) -> ProcessedSignal:
        """Create processed signal from strategy signal"""
        strength_category = self._classify_strength(signal.strength)
        
        return ProcessedSignal(
            signal=signal,
            strength_category=strength_category,
            symbol=symbol,
            indicator_name=indicator_name,
            processed_time=datetime.now()
        )
    
    def _generate_threshold_signals(self, indicator_name: str, symbol: str,
                                  result: Dict[str, Any]) -> List[ProcessedSignal]:
        """Generate signals from threshold crossings"""
        signals = []
        
        try:
            # RSI overbought/oversold signals
            if 'rsi' in result or 'RSI' in indicator_name.upper():
                rsi_signals = self._generate_rsi_signals(
                    indicator_name, symbol, result
                )
                signals.extend(rsi_signals)
            
            # MACD signals
            if 'macd' in result or 'MACD' in indicator_name.upper():
                macd_signals = self._generate_macd_signals(
                    indicator_name, symbol, result
                )
                signals.extend(macd_signals)
            
            # Moving average crossover signals
            if 'crossover' in result or 'MA' in indicator_name.upper():
                ma_signals = self._generate_ma_signals(
                    indicator_name, symbol, result
                )
                signals.extend(ma_signals)
            
            # Bollinger Bands signals
            if 'bollinger' in result or 'BB' in indicator_name.upper():
                bb_signals = self._generate_bollinger_signals(
                    indicator_name, symbol, result
                )
                signals.extend(bb_signals)
        
        except Exception as e:
            print(f"Error generating threshold signals: {e}")
        
        return signals
    
    def _generate_rsi_signals(self, indicator_name: str, symbol: str,
                            result: Dict[str, Any]) -> List[ProcessedSignal]:
        """Generate RSI-based signals"""
        signals = []
        
        try:
            rsi_values = result.get('values', [])
            if not rsi_values or len(rsi_values) < 2:
                return signals
            
            current_rsi = rsi_values[-1]
            prev_rsi = rsi_values[-2]
            
            if current_rsi is None or prev_rsi is None:
                return signals
            
            # Oversold recovery (bullish)
            if prev_rsi <= 30 and current_rsi > 30:
                signal = StrategySignal(
                    timestamp=datetime.now(),
                    signal=SignalType.BUY,
                    strength=min((current_rsi - 30) / 20, 0.8),  # Scale 30-50 to 0-0.8
                    price=0.0,  # Would need current price
                    contributing_indicators=[indicator_name],
                    description="RSI recovery from oversold"
                )
                signals.append(self._create_processed_signal(signal, symbol, indicator_name))
            
            # Overbought decline (bearish)
            elif prev_rsi >= 70 and current_rsi < 70:
                signal = StrategySignal(
                    timestamp=datetime.now(),
                    signal=SignalType.SELL,
                    strength=min((70 - current_rsi) / 20, 0.8),  # Scale 70-50 to 0-0.8
                    price=0.0,
                    contributing_indicators=[indicator_name],
                    description="RSI decline from overbought"
                )
                signals.append(self._create_processed_signal(signal, symbol, indicator_name))
        
        except Exception as e:
            print(f"Error generating RSI signals: {e}")
        
        return signals
    
    def _generate_macd_signals(self, indicator_name: str, symbol: str,
                             result: Dict[str, Any]) -> List[ProcessedSignal]:
        """Generate MACD-based signals"""
        signals = []
        
        try:
            macd_line = result.get('macd', [])
            signal_line = result.get('signal', [])
            
            if (not macd_line or not signal_line or 
                len(macd_line) < 2 or len(signal_line) < 2):
                return signals
            
            curr_macd = macd_line[-1]
            prev_macd = macd_line[-2]
            curr_signal = signal_line[-1]
            prev_signal = signal_line[-2]
            
            if None in [curr_macd, prev_macd, curr_signal, prev_signal]:
                return signals
            
            # Bullish crossover
            if prev_macd <= prev_signal and curr_macd > curr_signal:
                signal = StrategySignal(
                    timestamp=datetime.now(),
                    signal=SignalType.BUY,
                    strength=min(abs(curr_macd - curr_signal) / max(abs(curr_macd), 0.001), 0.9),
                    price=0.0,
                    contributing_indicators=[indicator_name],
                    description="MACD bullish crossover"
                )
                signals.append(self._create_processed_signal(signal, symbol, indicator_name))
            
            # Bearish crossover
            elif prev_macd >= prev_signal and curr_macd < curr_signal:
                signal = StrategySignal(
                    timestamp=datetime.now(),
                    signal=SignalType.SELL,
                    strength=min(abs(curr_macd - curr_signal) / max(abs(curr_macd), 0.001), 0.9),
                    price=0.0,
                    contributing_indicators=[indicator_name],
                    description="MACD bearish crossover"
                )
                signals.append(self._create_processed_signal(signal, symbol, indicator_name))
        
        except Exception as e:
            print(f"Error generating MACD signals: {e}")
        
        return signals
    
    def _generate_ma_signals(self, indicator_name: str, symbol: str,
                           result: Dict[str, Any]) -> List[ProcessedSignal]:
        """Generate moving average signals"""
        # Implementation for MA crossover signals
        return []
    
    def _generate_bollinger_signals(self, indicator_name: str, symbol: str,
                                  result: Dict[str, Any]) -> List[ProcessedSignal]:
        """Generate Bollinger Bands signals"""
        # Implementation for BB signals
        return []
    
    def _classify_strength(self, strength: float) -> SignalStrength:
        """Classify signal strength"""
        if strength >= 0.8:
            return SignalStrength.VERY_STRONG
        elif strength >= 0.6:
            return SignalStrength.STRONG
        elif strength >= 0.3:
            return SignalStrength.MEDIUM
        else:
            return SignalStrength.WEAK
    
    def _check_and_trigger_alerts(self, signal: ProcessedSignal):
        """Check if signal should trigger alerts"""
        for alert_name, alert_config in self.alert_configs.items():
            if not alert_config.enabled:
                continue
            
            # Check if signal matches alert criteria
            if not self._signal_matches_alert(signal, alert_config):
                continue
            
            # Check cooldown
            cooldown_key = f"{alert_name}_{signal.symbol}_{signal.signal.signal.value}"
            if self._is_in_cooldown(cooldown_key, alert_config.cooldown_minutes):
                continue
            
            # Trigger alerts
            self._trigger_alert(signal, alert_config)
            
            # Update cooldown
            self.alert_cooldowns[cooldown_key] = datetime.now()
    
    def _signal_matches_alert(self, signal: ProcessedSignal, alert: SignalAlert) -> bool:
        """Check if signal matches alert criteria"""
        # Signal type check
        if signal.signal.signal not in alert.signal_types:
            return False
        
        # Strength check
        if signal.signal.strength < alert.min_strength:
            return False
        
        # Indicator filter
        if alert.indicators and signal.indicator_name not in alert.indicators:
            return False
        
        # Symbol filter
        if alert.symbols and signal.symbol not in alert.symbols:
            return False
        
        return True
    
    def _is_in_cooldown(self, cooldown_key: str, cooldown_minutes: int) -> bool:
        """Check if alert is in cooldown period"""
        if cooldown_key not in self.alert_cooldowns:
            return False
        
        last_alert = self.alert_cooldowns[cooldown_key]
        cooldown_period = timedelta(minutes=cooldown_minutes)
        
        return datetime.now() - last_alert < cooldown_period
    
    def _trigger_alert(self, signal: ProcessedSignal, alert_config: SignalAlert):
        """Trigger alert for signal"""
        alert_data = {
            'alert_name': alert_config.name,
            'signal': signal,
            'timestamp': datetime.now(),
            'alert_types': alert_config.alert_types
        }
        
        # Store alert history
        self.alert_history.append(alert_data)
        
        # Keep history limited
        if len(self.alert_history) > 1000:
            self.alert_history = self.alert_history[-1000:]
        
        # Emit alert event
        self.event_bus.emit(Event("signal_alert", alert_data))
        
        # Mark signal as alerted
        signal.alerted = True
        signal.alert_types_sent.extend(alert_config.alert_types)
    
    def get_signals(self, symbol: Optional[str] = None, 
                   signal_filter: Optional[SignalFilter] = None,
                   limit: int = 100) -> List[ProcessedSignal]:
        """Get processed signals with optional filtering"""
        with self._signal_lock:
            if symbol:
                signals = self.signal_history.get(symbol, [])
            else:
                signals = self.processed_signals
            
            # Apply filter
            if signal_filter:
                signals = [s for s in signals if signal_filter.matches(s)]
            
            # Sort by time (newest first) and limit
            signals = sorted(signals, key=lambda s: s.processed_time, reverse=True)
            return signals[:limit]
    
    def get_signal_summary(self, symbol: Optional[str] = None,
                          time_range: Optional[timedelta] = None) -> Dict[str, Any]:
        """Get summary of signals"""
        if time_range is None:
            time_range = timedelta(hours=24)
        
        cutoff_time = datetime.now() - time_range
        
        signals = self.get_signals(symbol)
        recent_signals = [s for s in signals if s.processed_time >= cutoff_time]
        
        summary = {
            'total_signals': len(recent_signals),
            'buy_signals': len([s for s in recent_signals 
                              if s.signal.signal in [SignalType.BUY, SignalType.STRONG_BUY]]),
            'sell_signals': len([s for s in recent_signals 
                               if s.signal.signal in [SignalType.SELL, SignalType.STRONG_SELL]]),
            'by_strength': {
                'very_strong': len([s for s in recent_signals if s.strength_category == SignalStrength.VERY_STRONG]),
                'strong': len([s for s in recent_signals if s.strength_category == SignalStrength.STRONG]),
                'medium': len([s for s in recent_signals if s.strength_category == SignalStrength.MEDIUM]),
                'weak': len([s for s in recent_signals if s.strength_category == SignalStrength.WEAK])
            },
            'by_indicator': {}
        }
        
        # Count by indicator
        for signal in recent_signals:
            indicator = signal.indicator_name
            if indicator not in summary['by_indicator']:
                summary['by_indicator'][indicator] = 0
            summary['by_indicator'][indicator] += 1
        
        return summary
    
    def _handle_indicator_result(self, event: Event):
        """Handle indicator calculation results"""
        indicator_name = event.data.get('name')
        result = event.data.get('result')
        
        if indicator_name and result:
            # Extract symbol from context or use default
            symbol = event.data.get('symbol', 'DEFAULT')
            
            # Process signals from the result
            self.process_indicator_signals(indicator_name, symbol, result)
    
    def _handle_strategy_signals(self, event: Event):
        """Handle strategy signals"""
        strategy_name = event.data.get('strategy_name')
        signals = event.data.get('signals', [])
        
        for signal in signals:
            if isinstance(signal, StrategySignal):
                processed = self._create_processed_signal(
                    signal, 'DEFAULT', f"Strategy_{strategy_name}"
                )
                
                with self._signal_lock:
                    self.processed_signals.append(processed)
                
                self._check_and_trigger_alerts(processed)
    
    def clear_signals(self, symbol: Optional[str] = None):
        """Clear signal history"""
        with self._signal_lock:
            if symbol:
                if symbol in self.signal_history:
                    del self.signal_history[symbol]
            else:
                self.processed_signals.clear()
                self.signal_history.clear()
        
        self.event_bus.emit(Event("signals_cleared", {'symbol': symbol}))
    
    def export_signals(self, symbol: Optional[str] = None) -> Dict[str, Any]:
        """Export signals to JSON-serializable format"""
        signals = self.get_signals(symbol)
        
        export_data = {
            'timestamp': datetime.now().isoformat(),
            'symbol': symbol,
            'signals': []
        }
        
        for signal in signals:
            export_data['signals'].append({
                'timestamp': signal.signal.timestamp.isoformat() if hasattr(signal.signal.timestamp, 'isoformat') else str(signal.signal.timestamp),
                'signal_type': signal.signal.signal.value,
                'strength': signal.signal.strength,
                'strength_category': signal.strength_category.value,
                'price': signal.signal.price,
                'indicator': signal.indicator_name,
                'description': signal.signal.description,
                'processed_time': signal.processed_time.isoformat()
            })
        
        return export_data