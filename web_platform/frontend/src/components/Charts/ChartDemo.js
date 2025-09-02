import React, { useState, useEffect } from 'react';
import SuperChart from './SuperChart';
import ApiStatus from './ApiStatus';
import chartDataService from '../../services/ChartDataService';
import stockRepository from '../../services/repositories/StockRepository';

const ChartDemo = () => {
  const [stockData, setStockData] = useState(null);
  const [selectedSymbol, setSelectedSymbol] = useState('SAMPLE');
  const [loading, setLoading] = useState(false);

  // Iranian stock symbols for demo
  const iranianStocks = [
    { symbol: 'SAMPLE', name: 'Sample Data' },
    { symbol: 'FOLD', name: 'فولاد مبارکه' },
    { symbol: 'SHPNA', name: 'پتروشیمی پارس' },
    { symbol: 'SAIPA', name: 'سایپا' },
    { symbol: 'IKCO', name: 'ایران خودرو' },
    { symbol: 'BMLT', name: 'بانک ملت' }
  ];

  const generateRealisticStockData = (symbol) => {
    const data = [];
    let basePrice = 50000;
    
    // Different base prices for different stocks
    switch (symbol) {
      case 'FOLD':
        basePrice = 85000;
        break;
      case 'SHPNA':
        basePrice = 12000;
        break;
      case 'SAIPA':
        basePrice = 8500;
        break;
      case 'IKCO':
        basePrice = 4200;
        break;
      case 'BMLT':
        basePrice = 25000;
        break;
      default:
        basePrice = 50000;
    }

    const startTime = Date.now() - (200 * 24 * 60 * 60 * 1000); // 200 days ago
    let price = basePrice;
    
    for (let i = 0; i < 1000; i++) {
      const timestamp = startTime + (i * 4 * 60 * 60 * 1000); // 4-hour intervals
      
      // Market trend simulation
      const trendFactor = Math.sin(i / 50) * 0.001;
      const volatility = 0.015 + Math.random() * 0.01;
      const change = (Math.random() - 0.5) * volatility * price + (price * trendFactor);
      
      const open = price;
      const close = Math.max(1, price + change);
      
      // Realistic high/low calculation
      const bodySize = Math.abs(close - open);
      const wickMultiplier = 0.5 + Math.random() * 1.5;
      
      const high = Math.max(open, close) + (bodySize * wickMultiplier * Math.random());
      const low = Math.min(open, close) - (bodySize * wickMultiplier * Math.random());
      
      // Volume simulation (higher volume on bigger price moves)
      const priceChangePercent = Math.abs(change / price);
      const baseVolume = 500000 + Math.random() * 2000000;
      const volume = Math.floor(baseVolume * (1 + priceChangePercent * 5));
      
      data.push({
        timestamp,
        date: new Date(timestamp),
        open: Math.round(open),
        high: Math.round(high),
        low: Math.round(Math.max(1, low)),
        close: Math.round(close),
        volume
      });
      
      price = close;
    }
    
    return data;
  };

  const fetchStockData = async (symbol) => {
    setLoading(true);
    try {
      console.log(`🚀 Fetching data for ${symbol}...`);
      
      // Try to get real data from API first
      const chartData = await chartDataService.getChartData(symbol, {
        timeframe: '1H',
        limit: 500,
        includeIndicators: true,
        indicators: [
          { type: 'sma', period: 20 },
          { type: 'ema', period: 50 },
          { type: 'rsi', period: 14 }
        ],
        includePatterns: true,
        includeVolume: true
      });
      
      console.log('✅ Real data loaded from API:', chartData.metadata);
      setStockData(chartData.data);
      
    } catch (error) {
      console.warn('⚠️ API failed, using sample data:', error.message);
      
      // Fallback to sample data
      const data = generateRealisticStockData(symbol);
      setStockData(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStockData(selectedSymbol);
  }, [selectedSymbol]);

  const handleSymbolChange = (symbol) => {
    setSelectedSymbol(symbol);
  };

  const refreshData = () => {
    fetchStockData(selectedSymbol);
  };

  return (
    <div className="chart-demo">
      <ApiStatus />
      <div className="demo-header">
        <h1>📈 Iran Stock Market - TradingView Style Charts</h1>
        
        <div className="demo-controls">
          <div className="stock-selector">
            <label>Select Stock: </label>
            <select 
              value={selectedSymbol} 
              onChange={(e) => handleSymbolChange(e.target.value)}
              disabled={loading}
            >
              {iranianStocks.map(stock => (
                <option key={stock.symbol} value={stock.symbol}>
                  {stock.symbol} - {stock.name}
                </option>
              ))}
            </select>
          </div>
          
          <button 
            onClick={refreshData}
            disabled={loading}
            className="refresh-btn"
          >
            {loading ? '🔄 Loading...' : '🔄 Refresh Data'}
          </button>
        </div>
      </div>

      <div className="demo-features">
        <h3>🚀 Available Features:</h3>
        <div className="features-grid">
          <div className="feature-category">
            <h4>📊 Chart Types</h4>
            <ul>
              <li>Candlestick & Hollow Candles</li>
              <li>Heikin Ashi</li>
              <li>Renko & Kagi</li>
              <li>Line Break & Point & Figure</li>
              <li>Range Bars & Baseline</li>
            </ul>
          </div>
          
          <div className="feature-category">
            <h4>⏱️ Timeframes</h4>
            <ul>
              <li>Seconds to Months</li>
              <li>Tick-based intervals</li>
              <li>Range & Renko based</li>
              <li>Custom timeframes</li>
            </ul>
          </div>
          
          <div className="feature-category">
            <h4>📈 Technical Indicators</h4>
            <ul>
              <li>Moving Averages (SMA, EMA, WMA)</li>
              <li>Bollinger Bands & RSI</li>
              <li>MACD & Stochastic</li>
              <li>80+ indicators available</li>
            </ul>
          </div>
          
          <div className="feature-category">
            <h4>🎯 Volume Analysis</h4>
            <ul>
              <li>Volume Profile & TPO</li>
              <li>Volume Footprint</li>
              <li>VWAP & Delta Analysis</li>
              <li>Market Profile statistics</li>
            </ul>
          </div>
        </div>
      </div>

      {stockData && !loading && (
        <div className="chart-wrapper">
          <SuperChart 
            symbol={selectedSymbol}
            data={stockData}
          />
        </div>
      )}

      {loading && (
        <div className="loading-container">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading chart data for {selectedSymbol}...</p>
          </div>
        </div>
      )}

      <div className="demo-footer">
        <h3>🎨 How to Use:</h3>
        <ol>
          <li><strong>Select Chart Type:</strong> Choose from 9 different chart types in the toolbar</li>
          <li><strong>Change Timeframe:</strong> Use the timeframe selector to switch between intervals</li>
          <li><strong>Add Indicators:</strong> Click "Indicators" button and select technical indicators</li>
          <li><strong>Volume Profile:</strong> Toggle volume profile to see market structure</li>
          <li><strong>Multi-Chart:</strong> All charts sync and work together</li>
        </ol>
        
        <div className="api-info">
          <h4>🔗 Connect to Your Backend:</h4>
          <p>To use real data, modify the <code>fetchStockData</code> function to call your Iran stock API:</p>
          <pre>
{`// Example API integration:
const response = await fetch(\`/api/stocks/\${symbol}/history\`);
const data = await response.json();`}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default ChartDemo;