"""
Domain models following Domain-Driven Design principles
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum


class DataType(Enum):
    """Data type enumeration for stock price data"""
    REAL_TIME = 0       # داده‌های زمان واقعی
    INTRADAY = 1        # داده‌های درون روزی
    UNADJUSTED = 2      # قیمت تعدیل نشده (پیش‌فرض)
    ADJUSTED = 3        # قیمت تعدیل شده


class MarketType(Enum):
    """Market type enumeration"""
    STOCK = "stock"
    CURRENCY = "currency"
    COMMODITY = "commodity"
    CRYPTO = "crypto"


class TimeFrame(Enum):
    """Timeframe enumeration"""
    M1 = "1M"
    M5 = "5M"
    M15 = "15M"
    M30 = "30M"
    H1 = "1H"
    H4 = "4H"
    D1 = "1D"
    W1 = "1W"
    MN1 = "1Mo"


class OrderType(Enum):
    """Order type enumeration"""
    BUY = "buy"
    SELL = "sell"


@dataclass
class Symbol:
    """Symbol entity"""
    id: str
    name: str
    market_type: MarketType
    exchange: Optional[str] = None
    description: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def __hash__(self):
        return hash(self.id)


@dataclass
class OHLCV:
    """OHLCV (Open, High, Low, Close, Volume) data point"""
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    data_type: DataType = DataType.UNADJUSTED  # پیش‌فرض: تعدیل نشده
    
    @property
    def typical_price(self) -> float:
        """Calculate typical price"""
        return (self.high + self.low + self.close) / 3
    
    @property
    def weighted_close(self) -> float:
        """Calculate weighted close"""
        return (self.high + self.low + 2 * self.close) / 4
    
    @property
    def price_range(self) -> float:
        """Calculate price range"""
        return self.high - self.low
    
    @property
    def is_bullish(self) -> bool:
        """Check if candle is bullish"""
        return self.close > self.open
    
    @property
    def body_size(self) -> float:
        """Calculate candle body size"""
        return abs(self.close - self.open)
    
    def is_adjusted(self) -> bool:
        """Check if data is adjusted"""
        return self.data_type == DataType.ADJUSTED
    
    def convert_to_adjusted(self, adjustment_factor: float) -> 'OHLCV':
        """Convert to adjusted prices using adjustment factor"""
        if self.is_adjusted():
            return self  # Already adjusted
        
        return OHLCV(
            timestamp=self.timestamp,
            open=self.open * adjustment_factor,
            high=self.high * adjustment_factor,
            low=self.low * adjustment_factor,
            close=self.close * adjustment_factor,
            volume=self.volume,  # Volume stays the same
            data_type=DataType.ADJUSTED
        )
    
    def convert_to_unadjusted(self, adjustment_factor: float) -> 'OHLCV':
        """Convert to unadjusted prices using adjustment factor"""
        if not self.is_adjusted():
            return self  # Already unadjusted
        
        return OHLCV(
            timestamp=self.timestamp,
            open=self.open / adjustment_factor,
            high=self.high / adjustment_factor,
            low=self.low / adjustment_factor,
            close=self.close / adjustment_factor,
            volume=self.volume,  # Volume stays the same
            data_type=DataType.UNADJUSTED
        )


@dataclass
class Trade:
    """Trade entity"""
    id: str
    symbol: Symbol
    timestamp: datetime
    price: float
    quantity: float
    order_type: OrderType
    fee: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def total_value(self) -> float:
        """Calculate total trade value"""
        return self.price * self.quantity
    
    @property
    def net_value(self) -> float:
        """Calculate net value after fees"""
        if self.order_type == OrderType.BUY:
            return self.total_value + self.fee
        else:
            return self.total_value - self.fee


@dataclass
class Position:
    """Position entity"""
    id: str
    symbol: Symbol
    quantity: float
    average_price: float
    current_price: float
    opened_at: datetime
    closed_at: Optional[datetime] = None
    
    @property
    def is_open(self) -> bool:
        """Check if position is open"""
        return self.closed_at is None
    
    @property
    def market_value(self) -> float:
        """Calculate current market value"""
        return self.quantity * self.current_price
    
    @property
    def cost_basis(self) -> float:
        """Calculate cost basis"""
        return self.quantity * self.average_price
    
    @property
    def unrealized_pnl(self) -> float:
        """Calculate unrealized P&L"""
        return self.market_value - self.cost_basis
    
    @property
    def unrealized_pnl_percentage(self) -> float:
        """Calculate unrealized P&L percentage"""
        if self.cost_basis == 0:
            return 0
        return (self.unrealized_pnl / self.cost_basis) * 100


@dataclass
class OrderBook:
    """Order book entity"""
    symbol: Symbol
    timestamp: datetime
    bids: List[tuple[float, float]]  # List of (price, quantity)
    asks: List[tuple[float, float]]  # List of (price, quantity)
    
    @property
    def best_bid(self) -> Optional[float]:
        """Get best bid price"""
        return self.bids[0][0] if self.bids else None
    
    @property
    def best_ask(self) -> Optional[float]:
        """Get best ask price"""
        return self.asks[0][0] if self.asks else None
    
    @property
    def spread(self) -> Optional[float]:
        """Calculate bid-ask spread"""
        if self.best_bid and self.best_ask:
            return self.best_ask - self.best_bid
        return None
    
    @property
    def mid_price(self) -> Optional[float]:
        """Calculate mid price"""
        if self.best_bid and self.best_ask:
            return (self.best_bid + self.best_ask) / 2
        return None


@dataclass
class MarketStatistics:
    """Market statistics entity"""
    symbol: Symbol
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    vwap: float
    change: float
    change_percentage: float
    high_52w: float
    low_52w: float
    market_cap: Optional[float] = None
    pe_ratio: Optional[float] = None
    
    @property
    def is_at_52w_high(self) -> bool:
        """Check if at 52-week high"""
        return self.close >= self.high_52w
    
    @property
    def is_at_52w_low(self) -> bool:
        """Check if at 52-week low"""
        return self.close <= self.low_52w
    
    @property
    def distance_from_52w_high(self) -> float:
        """Calculate distance from 52-week high"""
        return ((self.close - self.high_52w) / self.high_52w) * 100
    
    @property
    def distance_from_52w_low(self) -> float:
        """Calculate distance from 52-week low"""
        return ((self.close - self.low_52w) / self.low_52w) * 100


@dataclass
class WatchlistItem:
    """Watchlist item entity"""
    symbol: Symbol
    added_at: datetime
    alert_price: Optional[float] = None
    notes: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class StockInfo:
    """Stock information with adjustment support"""
    symbol: Symbol
    has_adjusted_data: bool = False
    has_unadjusted_data: bool = True
    default_data_type: DataType = DataType.UNADJUSTED
    adjustment_factors: Dict[str, float] = field(default_factory=dict)  # date -> factor
    
    def supports_data_type(self, data_type: DataType) -> bool:
        """Check if stock supports given data type"""
        if data_type == DataType.ADJUSTED:
            return self.has_adjusted_data
        elif data_type == DataType.UNADJUSTED:
            return self.has_unadjusted_data
        return True  # Support other types by default
    
    def get_adjustment_factor(self, date: str) -> float:
        """Get adjustment factor for a specific date"""
        return self.adjustment_factors.get(date, 1.0)


@dataclass
class ChartDataRequest:
    """Request for chart data with data type specification"""
    symbol: Symbol
    timeframe: TimeFrame
    start_date: datetime
    end_date: datetime
    data_type: DataType = DataType.UNADJUSTED  # پیش‌فرض: تعدیل نشده
    
    def __post_init__(self):
        """Validate request after initialization"""
        if self.start_date >= self.end_date:
            raise ValueError("Start date must be before end date")


@dataclass
class ChartDataResponse:
    """Response containing chart data"""
    request: ChartDataRequest
    data: List[OHLCV]
    data_quality_score: Optional[float] = None
    missing_data_points: int = 0
    total_data_points: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def coverage_percentage(self) -> float:
        """Calculate data coverage percentage"""
        if self.total_data_points == 0:
            return 0.0
        return ((self.total_data_points - self.missing_data_points) / self.total_data_points) * 100
    
    @property
    def is_complete(self) -> bool:
        """Check if data is complete (no missing points)"""
        return self.missing_data_points == 0


@dataclass
class DataTypeSwitch:
    """Event for switching between data types in UI"""
    symbol: Symbol
    from_data_type: DataType
    to_data_type: DataType
    timestamp: datetime
    user_initiated: bool = True