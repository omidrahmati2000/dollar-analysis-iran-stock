# Force reload 2
# Force reload
"""
Iran Market Trading API - Main Application
Professional REST API with layered architecture and Swagger documentation
"""

from fastapi import FastAPI, HTTPException, Query, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

# Import configuration
from trading_platform.api.config import get_config

# Import repositories
from trading_platform.api.repositories.base import BaseRepository
from trading_platform.api.repositories.stock_repository import StockRepository
from trading_platform.api.repositories.currency_repository import CurrencyRepository
from trading_platform.api.repositories.indicator_repository import IndicatorRepository

# Import services
from trading_platform.api.services.stock_service import StockService
from trading_platform.api.services.currency_service import CurrencyService
from trading_platform.api.services.indicator_service import IndicatorService

# Get configuration
config = get_config()

# Custom JSON response class for proper UTF-8 encoding
class UTF8JSONResponse(JSONResponse):
    def render(self, content: Any) -> bytes:
        import json
        return json.dumps(
            content,
            ensure_ascii=False,  # Don't escape non-ASCII characters
            allow_nan=False,
            indent=None,
            separators=(",", ":")
        ).encode("utf-8")

# Initialize FastAPI app with Swagger documentation
app = FastAPI(
    title=config.API_TITLE,
    description=config.API_DESCRIPTION,
    version=config.API_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    default_response_class=UTF8JSONResponse  # Use UTF-8 JSON responses
)

# Configure CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "*"],  # Allow frontend
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Initialize repositories
stock_repository = StockRepository(config.DATABASE_CONFIG)
currency_repository = CurrencyRepository(config.DATABASE_CONFIG)
indicator_repository = IndicatorRepository(config.DATABASE_CONFIG)

# Initialize services
stock_service = StockService(stock_repository)
currency_service = CurrencyService(currency_repository)
indicator_service = IndicatorService(indicator_repository, stock_repository)


# ============== Request/Response Models ==============

class StockResponse(BaseModel):
    """Stock data response model"""
    symbol: str = Field(..., description="Stock symbol")
    company_name: str = Field(..., description="Company name")
    last_price: float = Field(..., description="Last traded price")
    price_change: float = Field(..., description="Price change amount")
    price_change_percent: float = Field(..., description="Price change percentage")
    volume: int = Field(..., description="Trading volume")
    market_cap: Optional[float] = Field(None, description="Market capitalization")
    last_update: str = Field(..., description="Last update timestamp")

    class Config:
        schema_extra = {
            "example": {
                "symbol": "TAPICO",
                "company_name": "تاپیکو",
                "last_price": 3500.0,
                "price_change": 50.0,
                "price_change_percent": 1.45,
                "volume": 25000000,
                "market_cap": 875000000000.0,
                "last_update": "2024-01-15T10:30:00"
            }
        }


class CurrencyResponse(BaseModel):
    """Currency data response model"""
    currency_code: str = Field(..., description="Currency code (e.g., USD)")
    currency_name: str = Field(..., description="Currency name")
    currency_name_fa: str = Field(..., description="Currency name in Persian")
    price_irr: float = Field(..., description="Price in Iranian Rial")
    change_24h: float = Field(..., description="24-hour price change")
    change_percent_24h: float = Field(..., description="24-hour change percentage")
    volume_24h: Optional[float] = Field(None, description="24-hour trading volume")
    last_update: str = Field(..., description="Last update timestamp")

    class Config:
        schema_extra = {
            "example": {
                "currency_code": "USD",
                "currency_name": "US Dollar",
                "currency_name_fa": "دلار آمریکا",
                "price_irr": 42500.0,
                "change_24h": 250.0,
                "change_percent_24h": 0.59,
                "volume_24h": 5000000.0,
                "last_update": "2024-01-15T10:30:00"
            }
        }


class OHLCVResponse(BaseModel):
    """OHLCV data response model"""
    symbol: str = Field(..., description="Stock symbol")
    date: str = Field(..., description="Trading date")
    open_price: float = Field(..., description="Opening price")
    high_price: float = Field(..., description="Highest price")
    low_price: float = Field(..., description="Lowest price")
    close_price: float = Field(..., description="Closing price")
    volume: int = Field(..., description="Trading volume")
    adjusted_close: float = Field(..., description="Adjusted closing price")
    daily_return: Optional[float] = Field(None, description="Daily return percentage")
    volatility: Optional[float] = Field(None, description="Daily volatility")


class TechnicalIndicatorResponse(BaseModel):
    """Technical indicator response model"""
    symbol: str = Field(..., description="Stock symbol")
    indicator_name: str = Field(..., description="Indicator name (e.g., RSI_14)")
    value: float = Field(..., description="Indicator value")
    signal: str = Field(..., description="Trading signal (BUY/SELL/HOLD)")
    calculation_date: str = Field(..., description="Calculation timestamp")

    class Config:
        schema_extra = {
            "example": {
                "symbol": "TAPICO",
                "indicator_name": "RSI_14",
                "value": 65.5,
                "signal": "HOLD",
                "calculation_date": "2024-01-15T10:30:00"
            }
        }


class MarketSummaryResponse(BaseModel):
    """Market summary response model"""
    total_volume: int = Field(..., description="Total trading volume")
    total_trades: int = Field(..., description="Total number of trades")
    total_market_cap: float = Field(..., description="Total market capitalization")
    active_symbols: int = Field(..., description="Number of active symbols")
    top_gainers: List[str] = Field(..., description="Top gaining stocks")
    top_losers: List[str] = Field(..., description="Top losing stocks")
    market_status: str = Field(..., description="Market status (OPEN/CLOSED/PRE_MARKET/AFTER_HOURS)")
    market_trend: str = Field(..., description="Market trend (BULLISH/BEARISH/NEUTRAL)")
    last_update: str = Field(..., description="Last update timestamp")


class CurrencyConversionRequest(BaseModel):
    """Currency conversion request model"""
    amount: float = Field(..., gt=0, description="Amount to convert")
    from_currency: str = Field(..., description="Source currency code")
    to_currency: str = Field(..., description="Target currency code")


class CurrencyConversionResponse(BaseModel):
    """Currency conversion response model"""
    from_currency: str
    to_currency: str
    amount: float
    converted_amount: float
    exchange_rate: float
    timestamp: str


# ============== API Endpoints ==============

@app.get("/",
         tags=["Health"],
         summary="Root endpoint",
         description="API root endpoint")
async def root():
    """Root endpoint"""
    return {
        "message": "Iran Market Trading API v2.0",
        "status": "running",
        "version": config.API_VERSION,
        "docs": "/docs"
    }


@app.get("/health",
         tags=["Health"], 
         summary="Health check",
         description="Check API health and database connectivity")
async def health_check():
    """Health check endpoint"""
    try:
        # Test database connection
        test_result = stock_repository.execute_query("SELECT 1 as test")
        db_status = "connected" if test_result else "disconnected"
    except Exception:
        db_status = "disconnected"
    
    return {
        "status": "healthy" if db_status == "connected" else "unhealthy",
        "database": db_status,
        "timestamp": datetime.now().isoformat(),
        "version": config.API_VERSION
    }


@app.get("/api/v2/stocks", 
         response_model=List[StockResponse],
         tags=["Stocks"],
         summary="Get stock list",
         description="Retrieve list of stocks with optional filtering and sorting")
async def get_stocks(
    limit: int = Query(50, ge=1, le=200, description="Number of results to return"),
    symbol_filter: Optional[str] = Query(None, description="Filter by symbol (partial match)"),
    min_volume: Optional[int] = Query(None, ge=0, description="Minimum trading volume"),
    sort_by: str = Query("volume", description="Sort field (volume/price/change)"),
    page: int = Query(1, ge=1, description="Page number for pagination")
):
    """Get list of stocks with filters"""
    try:
        offset = (page - 1) * limit
        stocks = stock_service.get_stocks(
            limit=limit,
            symbol_filter=symbol_filter,
            min_volume=min_volume,
            sort_by=sort_by,
            offset=offset
        )
        return stocks
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v2/stocks/search",
         tags=["Stocks"],
         summary="Search stocks",
         description="Search for stocks by symbol or company name")
async def search_stocks(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(10, ge=1, le=50, description="Maximum results")
):
    """Search for stocks"""
    try:
        results = stock_service.search_symbols(q, limit)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v2/stocks/{symbol}",
         response_model=StockResponse,
         tags=["Stocks"],
         summary="Get stock details",
         description="Retrieve detailed information for a specific stock")
async def get_stock_details(
    symbol: str = Path(..., description="Stock symbol")
):
    """Get detailed information for a specific stock"""
    try:
        stock = stock_service.get_stock_details(symbol)
        if not stock:
            raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")
        return stock
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v2/stocks/{symbol}/ohlcv",
         response_model=List[OHLCVResponse],
         tags=["Stocks"],
         summary="Get OHLCV data",
         description="Retrieve OHLCV (Open, High, Low, Close, Volume) data for a stock with timeframe support")
async def get_ohlcv_data(
    symbol: str = Path(..., description="Stock symbol"),
    days: int = Query(30, ge=1, le=365, description="Number of days of data (fallback when no date range specified)"),
    timeframe: str = Query("1d", description="Timeframe: 1d (daily), 1w (weekly), 1m (monthly), 1y (yearly)"),
    from_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD format)"),
    to_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD format)"),
    limit: Optional[int] = Query(None, ge=1, le=10000, description="Maximum number of data points to return")
):
    """Get OHLCV data for a stock with timeframe and pagination support"""
    try:
        ohlcv = stock_service.get_ohlcv(
            symbol=symbol, 
            days=days, 
            timeframe=timeframe,
            from_date=from_date,
            to_date=to_date,
            limit=limit
        )
        return ohlcv
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== Currency Endpoints ==============

@app.get("/api/v2/currencies",
         response_model=List[CurrencyResponse],
         tags=["Currencies"],
         summary="Get currency rates",
         description="Retrieve current currency exchange rates")
async def get_currencies(
    limit: int = Query(20, ge=1, le=100, description="Number of results"),
    currency_filter: Optional[str] = Query(None, description="Filter by currency code")
):
    """Get currency exchange rates"""
    try:
        currencies = currency_service.get_currencies(limit, currency_filter)
        return currencies
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v2/currencies/search",
         tags=["Currencies"],
         summary="Search currencies",
         description="Search for currencies by code or name")
async def search_currencies(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(10, ge=1, le=50, description="Maximum results")
):
    """Search for currencies"""
    try:
        results = currency_service.search_currencies(q, limit)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v2/currencies/{currency_code}",
         response_model=CurrencyResponse,
         tags=["Currencies"],
         summary="Get currency details",
         description="Retrieve detailed information for a specific currency")
async def get_currency_details(
    currency_code: str = Path(..., description="Currency code (e.g., USD)")
):
    """Get detailed information for a specific currency"""
    try:
        currency = currency_service.get_currency_details(currency_code)
        if not currency:
            raise HTTPException(status_code=404, detail=f"Currency {currency_code} not found")
        return currency
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v2/currencies/convert",
          response_model=CurrencyConversionResponse,
          tags=["Currencies"],
          summary="Convert currency",
          description="Convert amount between currencies")
async def convert_currency(request: CurrencyConversionRequest):
    """Convert amount between currencies"""
    try:
        result = currency_service.convert_currency(
            amount=request.amount,
            from_currency=request.from_currency,
            to_currency=request.to_currency
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v2/currencies/rates/all",
         tags=["Currencies"],
         summary="Get all exchange rates",
         description="Retrieve all current exchange rates")
async def get_all_exchange_rates():
    """Get all exchange rates"""
    try:
        rates = currency_service.get_exchange_rates()
        return {"rates": rates, "base": "IRR", "timestamp": datetime.now().isoformat()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== Technical Indicator Endpoints ==============

@app.get("/api/v2/indicators/{symbol}",
         response_model=List[TechnicalIndicatorResponse],
         tags=["Technical Analysis"],
         summary="Get technical indicators",
         description="Calculate and retrieve technical indicators for a stock")
async def get_technical_indicators(
    symbol: str = Path(..., description="Stock symbol"),
    indicators: Optional[str] = Query(None, description="Comma-separated indicator names (e.g., RSI_14,SMA_20)")
):
    """Get technical indicators for a stock"""
    try:
        indicator_list = indicators.split(",") if indicators else None
        results = indicator_service.calculate_indicators(symbol, indicator_list)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v2/indicators/signals/summary",
         tags=["Technical Analysis"],
         summary="Get signals summary",
         description="Get summary of trading signals across all stocks")
async def get_signals_summary(
    symbols: Optional[str] = Query(None, description="Comma-separated list of symbols to analyze")
):
    """Get trading signals summary"""
    try:
        symbol_list = symbols.split(",") if symbols else None
        summary = indicator_service.get_signals_summary(symbol_list)
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== Market Summary Endpoints ==============

@app.get("/api/v2/market/summary",
         response_model=MarketSummaryResponse,
         tags=["Market"],
         summary="Get market summary",
         description="Retrieve comprehensive market summary and statistics")
async def get_market_summary():
    """Get market summary"""
    try:
        summary = stock_service.get_market_summary()
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v2/market/currencies/statistics",
         tags=["Market"],
         summary="Get currency market statistics",
         description="Retrieve currency market statistics and analysis")
async def get_currency_statistics():
    """Get currency market statistics"""
    try:
        stats = currency_service.get_currency_statistics()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v2/market/stats",
         tags=["Market"],
         summary="Get accurate market statistics",
         description="Retrieve accurate market statistics including stock counts")
async def get_market_stats():
    """Get accurate market statistics"""
    try:
        stats = stock_service.get_market_stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v2/market/industry-groups",
         tags=["Market"],
         summary="Get industry groups analysis", 
         description="Retrieve industry groups with performance analysis")
async def get_industry_groups_analysis(
    price_type: int = Query(3, description="Price type: 2=unadjusted, 3=adjusted"),
    sort_by: str = Query("performance", description="Sort by: performance, total_stocks, positive_ratio"),
    from_date: Optional[str] = Query(None, description="Start date for analysis (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="End date for analysis (YYYY-MM-DD)")
):
    """Get industry groups analysis"""
    try:
        groups = stock_service.get_industry_groups_analysis(
            price_type=price_type,
            from_date=from_date,
            to_date=to_date
        )
        
        # Apply sorting
        if sort_by == "performance":
            groups.sort(key=lambda x: x.get('avg_change_percent', 0), reverse=True)
        elif sort_by == "total_stocks":
            groups.sort(key=lambda x: x.get('total_stocks', 0), reverse=True)
        elif sort_by == "positive_ratio":
            groups.sort(key=lambda x: x.get('positive_ratio', 0), reverse=True)
        
        return {
            "groups": groups,
            "price_type": price_type,
            "price_type_description": "Adjusted" if price_type == 3 else "Unadjusted",
            "total_groups": len(groups),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v2/market/industry-groups/{industry_group}/stocks",
         tags=["Market"],
         summary="Get stocks by industry group",
         description="Retrieve stocks filtered by industry group with performance data")
async def get_stocks_by_industry(
    industry_group: str = Path(..., description="Industry group name"),
    price_type: int = Query(3, description="Price type: 2=unadjusted, 3=adjusted"),
    sort_by: str = Query("performance", description="Sort by: performance, price, volume, market_value, symbol, name"),
    limit: int = Query(50, ge=1, le=200, description="Number of results to return"),
    from_date: Optional[str] = Query(None, description="Start date for analysis (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="End date for analysis (YYYY-MM-DD)")
):
    """Get stocks by industry group"""
    try:
        stocks = stock_service.get_stocks_by_industry(
            industry_group=industry_group,
            price_type=price_type,
            sort_by=sort_by,
            limit=limit,
            from_date=from_date,
            to_date=to_date
        )
        
        return {
            "stocks": stocks,
            "industry_group": industry_group,
            "price_type": price_type,
            "price_type_description": "Adjusted" if price_type == 3 else "Unadjusted",
            "total_stocks": len(stocks),
            "sort_by": sort_by,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== Error Handlers ==============

@app.exception_handler(404)
async def not_found_handler(request, exc):
    """Handle 404 errors"""
    return JSONResponse(
        status_code=404,
        content={"detail": "Resource not found"}
    )


@app.exception_handler(500)
async def internal_error_handler(request, exc):
    """Handle 500 errors"""
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )


@app.get("/debug/repository", tags=["Debug"])
async def debug_repository():
    """Test repository directly"""
    try:
        # Test repository query directly
        result = stock_repository.execute_query(
            "SELECT symbol, company_name FROM stock_symbols LIMIT 5"
        )
        return {
            "status": "success",
            "count": len(result),
            "data": result,
            "type": str(type(result))
        }
    except Exception as e:
        import traceback
        return {
            "status": "error", 
            "error": str(e),
            "traceback": traceback.format_exc()
        }

@app.get("/debug/currency-repository", tags=["Debug"])
async def debug_currency_repository():
    """Test currency repository directly"""
    try:
        # Test currency repository query directly
        result = currency_repository.get_currencies(limit=3)
        return {
            "status": "success",
            "count": len(result),
            "data": result,
            "type": str(type(result))
        }
    except Exception as e:
        import traceback
        return {
            "status": "error", 
            "error": str(e),
            "traceback": traceback.format_exc()
        }

@app.get("/debug/industry-groups", tags=["Debug"])
async def debug_industry_groups():
    """Test industry groups analysis directly"""
    try:
        # Test industry groups repository directly
        result = stock_repository.get_industry_groups_analysis(3)
        return {
            "status": "success",
            "count": len(result),
            "data": result,
            "type": str(type(result))
        }
    except Exception as e:
        import traceback
        return {
            "status": "error", 
            "error": str(e),
            "traceback": traceback.format_exc()
        }