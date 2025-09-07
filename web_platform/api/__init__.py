"""
API Routes for Web Trading Platform
"""

from fastapi import APIRouter

# Import all route modules
from .market_data import router as market_data_router
from .indicators import router as indicators_router
from .portfolio import router as portfolio_router
from .watchlist import router as watchlist_router
from .alerts import router as alerts_router
from .screener import router as screener_router
from .backtest import router as backtest_router

# Create main API router
api_router = APIRouter()

# Include all route modules
api_router.include_router(market_data_router, prefix="/market-data", tags=["Market Data"])
api_router.include_router(indicators_router, prefix="/indicators", tags=["Technical Indicators"])
api_router.include_router(portfolio_router, prefix="/portfolio", tags=["Portfolio Management"])
api_router.include_router(watchlist_router, prefix="/watchlist", tags=["Watchlist"])
api_router.include_router(alerts_router, prefix="/alerts", tags=["Price Alerts"])
api_router.include_router(screener_router, prefix="/screener", tags=["Stock Screener"])
api_router.include_router(backtest_router, prefix="/backtest", tags=["Backtesting"])