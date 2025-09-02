"""
Technical Indicators API endpoints
Provides technical indicator calculations for charting and analysis
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

from ..models import (
    IndicatorConfig, IndicatorType, TimeFrame, APIResponse,
    SMAConfig, EMAConfig, RSIConfig, MACDConfig, BollingerBandsConfig
)
from ...database.db_manager import DatabaseManager
from ...trading_platform.indicators.factory import IndicatorFactory
from ...trading_platform.indicators.moving_averages import SMA, EMA
from ...trading_platform.indicators.oscillators import RSI, MACD
from ...trading_platform.indicators.volatility import BollingerBands

router = APIRouter()

def get_db_manager():
    """Dependency to get database manager"""
    return DatabaseManager()

def get_indicator_factory():
    """Get indicator factory instance"""
    return IndicatorFactory()

@router.get("/available", response_model=APIResponse)
async def get_available_indicators():
    """Get list of available technical indicators"""
    indicators_info = {
        "moving_averages": [
            {
                "type": "sma",
                "name": "Simple Moving Average",
                "description": "The arithmetic mean of prices over N periods",
                "parameters": {
                    "period": {"type": "int", "default": 20, "min": 1, "max": 200}
                }
            },
            {
                "type": "ema", 
                "name": "Exponential Moving Average",
                "description": "Exponentially weighted moving average giving more weight to recent prices",
                "parameters": {
                    "period": {"type": "int", "default": 20, "min": 1, "max": 200}
                }
            }
        ],
        "oscillators": [
            {
                "type": "rsi",
                "name": "Relative Strength Index",
                "description": "Momentum oscillator measuring speed and magnitude of price changes",
                "parameters": {
                    "period": {"type": "int", "default": 14, "min": 1, "max": 100},
                    "overbought": {"type": "float", "default": 70, "min": 50, "max": 100},
                    "oversold": {"type": "float", "default": 30, "min": 0, "max": 50}
                }
            },
            {
                "type": "macd",
                "name": "MACD (Moving Average Convergence Divergence)",
                "description": "Trend-following momentum indicator",
                "parameters": {
                    "fast_period": {"type": "int", "default": 12, "min": 1, "max": 50},
                    "slow_period": {"type": "int", "default": 26, "min": 1, "max": 100},
                    "signal_period": {"type": "int", "default": 9, "min": 1, "max": 50}
                }
            }
        ],
        "volatility": [
            {
                "type": "bollinger_bands",
                "name": "Bollinger Bands",
                "description": "Volatility indicator with upper and lower bands",
                "parameters": {
                    "period": {"type": "int", "default": 20, "min": 1, "max": 100},
                    "std_dev": {"type": "float", "default": 2.0, "min": 0.5, "max": 5.0}
                }
            }
        ],
        "trend": [
            {
                "type": "atr",
                "name": "Average True Range",
                "description": "Measure of volatility",
                "parameters": {
                    "period": {"type": "int", "default": 14, "min": 1, "max": 50}
                }
            },
            {
                "type": "adx",
                "name": "Average Directional Index",
                "description": "Trend strength indicator",
                "parameters": {
                    "period": {"type": "int", "default": 14, "min": 1, "max": 50}
                }
            }
        ],
        "volume": [
            {
                "type": "obv",
                "name": "On-Balance Volume",
                "description": "Volume-based momentum indicator"
            },
            {
                "type": "volume_ma",
                "name": "Volume Moving Average",
                "description": "Moving average of volume",
                "parameters": {
                    "period": {"type": "int", "default": 20, "min": 1, "max": 100}
                }
            }
        ]
    }
    
    return APIResponse(data=indicators_info)

@router.post("/calculate/{indicator_type}", response_model=APIResponse)
async def calculate_indicator(
    indicator_type: IndicatorType,
    symbol: str,
    timeframe: TimeFrame = TimeFrame.D1,
    config: Dict[str, Any] = {},
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: DatabaseManager = Depends(get_db_manager)
):
    """Calculate technical indicator for a symbol"""
    try:
        # Get price data
        with db.get_connection() as conn:
            with conn.cursor() as cur:
                # Default date range
                if not end_date:
                    end_date = datetime.now()
                if not start_date:
                    start_date = end_date - timedelta(days=365)
                
                # Check if it's a stock
                cur.execute("SELECT stock_id FROM stock_symbols WHERE symbol = %s", (symbol,))
                stock_result = cur.fetchone()
                
                if stock_result:
                    stock_id = stock_result[0]
                    
                    cur.execute("""
                        SELECT date_time, open_price, high_price, low_price, close_price, volume
                        FROM candlestick_data
                        WHERE stock_id = %s AND data_type = 3
                        AND date_time BETWEEN %s AND %s
                        ORDER BY date_time ASC
                    """, (stock_id, start_date, end_date))
                else:
                    # Check currency
                    cur.execute("SELECT currency_id FROM currencies WHERE symbol = %s", (symbol,))
                    currency_result = cur.fetchone()
                    
                    if not currency_result:
                        raise HTTPException(status_code=404, detail=f"Symbol '{symbol}' not found")
                    
                    currency_id = currency_result[0]
                    
                    cur.execute("""
                        SELECT date_time, price as open_price, price as high_price,
                               price as low_price, price as close_price, 0 as volume
                        FROM currency_history
                        WHERE currency_id = %s
                        AND date_time BETWEEN %s AND %s
                        ORDER BY date_time ASC
                    """, (currency_id, start_date, end_date))
                
                rows = cur.fetchall()
                
                if not rows:
                    raise HTTPException(status_code=404, detail=f"No price data found for symbol '{symbol}'")
                
                # Convert to pandas DataFrame
                df = pd.DataFrame(rows, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
                df['open'] = df['open'].astype(float)
                df['high'] = df['high'].astype(float)
                df['low'] = df['low'].astype(float)
                df['close'] = df['close'].astype(float)
                df['volume'] = df['volume'].astype(int)
                
                # Calculate indicator
                result_data = {}
                
                if indicator_type == IndicatorType.SMA:
                    period = config.get('period', 20)
                    sma_values = df['close'].rolling(window=period).mean()
                    
                    result_data = {
                        'indicator': 'SMA',
                        'period': period,
                        'values': [
                            {
                                'timestamp': df.iloc[i]['timestamp'],
                                'value': float(sma_values.iloc[i]) if not pd.isna(sma_values.iloc[i]) else None
                            }
                            for i in range(len(df))
                        ]
                    }
                
                elif indicator_type == IndicatorType.EMA:
                    period = config.get('period', 20)
                    ema_values = df['close'].ewm(span=period).mean()
                    
                    result_data = {
                        'indicator': 'EMA',
                        'period': period,
                        'values': [
                            {
                                'timestamp': df.iloc[i]['timestamp'],
                                'value': float(ema_values.iloc[i]) if not pd.isna(ema_values.iloc[i]) else None
                            }
                            for i in range(len(df))
                        ]
                    }
                
                elif indicator_type == IndicatorType.RSI:
                    period = config.get('period', 14)
                    
                    # Calculate RSI
                    delta = df['close'].diff()
                    gain = delta.where(delta > 0, 0)
                    loss = -delta.where(delta < 0, 0)
                    
                    avg_gain = gain.rolling(window=period).mean()
                    avg_loss = loss.rolling(window=period).mean()
                    
                    rs = avg_gain / avg_loss
                    rsi = 100 - (100 / (1 + rs))
                    
                    overbought = config.get('overbought', 70)
                    oversold = config.get('oversold', 30)
                    
                    result_data = {
                        'indicator': 'RSI',
                        'period': period,
                        'overbought': overbought,
                        'oversold': oversold,
                        'values': [
                            {
                                'timestamp': df.iloc[i]['timestamp'],
                                'value': float(rsi.iloc[i]) if not pd.isna(rsi.iloc[i]) else None
                            }
                            for i in range(len(df))
                        ]
                    }
                
                elif indicator_type == IndicatorType.MACD:
                    fast_period = config.get('fast_period', 12)
                    slow_period = config.get('slow_period', 26)
                    signal_period = config.get('signal_period', 9)
                    
                    # Calculate MACD
                    ema_fast = df['close'].ewm(span=fast_period).mean()
                    ema_slow = df['close'].ewm(span=slow_period).mean()
                    macd_line = ema_fast - ema_slow
                    signal_line = macd_line.ewm(span=signal_period).mean()
                    histogram = macd_line - signal_line
                    
                    result_data = {
                        'indicator': 'MACD',
                        'fast_period': fast_period,
                        'slow_period': slow_period,
                        'signal_period': signal_period,
                        'values': [
                            {
                                'timestamp': df.iloc[i]['timestamp'],
                                'macd': float(macd_line.iloc[i]) if not pd.isna(macd_line.iloc[i]) else None,
                                'signal': float(signal_line.iloc[i]) if not pd.isna(signal_line.iloc[i]) else None,
                                'histogram': float(histogram.iloc[i]) if not pd.isna(histogram.iloc[i]) else None
                            }
                            for i in range(len(df))
                        ]
                    }
                
                elif indicator_type == IndicatorType.BB:
                    period = config.get('period', 20)
                    std_dev = config.get('std_dev', 2.0)
                    
                    # Calculate Bollinger Bands
                    sma = df['close'].rolling(window=period).mean()
                    std = df['close'].rolling(window=period).std()
                    
                    upper_band = sma + (std * std_dev)
                    lower_band = sma - (std * std_dev)
                    
                    result_data = {
                        'indicator': 'Bollinger Bands',
                        'period': period,
                        'std_dev': std_dev,
                        'values': [
                            {
                                'timestamp': df.iloc[i]['timestamp'],
                                'middle': float(sma.iloc[i]) if not pd.isna(sma.iloc[i]) else None,
                                'upper': float(upper_band.iloc[i]) if not pd.isna(upper_band.iloc[i]) else None,
                                'lower': float(lower_band.iloc[i]) if not pd.isna(lower_band.iloc[i]) else None
                            }
                            for i in range(len(df))
                        ]
                    }
                
                else:
                    raise HTTPException(status_code=400, detail=f"Indicator type '{indicator_type}' not implemented")
                
                result_data['symbol'] = symbol
                result_data['timeframe'] = timeframe
                result_data['start_date'] = start_date
                result_data['end_date'] = end_date
                result_data['count'] = len(df)
                
                return APIResponse(data=result_data)
                
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate indicator: {str(e)}")

@router.post("/batch", response_model=APIResponse) 
async def calculate_multiple_indicators(
    symbol: str,
    timeframe: TimeFrame = TimeFrame.D1,
    indicators: List[Dict[str, Any]] = [],
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: DatabaseManager = Depends(get_db_manager)
):
    """Calculate multiple indicators for a symbol in one request"""
    try:
        if not indicators:
            raise HTTPException(status_code=400, detail="No indicators specified")
        
        results = {}
        
        for indicator_config in indicators:
            indicator_type = indicator_config.get('type')
            config = indicator_config.get('config', {})
            
            if not indicator_type:
                continue
                
            try:
                # Call single indicator calculation
                indicator_result = await calculate_indicator(
                    IndicatorType(indicator_type),
                    symbol,
                    timeframe,
                    config,
                    start_date,
                    end_date,
                    db
                )
                
                results[indicator_type] = indicator_result.data
                
            except Exception as e:
                results[indicator_type] = {"error": str(e)}
        
        return APIResponse(data=results)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate indicators: {str(e)}")

@router.get("/signals/{symbol}", response_model=APIResponse)
async def get_trading_signals(
    symbol: str,
    timeframe: TimeFrame = TimeFrame.D1,
    lookback_days: int = 30,
    db: DatabaseManager = Depends(get_db_manager)
):
    """Get basic trading signals based on technical indicators"""
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=lookback_days + 50)  # Extra data for indicator calculation
        
        signals = {}
        
        # Calculate RSI signals
        try:
            rsi_result = await calculate_indicator(
                IndicatorType.RSI,
                symbol,
                timeframe,
                {'period': 14, 'overbought': 70, 'oversold': 30},
                start_date,
                end_date,
                db
            )
            
            rsi_data = rsi_result.data
            if rsi_data and rsi_data.get('values'):
                latest_rsi = None
                for value in reversed(rsi_data['values']):
                    if value.get('value') is not None:
                        latest_rsi = value['value']
                        break
                
                if latest_rsi:
                    if latest_rsi > 70:
                        signals['RSI'] = {'signal': 'SELL', 'value': latest_rsi, 'reason': 'Overbought'}
                    elif latest_rsi < 30:
                        signals['RSI'] = {'signal': 'BUY', 'value': latest_rsi, 'reason': 'Oversold'}
                    else:
                        signals['RSI'] = {'signal': 'NEUTRAL', 'value': latest_rsi, 'reason': 'Normal range'}
        
        except Exception as e:
            signals['RSI'] = {'error': str(e)}
        
        # Calculate Moving Average signals
        try:
            sma20_result = await calculate_indicator(
                IndicatorType.SMA,
                symbol,
                timeframe,
                {'period': 20},
                start_date,
                end_date,
                db
            )
            
            sma50_result = await calculate_indicator(
                IndicatorType.SMA,
                symbol,
                timeframe,
                {'period': 50},
                start_date,
                end_date,
                db
            )
            
            # Get latest values
            latest_sma20 = None
            latest_sma50 = None
            
            if sma20_result.data and sma20_result.data.get('values'):
                for value in reversed(sma20_result.data['values']):
                    if value.get('value') is not None:
                        latest_sma20 = value['value']
                        break
            
            if sma50_result.data and sma50_result.data.get('values'):
                for value in reversed(sma50_result.data['values']):
                    if value.get('value') is not None:
                        latest_sma50 = value['value']
                        break
            
            if latest_sma20 and latest_sma50:
                if latest_sma20 > latest_sma50:
                    signals['MA_Cross'] = {
                        'signal': 'BUY',
                        'sma20': latest_sma20,
                        'sma50': latest_sma50,
                        'reason': 'SMA20 above SMA50 (bullish)'
                    }
                else:
                    signals['MA_Cross'] = {
                        'signal': 'SELL',
                        'sma20': latest_sma20,
                        'sma50': latest_sma50,
                        'reason': 'SMA20 below SMA50 (bearish)'
                    }
        
        except Exception as e:
            signals['MA_Cross'] = {'error': str(e)}
        
        # Calculate MACD signals
        try:
            macd_result = await calculate_indicator(
                IndicatorType.MACD,
                symbol,
                timeframe,
                {'fast_period': 12, 'slow_period': 26, 'signal_period': 9},
                start_date,
                end_date,
                db
            )
            
            if macd_result.data and macd_result.data.get('values'):
                latest_macd = None
                for value in reversed(macd_result.data['values']):
                    if (value.get('macd') is not None and 
                        value.get('signal') is not None):
                        latest_macd = value
                        break
                
                if latest_macd:
                    macd_line = latest_macd['macd']
                    signal_line = latest_macd['signal']
                    
                    if macd_line > signal_line:
                        signals['MACD'] = {
                            'signal': 'BUY',
                            'macd': macd_line,
                            'signal_line': signal_line,
                            'reason': 'MACD above signal line (bullish)'
                        }
                    else:
                        signals['MACD'] = {
                            'signal': 'SELL',
                            'macd': macd_line,
                            'signal_line': signal_line,
                            'reason': 'MACD below signal line (bearish)'
                        }
        
        except Exception as e:
            signals['MACD'] = {'error': str(e)}
        
        # Calculate overall signal
        buy_signals = sum(1 for s in signals.values() if isinstance(s, dict) and s.get('signal') == 'BUY')
        sell_signals = sum(1 for s in signals.values() if isinstance(s, dict) and s.get('signal') == 'SELL')
        total_signals = buy_signals + sell_signals
        
        if total_signals > 0:
            if buy_signals > sell_signals:
                overall_signal = 'BUY'
                confidence = (buy_signals / total_signals) * 100
            elif sell_signals > buy_signals:
                overall_signal = 'SELL'
                confidence = (sell_signals / total_signals) * 100
            else:
                overall_signal = 'NEUTRAL'
                confidence = 50
        else:
            overall_signal = 'NEUTRAL'
            confidence = 0
        
        result = {
            'symbol': symbol,
            'timeframe': timeframe,
            'timestamp': datetime.now(),
            'overall_signal': overall_signal,
            'confidence': confidence,
            'individual_signals': signals
        }
        
        return APIResponse(data=result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get trading signals: {str(e)}")