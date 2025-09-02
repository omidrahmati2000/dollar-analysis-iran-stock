"""
Market Data API endpoints
Provides real-time and historical market data for stocks and currencies
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional
from datetime import datetime, timedelta
import pandas as pd

from ..models import (
    SymbolInfo, PriceData, OHLCV, TimeFrame, AssetType, 
    MarketSummary, SearchResult, APIResponse
)
from ...database.db_manager import DatabaseManager

router = APIRouter()

def get_db_manager():
    """Dependency to get database manager"""
    return DatabaseManager()

@router.get("/summary", response_model=APIResponse)
async def get_market_summary(db: DatabaseManager = Depends(get_db_manager)):
    """Get market summary with top gainers, losers, and most active stocks"""
    try:
        with db.get_connection() as conn:
            with conn.cursor() as cur:
                # Get total counts
                cur.execute("SELECT COUNT(*) FROM stock_symbols WHERE is_active = true")
                total_stocks = cur.fetchone()[0] or 0
                
                cur.execute("SELECT COUNT(*) FROM currencies WHERE is_active = true")
                total_currencies = cur.fetchone()[0] or 0
                
                # Get top gainers (top 10)
                cur.execute("""
                    SELECT 
                        ss.symbol, ss.name, 'stock' as asset_type,
                        sp.close_price as price, sp.change_amount as change,
                        sp.change_percent, sp.volume, sp.last_update
                    FROM stock_symbols ss
                    JOIN stock_prices sp ON ss.stock_id = sp.stock_id
                    WHERE ss.is_active = true
                    ORDER BY sp.change_percent DESC
                    LIMIT 10
                """)
                
                top_gainers = []
                for row in cur.fetchall():
                    top_gainers.append(SymbolInfo(
                        symbol=row[0],
                        name=row[1],
                        asset_type=row[2],
                        price=row[3],
                        change=row[4],
                        change_percent=row[5],
                        volume=row[6],
                        last_update=row[7]
                    ))
                
                # Get top losers (top 10)
                cur.execute("""
                    SELECT 
                        ss.symbol, ss.name, 'stock' as asset_type,
                        sp.close_price as price, sp.change_amount as change,
                        sp.change_percent, sp.volume, sp.last_update
                    FROM stock_symbols ss
                    JOIN stock_prices sp ON ss.stock_id = sp.stock_id
                    WHERE ss.is_active = true
                    ORDER BY sp.change_percent ASC
                    LIMIT 10
                """)
                
                top_losers = []
                for row in cur.fetchall():
                    top_losers.append(SymbolInfo(
                        symbol=row[0],
                        name=row[1],
                        asset_type=row[2],
                        price=row[3],
                        change=row[4],
                        change_percent=row[5],
                        volume=row[6],
                        last_update=row[7]
                    ))
                
                # Get most active (by volume)
                cur.execute("""
                    SELECT 
                        ss.symbol, ss.name, 'stock' as asset_type,
                        sp.close_price as price, sp.change_amount as change,
                        sp.change_percent, sp.volume, sp.last_update
                    FROM stock_symbols ss
                    JOIN stock_prices sp ON ss.stock_id = sp.stock_id
                    WHERE ss.is_active = true AND sp.volume > 0
                    ORDER BY sp.volume DESC
                    LIMIT 10
                """)
                
                most_active = []
                for row in cur.fetchall():
                    most_active.append(SymbolInfo(
                        symbol=row[0],
                        name=row[1],
                        asset_type=row[2],
                        price=row[3],
                        change=row[4],
                        change_percent=row[5],
                        volume=row[6],
                        last_update=row[7]
                    ))
                
                summary = MarketSummary(
                    total_stocks=total_stocks,
                    total_currencies=total_currencies,
                    top_gainers=top_gainers,
                    top_losers=top_losers,
                    most_active=most_active,
                    market_status="open",  # This would be calculated based on market hours
                    last_update=datetime.now()
                )
                
                return APIResponse(data=summary)
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get market summary: {str(e)}")

@router.get("/stocks/symbols", response_model=APIResponse)
async def get_stock_symbols(
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = None,
    db: DatabaseManager = Depends(get_db_manager)
):
    """Get list of stock symbols with optional search"""
    try:
        with db.get_connection() as conn:
            with conn.cursor() as cur:
                # Build query
                where_clause = "WHERE ss.is_active = true"
                params = []
                
                if search:
                    where_clause += " AND (ss.symbol ILIKE %s OR ss.name ILIKE %s)"
                    search_term = f"%{search}%"
                    params.extend([search_term, search_term])
                
                query = f"""
                    SELECT 
                        ss.symbol, ss.name, 'stock' as asset_type,
                        ss.exchange, ss.sector, ss.market_cap,
                        sp.close_price as price, sp.change_amount as change,
                        sp.change_percent, sp.volume, sp.last_update
                    FROM stock_symbols ss
                    LEFT JOIN stock_prices sp ON ss.stock_id = sp.stock_id
                    {where_clause}
                    ORDER BY ss.symbol
                    LIMIT %s OFFSET %s
                """
                
                params.extend([limit, offset])
                cur.execute(query, params)
                
                symbols = []
                for row in cur.fetchall():
                    symbols.append(SymbolInfo(
                        symbol=row[0],
                        name=row[1],
                        asset_type=row[2],
                        exchange=row[3],
                        sector=row[4],
                        market_cap=row[5],
                        price=row[6],
                        change=row[7],
                        change_percent=row[8],
                        volume=row[9],
                        last_update=row[10]
                    ))
                
                return APIResponse(data=symbols)
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get stock symbols: {str(e)}")

@router.get("/currencies", response_model=APIResponse)
async def get_currencies(
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = None,
    db: DatabaseManager = Depends(get_db_manager)
):
    """Get list of currencies with optional search"""
    try:
        with db.get_connection() as conn:
            with conn.cursor() as cur:
                # Build query
                where_clause = "WHERE c.is_active = true"
                params = []
                
                if search:
                    where_clause += " AND (c.symbol ILIKE %s OR c.name ILIKE %s)"
                    search_term = f"%{search}%"
                    params.extend([search_term, search_term])
                
                query = f"""
                    SELECT 
                        c.symbol, c.name, 
                        CASE 
                            WHEN c.symbol LIKE '%USD%' OR c.symbol LIKE '%EUR%' THEN 'currency'
                            WHEN c.symbol LIKE '%GOLD%' OR c.symbol LIKE '%SILVER%' THEN 'commodity'
                            WHEN c.symbol LIKE '%BTC%' OR c.symbol LIKE '%ETH%' THEN 'crypto'
                            ELSE 'currency'
                        END as asset_type,
                        ch.price, ch.change_amount as change,
                        ch.change_percent, ch.last_update
                    FROM currencies c
                    LEFT JOIN LATERAL (
                        SELECT price, change_amount, change_percent, last_update
                        FROM currency_history 
                        WHERE currency_id = c.currency_id 
                        ORDER BY date_time DESC 
                        LIMIT 1
                    ) ch ON true
                    {where_clause}
                    ORDER BY c.symbol
                    LIMIT %s OFFSET %s
                """
                
                params.extend([limit, offset])
                cur.execute(query, params)
                
                currencies = []
                for row in cur.fetchall():
                    currencies.append(SymbolInfo(
                        symbol=row[0],
                        name=row[1],
                        asset_type=row[2],
                        price=row[3],
                        change=row[4],
                        change_percent=row[5],
                        last_update=row[6]
                    ))
                
                return APIResponse(data=currencies)
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get currencies: {str(e)}")

@router.get("/price/{symbol}", response_model=APIResponse)
async def get_price_data(
    symbol: str,
    timeframe: TimeFrame = TimeFrame.D1,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = Query(default=100, le=5000),
    data_type: int = Query(default=3, description="2=unadjusted, 3=adjusted"),
    db: DatabaseManager = Depends(get_db_manager)
):
    """Get historical price data for a symbol"""
    try:
        with db.get_connection() as conn:
            with conn.cursor() as cur:
                # Default date range if not provided
                if not end_date:
                    end_date = datetime.now()
                if not start_date:
                    start_date = end_date - timedelta(days=365)
                
                # Check if it's a stock or currency
                cur.execute("SELECT stock_id FROM stock_symbols WHERE symbol = %s", (symbol,))
                stock_result = cur.fetchone()
                
                if stock_result:
                    # It's a stock - get candlestick data
                    stock_id = stock_result[0]
                    
                    query = """
                        SELECT date_time, open_price, high_price, low_price, close_price, volume
                        FROM candlestick_data
                        WHERE stock_id = %s AND data_type = %s
                        AND date_time BETWEEN %s AND %s
                        ORDER BY date_time DESC
                        LIMIT %s
                    """
                    
                    cur.execute(query, (stock_id, data_type, start_date, end_date, limit))
                    
                else:
                    # Check if it's a currency
                    cur.execute("SELECT currency_id FROM currencies WHERE symbol = %s", (symbol,))
                    currency_result = cur.fetchone()
                    
                    if currency_result:
                        currency_id = currency_result[0]
                        
                        query = """
                            SELECT date_time, price as open_price, price as high_price, 
                                   price as low_price, price as close_price, 0 as volume
                            FROM currency_history
                            WHERE currency_id = %s
                            AND date_time BETWEEN %s AND %s
                            ORDER BY date_time DESC
                            LIMIT %s
                        """
                        
                        cur.execute(query, (currency_id, start_date, end_date, limit))
                    else:
                        raise HTTPException(status_code=404, detail=f"Symbol '{symbol}' not found")
                
                ohlcv_data = []
                for row in cur.fetchall():
                    ohlcv_data.append(OHLCV(
                        timestamp=row[0],
                        open=float(row[1]) if row[1] else 0.0,
                        high=float(row[2]) if row[2] else 0.0,
                        low=float(row[3]) if row[3] else 0.0,
                        close=float(row[4]) if row[4] else 0.0,
                        volume=int(row[5]) if row[5] else 0,
                        symbol=symbol
                    ))
                
                # Reverse to get chronological order
                ohlcv_data.reverse()
                
                price_data = PriceData(
                    symbol=symbol,
                    timeframe=timeframe,
                    data=ohlcv_data,
                    count=len(ohlcv_data)
                )
                
                return APIResponse(data=price_data)
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get price data: {str(e)}")

@router.get("/search", response_model=APIResponse)
async def search_symbols(
    query: str = Query(min_length=1),
    asset_types: Optional[List[AssetType]] = Query(default=None),
    limit: int = Query(default=20, le=100),
    db: DatabaseManager = Depends(get_db_manager)
):
    """Search for symbols across stocks and currencies"""
    try:
        search_results = []
        
        with db.get_connection() as conn:
            with conn.cursor() as cur:
                # Search stocks
                if not asset_types or AssetType.STOCK in asset_types:
                    cur.execute("""
                        SELECT symbol, name, 'stock' as asset_type, exchange,
                               SIMILARITY(symbol || ' ' || name, %s) as score
                        FROM stock_symbols
                        WHERE is_active = true
                        AND (symbol ILIKE %s OR name ILIKE %s)
                        ORDER BY score DESC
                        LIMIT %s
                    """, (query, f"%{query}%", f"%{query}%", limit // 2))
                    
                    for row in cur.fetchall():
                        search_results.append(SearchResult(
                            symbol=row[0],
                            name=row[1],
                            asset_type=row[2],
                            exchange=row[3],
                            score=row[4] if row[4] else 0.5
                        ))
                
                # Search currencies
                if not asset_types or any(at in [AssetType.CURRENCY, AssetType.CRYPTO, AssetType.COMMODITY] for at in asset_types):
                    cur.execute("""
                        SELECT symbol, name,
                               CASE 
                                   WHEN symbol LIKE '%USD%' OR symbol LIKE '%EUR%' THEN 'currency'
                                   WHEN symbol LIKE '%GOLD%' OR symbol LIKE '%SILVER%' THEN 'commodity'
                                   WHEN symbol LIKE '%BTC%' OR symbol LIKE '%ETH%' THEN 'crypto'
                                   ELSE 'currency'
                               END as asset_type,
                               SIMILARITY(symbol || ' ' || name, %s) as score
                        FROM currencies
                        WHERE is_active = true
                        AND (symbol ILIKE %s OR name ILIKE %s)
                        ORDER BY score DESC
                        LIMIT %s
                    """, (query, f"%{query}%", f"%{query}%", limit // 2))
                    
                    for row in cur.fetchall():
                        search_results.append(SearchResult(
                            symbol=row[0],
                            name=row[1],
                            asset_type=row[2],
                            score=row[3] if row[3] else 0.5
                        ))
                
                # Sort by relevance score
                search_results.sort(key=lambda x: x.score, reverse=True)
                
                return APIResponse(data=search_results[:limit])
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@router.get("/symbol/{symbol}/info", response_model=APIResponse)
async def get_symbol_info(
    symbol: str,
    db: DatabaseManager = Depends(get_db_manager)
):
    """Get detailed information about a specific symbol"""
    try:
        with db.get_connection() as conn:
            with conn.cursor() as cur:
                # Try to find in stocks first
                cur.execute("""
                    SELECT 
                        ss.symbol, ss.name, 'stock' as asset_type,
                        ss.exchange, ss.sector, ss.market_cap, ss.description,
                        sp.close_price as price, sp.change_amount as change,
                        sp.change_percent, sp.volume, sp.last_update,
                        sp.open_price, sp.high_price, sp.low_price
                    FROM stock_symbols ss
                    LEFT JOIN stock_prices sp ON ss.stock_id = sp.stock_id
                    WHERE ss.symbol = %s
                """, (symbol,))
                
                result = cur.fetchone()
                
                if result:
                    symbol_info = {
                        "symbol": result[0],
                        "name": result[1],
                        "asset_type": result[2],
                        "exchange": result[3],
                        "sector": result[4],
                        "market_cap": result[5],
                        "description": result[6],
                        "price": result[7],
                        "change": result[8],
                        "change_percent": result[9],
                        "volume": result[10],
                        "last_update": result[11],
                        "open": result[12],
                        "high": result[13],
                        "low": result[14]
                    }
                    
                    return APIResponse(data=symbol_info)
                
                # Try currencies
                cur.execute("""
                    SELECT 
                        c.symbol, c.name,
                        CASE 
                            WHEN c.symbol LIKE '%USD%' OR c.symbol LIKE '%EUR%' THEN 'currency'
                            WHEN c.symbol LIKE '%GOLD%' OR c.symbol LIKE '%SILVER%' THEN 'commodity'
                            WHEN c.symbol LIKE '%BTC%' OR c.symbol LIKE '%ETH%' THEN 'crypto'
                            ELSE 'currency'
                        END as asset_type,
                        c.description, ch.price, ch.change_amount as change,
                        ch.change_percent, ch.last_update
                    FROM currencies c
                    LEFT JOIN LATERAL (
                        SELECT price, change_amount, change_percent, last_update
                        FROM currency_history 
                        WHERE currency_id = c.currency_id 
                        ORDER BY date_time DESC 
                        LIMIT 1
                    ) ch ON true
                    WHERE c.symbol = %s
                """, (symbol,))
                
                result = cur.fetchone()
                
                if result:
                    symbol_info = {
                        "symbol": result[0],
                        "name": result[1],
                        "asset_type": result[2],
                        "description": result[3],
                        "price": result[4],
                        "change": result[5],
                        "change_percent": result[6],
                        "last_update": result[7]
                    }
                    
                    return APIResponse(data=symbol_info)
                
                raise HTTPException(status_code=404, detail=f"Symbol '{symbol}' not found")
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get symbol info: {str(e)}")