"""
Backtesting Service - Comprehensive backtesting for indicators and strategies
Provides historical testing capabilities with detailed performance metrics
"""

from typing import Dict, List, Any, Optional, Tuple, NamedTuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from abc import ABC, abstractmethod

from ..domain.models import OHLCVData
from ..indicators.strategies import TradingStrategy, StrategySignal, SignalType
from .indicator_service import IndicatorService


class PositionType(Enum):
    """Position types"""
    LONG = "long"
    SHORT = "short"
    FLAT = "flat"


class OrderType(Enum):
    """Order types"""
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"


@dataclass
class BacktestPosition:
    """Represents a trading position during backtest"""
    entry_time: datetime
    entry_price: float
    position_type: PositionType
    size: float
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    exit_time: Optional[datetime] = None
    exit_price: Optional[float] = None
    exit_reason: Optional[str] = None
    pnl: Optional[float] = None
    commission: float = 0.0
    
    def is_open(self) -> bool:
        """Check if position is still open"""
        return self.exit_time is None
    
    def calculate_pnl(self, current_price: float) -> float:
        """Calculate current P&L"""
        if self.position_type == PositionType.LONG:
            return (current_price - self.entry_price) * self.size - self.commission
        elif self.position_type == PositionType.SHORT:
            return (self.entry_price - current_price) * self.size - self.commission
        return 0.0


@dataclass
class BacktestSettings:
    """Backtesting configuration"""
    initial_capital: float = 100000.0
    commission_rate: float = 0.001  # 0.1%
    slippage: float = 0.0001  # 0.01%
    position_sizing: str = "fixed"  # fixed, percent_of_capital, kelly
    position_size: float = 10000.0  # For fixed sizing
    position_percent: float = 10.0  # For percent sizing
    max_positions: int = 1
    allow_short: bool = False
    stop_loss_percent: Optional[float] = None
    take_profit_percent: Optional[float] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


@dataclass
class BacktestMetrics:
    """Comprehensive backtest performance metrics"""
    # Basic metrics
    initial_capital: float
    final_capital: float
    total_return: float
    total_return_percent: float
    annualized_return: float
    
    # Risk metrics
    sharpe_ratio: float
    sortino_ratio: float
    max_drawdown: float
    max_drawdown_percent: float
    volatility: float
    
    # Trade statistics
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    avg_win: float
    avg_loss: float
    profit_factor: float
    largest_win: float
    largest_loss: float
    
    # Time-based metrics
    avg_trade_duration: timedelta
    longest_winning_streak: int
    longest_losing_streak: int
    
    # Additional metrics
    calmar_ratio: float
    recovery_factor: float
    payoff_ratio: float
    
    # Daily statistics
    best_day: float
    worst_day: float
    positive_days: int
    negative_days: int
    
    # Drawdown analysis
    avg_drawdown: float
    avg_drawdown_duration: timedelta
    max_drawdown_duration: timedelta


class BacktestEngine:
    """Core backtesting engine"""
    
    def __init__(self, settings: BacktestSettings = None):
        self.settings = settings or BacktestSettings()
        
        # State tracking
        self.capital = self.settings.initial_capital
        self.positions: List[BacktestPosition] = []
        self.closed_positions: List[BacktestPosition] = []
        self.equity_curve: List[Tuple[datetime, float]] = []
        self.drawdown_curve: List[Tuple[datetime, float]] = []
        
        # Performance tracking
        self.daily_returns: List[float] = []
        self.trade_log: List[Dict[str, Any]] = []
        self.high_water_mark = self.settings.initial_capital
        
    def run_backtest(self, strategy: TradingStrategy, 
                    data: List[OHLCVData]) -> BacktestMetrics:
        """Run complete backtest"""
        # Initialize
        self._reset_state()
        
        # Generate signals
        signals = strategy.calculate_signals(data)
        
        # Convert data to DataFrame for easier processing
        df = pd.DataFrame([{
            'timestamp': item.timestamp,
            'open': item.open_price,
            'high': item.high_price,
            'low': item.low_price,
            'close': item.close_price,
            'volume': item.volume
        } for item in data])
        df.set_index('timestamp', inplace=True)
        
        # Process each data point
        for i, (timestamp, row) in enumerate(df.iterrows()):
            # Check for signals at this timestamp
            current_signals = [s for s in signals if s.timestamp == timestamp]
            
            # Update positions
            self._update_positions(timestamp, row)
            
            # Process signals
            for signal in current_signals:
                self._process_signal(signal, timestamp, row)
            
            # Update equity curve
            current_equity = self._calculate_current_equity(row['close'])
            self.equity_curve.append((timestamp, current_equity))
            
            # Update drawdown
            if current_equity > self.high_water_mark:
                self.high_water_mark = current_equity
            
            drawdown = (self.high_water_mark - current_equity) / self.high_water_mark
            self.drawdown_curve.append((timestamp, drawdown))
        
        # Close any remaining positions
        if df.index[-1:].size > 0:
            final_timestamp = df.index[-1]
            final_price = df.iloc[-1]['close']
            self._close_all_positions(final_timestamp, final_price, "End of backtest")
        
        # Calculate metrics
        return self._calculate_metrics()
    
    def _reset_state(self):
        """Reset backtest state"""
        self.capital = self.settings.initial_capital
        self.positions.clear()
        self.closed_positions.clear()
        self.equity_curve.clear()
        self.drawdown_curve.clear()
        self.daily_returns.clear()
        self.trade_log.clear()
        self.high_water_mark = self.settings.initial_capital
    
    def _process_signal(self, signal: StrategySignal, timestamp: datetime, price_data: pd.Series):
        """Process a trading signal"""
        if signal.signal in [SignalType.BUY, SignalType.STRONG_BUY]:
            self._enter_long_position(timestamp, price_data, signal)
        elif signal.signal in [SignalType.SELL, SignalType.STRONG_SELL]:
            if self.settings.allow_short:
                self._enter_short_position(timestamp, price_data, signal)
            else:
                self._close_long_positions(timestamp, price_data['close'], "Sell signal")
    
    def _enter_long_position(self, timestamp: datetime, price_data: pd.Series, signal: StrategySignal):
        """Enter a long position"""
        if len(self.positions) >= self.settings.max_positions:
            return
        
        entry_price = price_data['open']  # Assume we can enter at open
        position_size = self._calculate_position_size(entry_price)
        
        if position_size * entry_price > self.capital:
            return  # Insufficient capital
        
        # Apply slippage
        entry_price *= (1 + self.settings.slippage)
        
        # Calculate commission
        commission = position_size * entry_price * self.settings.commission_rate
        
        # Calculate stop loss and take profit
        stop_loss = None
        take_profit = None
        
        if self.settings.stop_loss_percent:
            stop_loss = entry_price * (1 - self.settings.stop_loss_percent / 100)
        
        if self.settings.take_profit_percent:
            take_profit = entry_price * (1 + self.settings.take_profit_percent / 100)
        
        # Create position
        position = BacktestPosition(
            entry_time=timestamp,
            entry_price=entry_price,
            position_type=PositionType.LONG,
            size=position_size,
            stop_loss=stop_loss,
            take_profit=take_profit,
            commission=commission
        )
        
        self.positions.append(position)
        self.capital -= position_size * entry_price + commission
        
        # Log trade
        self.trade_log.append({
            'timestamp': timestamp,
            'action': 'BUY',
            'price': entry_price,
            'size': position_size,
            'signal_strength': signal.strength,
            'capital_after': self.capital
        })
    
    def _enter_short_position(self, timestamp: datetime, price_data: pd.Series, signal: StrategySignal):
        """Enter a short position"""
        if len(self.positions) >= self.settings.max_positions:
            return
        
        entry_price = price_data['open']
        position_size = self._calculate_position_size(entry_price)
        
        # Apply slippage
        entry_price *= (1 - self.settings.slippage)
        
        # Calculate commission
        commission = position_size * entry_price * self.settings.commission_rate
        
        # Calculate stop loss and take profit for short
        stop_loss = None
        take_profit = None
        
        if self.settings.stop_loss_percent:
            stop_loss = entry_price * (1 + self.settings.stop_loss_percent / 100)
        
        if self.settings.take_profit_percent:
            take_profit = entry_price * (1 - self.settings.take_profit_percent / 100)
        
        # Create position
        position = BacktestPosition(
            entry_time=timestamp,
            entry_price=entry_price,
            position_type=PositionType.SHORT,
            size=position_size,
            stop_loss=stop_loss,
            take_profit=take_profit,
            commission=commission
        )
        
        self.positions.append(position)
        self.capital += position_size * entry_price - commission
    
    def _update_positions(self, timestamp: datetime, price_data: pd.Series):
        """Update existing positions and check for exits"""
        positions_to_close = []
        
        for position in self.positions:
            current_price = price_data['close']
            
            # Check stop loss
            if position.stop_loss:
                if ((position.position_type == PositionType.LONG and price_data['low'] <= position.stop_loss) or
                    (position.position_type == PositionType.SHORT and price_data['high'] >= position.stop_loss)):
                    positions_to_close.append((position, position.stop_loss, "Stop Loss"))
                    continue
            
            # Check take profit
            if position.take_profit:
                if ((position.position_type == PositionType.LONG and price_data['high'] >= position.take_profit) or
                    (position.position_type == PositionType.SHORT and price_data['low'] <= position.take_profit)):
                    positions_to_close.append((position, position.take_profit, "Take Profit"))
                    continue
        
        # Close positions
        for position, exit_price, exit_reason in positions_to_close:
            self._close_position(position, timestamp, exit_price, exit_reason)
    
    def _close_position(self, position: BacktestPosition, exit_time: datetime, 
                       exit_price: float, exit_reason: str):
        """Close a specific position"""
        # Apply slippage
        if position.position_type == PositionType.LONG:
            exit_price *= (1 - self.settings.slippage)
        else:
            exit_price *= (1 + self.settings.slippage)
        
        # Calculate P&L
        pnl = position.calculate_pnl(exit_price)
        
        # Update position
        position.exit_time = exit_time
        position.exit_price = exit_price
        position.exit_reason = exit_reason
        position.pnl = pnl
        
        # Update capital
        if position.position_type == PositionType.LONG:
            self.capital += position.size * exit_price - position.commission
        else:
            self.capital -= position.size * exit_price - position.commission
        
        # Move to closed positions
        self.positions.remove(position)
        self.closed_positions.append(position)
        
        # Log trade
        self.trade_log.append({
            'timestamp': exit_time,
            'action': 'SELL' if position.position_type == PositionType.LONG else 'COVER',
            'price': exit_price,
            'size': position.size,
            'pnl': pnl,
            'exit_reason': exit_reason,
            'capital_after': self.capital
        })
    
    def _close_long_positions(self, timestamp: datetime, price: float, reason: str):
        """Close all long positions"""
        long_positions = [p for p in self.positions if p.position_type == PositionType.LONG]
        for position in long_positions:
            self._close_position(position, timestamp, price, reason)
    
    def _close_all_positions(self, timestamp: datetime, price: float, reason: str):
        """Close all open positions"""
        open_positions = self.positions.copy()
        for position in open_positions:
            self._close_position(position, timestamp, price, reason)
    
    def _calculate_position_size(self, price: float) -> float:
        """Calculate position size based on settings"""
        if self.settings.position_sizing == "fixed":
            return self.settings.position_size / price
        elif self.settings.position_sizing == "percent_of_capital":
            capital_to_use = self.capital * (self.settings.position_percent / 100)
            return capital_to_use / price
        else:  # Default to fixed
            return self.settings.position_size / price
    
    def _calculate_current_equity(self, current_price: float) -> float:
        """Calculate current total equity"""
        equity = self.capital
        
        # Add value of open positions
        for position in self.positions:
            unrealized_pnl = position.calculate_pnl(current_price)
            equity += unrealized_pnl
        
        return equity
    
    def _calculate_metrics(self) -> BacktestMetrics:
        """Calculate comprehensive backtest metrics"""
        if not self.equity_curve:
            return self._empty_metrics()
        
        # Basic calculations
        initial_capital = self.settings.initial_capital
        final_capital = self.equity_curve[-1][1]
        total_return = final_capital - initial_capital
        total_return_percent = (total_return / initial_capital) * 100
        
        # Time-based calculations
        start_date = self.equity_curve[0][0]
        end_date = self.equity_curve[-1][0]
        total_days = (end_date - start_date).days
        years = total_days / 365.25
        
        annualized_return = ((final_capital / initial_capital) ** (1/years) - 1) * 100 if years > 0 else 0
        
        # Equity curve analysis
        equity_values = [eq[1] for eq in self.equity_curve]
        returns = np.diff(equity_values) / equity_values[:-1]
        
        # Risk metrics
        volatility = np.std(returns) * np.sqrt(252) * 100  # Annualized
        sharpe_ratio = annualized_return / volatility if volatility > 0 else 0
        
        # Drawdown analysis
        drawdowns = [dd[1] for dd in self.drawdown_curve]
        max_drawdown = max(drawdowns) if drawdowns else 0
        max_drawdown_percent = max_drawdown * 100
        
        # Sortino ratio (downside deviation)
        negative_returns = [r for r in returns if r < 0]
        downside_volatility = np.std(negative_returns) * np.sqrt(252) * 100 if negative_returns else 0
        sortino_ratio = annualized_return / downside_volatility if downside_volatility > 0 else 0
        
        # Trade statistics
        winning_trades = len([p for p in self.closed_positions if p.pnl > 0])
        losing_trades = len([p for p in self.closed_positions if p.pnl < 0])
        total_trades = len(self.closed_positions)
        
        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
        
        # P&L statistics
        wins = [p.pnl for p in self.closed_positions if p.pnl > 0]
        losses = [p.pnl for p in self.closed_positions if p.pnl < 0]
        
        avg_win = np.mean(wins) if wins else 0
        avg_loss = np.mean(losses) if losses else 0
        largest_win = max(wins) if wins else 0
        largest_loss = min(losses) if losses else 0
        
        total_wins = sum(wins) if wins else 0
        total_losses = abs(sum(losses)) if losses else 0
        profit_factor = total_wins / total_losses if total_losses > 0 else 0
        
        # Additional metrics
        payoff_ratio = abs(avg_win / avg_loss) if avg_loss != 0 else 0
        calmar_ratio = annualized_return / max_drawdown_percent if max_drawdown_percent > 0 else 0
        recovery_factor = total_return / abs(largest_loss) if largest_loss != 0 else 0
        
        # Trade duration
        durations = [(p.exit_time - p.entry_time) for p in self.closed_positions if p.exit_time]
        avg_trade_duration = np.mean(durations) if durations else timedelta(0)
        
        # Daily statistics
        daily_returns_array = np.array(returns)
        best_day = np.max(daily_returns_array) * 100 if len(daily_returns_array) > 0 else 0
        worst_day = np.min(daily_returns_array) * 100 if len(daily_returns_array) > 0 else 0
        positive_days = len([r for r in returns if r > 0])
        negative_days = len([r for r in returns if r < 0])
        
        return BacktestMetrics(
            initial_capital=initial_capital,
            final_capital=final_capital,
            total_return=total_return,
            total_return_percent=total_return_percent,
            annualized_return=annualized_return,
            sharpe_ratio=sharpe_ratio,
            sortino_ratio=sortino_ratio,
            max_drawdown=max_drawdown * initial_capital,
            max_drawdown_percent=max_drawdown_percent,
            volatility=volatility,
            total_trades=total_trades,
            winning_trades=winning_trades,
            losing_trades=losing_trades,
            win_rate=win_rate,
            avg_win=avg_win,
            avg_loss=avg_loss,
            profit_factor=profit_factor,
            largest_win=largest_win,
            largest_loss=largest_loss,
            avg_trade_duration=avg_trade_duration,
            longest_winning_streak=self._calculate_longest_streak(True),
            longest_losing_streak=self._calculate_longest_streak(False),
            calmar_ratio=calmar_ratio,
            recovery_factor=recovery_factor,
            payoff_ratio=payoff_ratio,
            best_day=best_day,
            worst_day=worst_day,
            positive_days=positive_days,
            negative_days=negative_days,
            avg_drawdown=np.mean(drawdowns) * initial_capital if drawdowns else 0,
            avg_drawdown_duration=timedelta(0),  # Would need more complex calculation
            max_drawdown_duration=timedelta(0)   # Would need more complex calculation
        )
    
    def _calculate_longest_streak(self, winning: bool) -> int:
        """Calculate longest winning or losing streak"""
        if not self.closed_positions:
            return 0
        
        current_streak = 0
        longest_streak = 0
        
        for position in self.closed_positions:
            is_win = position.pnl > 0
            
            if is_win == winning:
                current_streak += 1
                longest_streak = max(longest_streak, current_streak)
            else:
                current_streak = 0
        
        return longest_streak
    
    def _empty_metrics(self) -> BacktestMetrics:
        """Return empty metrics for failed backtest"""
        return BacktestMetrics(
            initial_capital=0, final_capital=0, total_return=0, total_return_percent=0,
            annualized_return=0, sharpe_ratio=0, sortino_ratio=0, max_drawdown=0,
            max_drawdown_percent=0, volatility=0, total_trades=0, winning_trades=0,
            losing_trades=0, win_rate=0, avg_win=0, avg_loss=0, profit_factor=0,
            largest_win=0, largest_loss=0, avg_trade_duration=timedelta(0),
            longest_winning_streak=0, longest_losing_streak=0, calmar_ratio=0,
            recovery_factor=0, payoff_ratio=0, best_day=0, worst_day=0,
            positive_days=0, negative_days=0, avg_drawdown=0,
            avg_drawdown_duration=timedelta(0), max_drawdown_duration=timedelta(0)
        )


class BacktestService:
    """Service for managing backtesting operations"""
    
    def __init__(self, indicator_service: IndicatorService):
        self.indicator_service = indicator_service
        self.backtest_results: Dict[str, BacktestMetrics] = {}
        self.backtest_history: List[Dict[str, Any]] = []
    
    def run_strategy_backtest(self, strategy: TradingStrategy, data: List[OHLCVData],
                             settings: BacktestSettings = None) -> BacktestMetrics:
        """Run backtest for a strategy"""
        engine = BacktestEngine(settings)
        metrics = engine.run_backtest(strategy, data)
        
        # Store results
        result_id = f"{strategy.name}_{datetime.now().timestamp()}"
        self.backtest_results[result_id] = metrics
        
        # Store in history
        self.backtest_history.append({
            'id': result_id,
            'strategy_name': strategy.name,
            'timestamp': datetime.now(),
            'metrics': metrics,
            'settings': settings
        })
        
        return metrics
    
    def run_indicator_backtest(self, indicator_name: str, symbol: str,
                              data: List[OHLCVData], settings: BacktestSettings = None) -> Dict[str, Any]:
        """Run backtest for a single indicator's signals"""
        # Calculate indicator
        result = self.indicator_service.calculate_indicator(indicator_name, data)
        
        if not result or 'signals' not in result:
            return {'error': 'No signals generated from indicator'}
        
        # Create simple strategy from indicator signals
        class IndicatorStrategy(TradingStrategy):
            def __init__(self, signals):
                super().__init__(f"Indicator_{indicator_name}", f"Strategy based on {indicator_name}")
                self.preset_signals = signals
            
            def calculate_signals(self, data):
                return self.preset_signals
        
        strategy = IndicatorStrategy(result['signals'])
        return self.run_strategy_backtest(strategy, data, settings)
    
    def compare_strategies(self, strategies: List[TradingStrategy], 
                          data: List[OHLCVData], settings: BacktestSettings = None) -> Dict[str, Any]:
        """Compare multiple strategies"""
        results = {}
        
        for strategy in strategies:
            metrics = self.run_strategy_backtest(strategy, data, settings)
            results[strategy.name] = metrics
        
        # Create comparison summary
        comparison = {
            'strategies': results,
            'ranking': self._rank_strategies(results),
            'summary': self._create_comparison_summary(results)
        }
        
        return comparison
    
    def _rank_strategies(self, results: Dict[str, BacktestMetrics]) -> List[Dict[str, Any]]:
        """Rank strategies by performance"""
        ranking = []
        
        for name, metrics in results.items():
            score = self._calculate_strategy_score(metrics)
            ranking.append({
                'strategy': name,
                'score': score,
                'return': metrics.total_return_percent,
                'sharpe': metrics.sharpe_ratio,
                'max_drawdown': metrics.max_drawdown_percent,
                'win_rate': metrics.win_rate
            })
        
        # Sort by score descending
        ranking.sort(key=lambda x: x['score'], reverse=True)
        
        return ranking
    
    def _calculate_strategy_score(self, metrics: BacktestMetrics) -> float:
        """Calculate composite strategy score"""
        # Weighted scoring system
        score = (
            metrics.total_return_percent * 0.3 +
            metrics.sharpe_ratio * 20 * 0.25 +
            (100 - metrics.max_drawdown_percent) * 0.2 +
            metrics.win_rate * 0.15 +
            metrics.profit_factor * 10 * 0.1
        )
        
        return max(0, score)  # Ensure non-negative
    
    def _create_comparison_summary(self, results: Dict[str, BacktestMetrics]) -> Dict[str, Any]:
        """Create summary statistics for comparison"""
        if not results:
            return {}
        
        returns = [m.total_return_percent for m in results.values()]
        sharpes = [m.sharpe_ratio for m in results.values()]
        drawdowns = [m.max_drawdown_percent for m in results.values()]
        
        return {
            'best_return': max(returns),
            'worst_return': min(returns),
            'avg_return': np.mean(returns),
            'best_sharpe': max(sharpes),
            'worst_sharpe': min(sharpes),
            'avg_sharpe': np.mean(sharpes),
            'best_drawdown': min(drawdowns),  # Lower is better
            'worst_drawdown': max(drawdowns),
            'avg_drawdown': np.mean(drawdowns)
        }
    
    def get_backtest_history(self) -> List[Dict[str, Any]]:
        """Get backtest history"""
        return self.backtest_history
    
    def export_results(self, result_id: str) -> Dict[str, Any]:
        """Export backtest results"""
        if result_id not in self.backtest_results:
            return {'error': 'Result not found'}
        
        metrics = self.backtest_results[result_id]
        
        # Convert to serializable format
        return {
            'id': result_id,
            'metrics': {
                'initial_capital': metrics.initial_capital,
                'final_capital': metrics.final_capital,
                'total_return': metrics.total_return,
                'total_return_percent': metrics.total_return_percent,
                'annualized_return': metrics.annualized_return,
                'sharpe_ratio': metrics.sharpe_ratio,
                'max_drawdown_percent': metrics.max_drawdown_percent,
                'total_trades': metrics.total_trades,
                'win_rate': metrics.win_rate,
                'profit_factor': metrics.profit_factor
            },
            'timestamp': datetime.now().isoformat()
        }