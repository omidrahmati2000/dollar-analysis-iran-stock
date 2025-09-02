"""
Pydantic models for the Web Trading Platform API
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from enum import Enum

# Enums
class AssetType(str, Enum):
    STOCK = "stock"
    CURRENCY = "currency"
    CRYPTO = "crypto"
    COMMODITY = "commodity"

class TimeFrame(str, Enum):
    M1 = "1m"
    M5 = "5m" 
    M15 = "15m"
    M30 = "30m"
    H1 = "1h"
    H4 = "4h"
    D1 = "1d"
    W1 = "1w"
    MN1 = "1M"

class IndicatorType(str, Enum):
    SMA = "sma"
    EMA = "ema"
    RSI = "rsi"
    MACD = "macd"
    BB = "bollinger_bands"
    STOCH = "stochastic"
    ATR = "atr"
    ADX = "adx"
    CCI = "cci"
    WILLIAMS_R = "williams_r"

# Base Models
class SymbolInfo(BaseModel):
    symbol: str
    name: str
    asset_type: AssetType
    exchange: Optional[str] = None
    sector: Optional[str] = None
    market_cap: Optional[float] = None
    price: Optional[float] = None
    change: Optional[float] = None
    change_percent: Optional[float] = None
    volume: Optional[int] = None
    last_update: Optional[datetime] = None

class OHLCV(BaseModel):
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int
    symbol: str

class PriceData(BaseModel):
    symbol: str
    timeframe: TimeFrame
    data: List[OHLCV]
    count: int

# Indicator Models
class IndicatorConfig(BaseModel):
    type: IndicatorType
    params: Dict[str, Any] = {}
    
class SMAConfig(IndicatorConfig):
    type: IndicatorType = IndicatorType.SMA
    period: int = Field(default=20, ge=1, le=200)
    
class EMAConfig(IndicatorConfig):
    type: IndicatorType = IndicatorType.EMA
    period: int = Field(default=20, ge=1, le=200)
    
class RSIConfig(IndicatorConfig):
    type: IndicatorType = IndicatorType.RSI
    period: int = Field(default=14, ge=1, le=100)
    overbought: float = Field(default=70, ge=50, le=100)
    oversold: float = Field(default=30, ge=0, le=50)

class MACDConfig(IndicatorConfig):
    type: IndicatorType = IndicatorType.MACD
    fast_period: int = Field(default=12, ge=1, le=50)
    slow_period: int = Field(default=26, ge=1, le=100)
    signal_period: int = Field(default=9, ge=1, le=50)

class BollingerBandsConfig(IndicatorConfig):
    type: IndicatorType = IndicatorType.BB
    period: int = Field(default=20, ge=1, le=100)
    std_dev: float = Field(default=2.0, ge=0.5, le=5.0)

# Chart Models
class ChartConfig(BaseModel):
    symbol: str
    timeframe: TimeFrame
    indicators: List[IndicatorConfig] = []
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class ChartData(BaseModel):
    symbol: str
    timeframe: TimeFrame
    price_data: List[OHLCV]
    indicators: Dict[str, Any] = {}

# Portfolio Models
class Position(BaseModel):
    symbol: str
    quantity: float
    entry_price: float
    current_price: Optional[float] = None
    pnl: Optional[float] = None
    pnl_percent: Optional[float] = None
    entry_date: datetime
    
class Portfolio(BaseModel):
    id: str
    name: str
    user_id: str
    positions: List[Position] = []
    total_value: Optional[float] = None
    daily_pnl: Optional[float] = None
    total_pnl: Optional[float] = None
    created_at: datetime
    updated_at: datetime

# User Models  
class User(BaseModel):
    id: str
    username: str
    email: str
    full_name: Optional[str] = None
    is_active: bool = True
    is_premium: bool = False
    created_at: datetime

class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    email: str
    password: str = Field(min_length=6)
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int

# WebSocket Models
class WSMessage(BaseModel):
    type: str
    data: Any
    timestamp: datetime = Field(default_factory=datetime.now)

class PriceUpdate(BaseModel):
    symbol: str
    price: float
    change: float
    change_percent: float
    volume: int
    timestamp: datetime

class WSSubscribe(BaseModel):
    type: str = "subscribe"
    symbols: List[str]

class WSUnsubscribe(BaseModel):
    type: str = "unsubscribe" 
    symbols: List[str]

# API Response Models
class APIResponse(BaseModel):
    success: bool = True
    data: Any = None
    message: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)

class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    detail: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)

# Market Data Models
class MarketSummary(BaseModel):
    total_stocks: int
    total_currencies: int
    top_gainers: List[SymbolInfo]
    top_losers: List[SymbolInfo]
    most_active: List[SymbolInfo]
    market_status: str
    last_update: datetime

class SearchResult(BaseModel):
    symbol: str
    name: str
    asset_type: AssetType
    exchange: Optional[str] = None
    score: float = 0.0

# Watchlist Models
class Watchlist(BaseModel):
    id: str
    name: str
    user_id: str
    symbols: List[str] = []
    created_at: datetime
    updated_at: datetime

class WatchlistCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    symbols: List[str] = []

class WatchlistUpdate(BaseModel):
    name: Optional[str] = None
    symbols: Optional[List[str]] = None

# Alert Models
class PriceAlert(BaseModel):
    id: str
    user_id: str
    symbol: str
    condition: str  # "above", "below", "change_percent"
    target_price: Optional[float] = None
    change_percent: Optional[float] = None
    is_active: bool = True
    triggered: bool = False
    created_at: datetime
    triggered_at: Optional[datetime] = None

class AlertCreate(BaseModel):
    symbol: str
    condition: str
    target_price: Optional[float] = None
    change_percent: Optional[float] = None

# Economic Calendar Models
class EconomicEvent(BaseModel):
    id: str
    title: str
    country: str
    impact: str  # "low", "medium", "high"
    forecast: Optional[str] = None
    previous: Optional[str] = None
    actual: Optional[str] = None
    event_date: datetime
    currency: Optional[str] = None

# News Models
class NewsArticle(BaseModel):
    id: str
    title: str
    summary: Optional[str] = None
    content: Optional[str] = None
    source: str
    author: Optional[str] = None
    published_at: datetime
    related_symbols: List[str] = []
    sentiment: Optional[str] = None  # "positive", "negative", "neutral"
    url: Optional[str] = None

# Screener Models
class ScreenerFilter(BaseModel):
    field: str
    operator: str  # "gt", "lt", "eq", "gte", "lte", "between"
    value: Union[float, int, str]
    value2: Optional[Union[float, int, str]] = None  # For "between" operator

class ScreenerRequest(BaseModel):
    asset_type: Optional[AssetType] = None
    filters: List[ScreenerFilter] = []
    sort_by: Optional[str] = None
    sort_order: str = "desc"  # "asc" or "desc"
    limit: int = Field(default=50, le=1000)
    offset: int = 0

# Backtest Models
class BacktestStrategy(BaseModel):
    name: str
    entry_conditions: List[Dict[str, Any]]
    exit_conditions: List[Dict[str, Any]]
    position_size: float = 1.0
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None

class BacktestResult(BaseModel):
    strategy_name: str
    symbol: str
    start_date: datetime
    end_date: datetime
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    total_return: float
    max_drawdown: float
    sharpe_ratio: Optional[float] = None
    trades: List[Dict[str, Any]] = []