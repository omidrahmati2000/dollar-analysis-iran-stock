import React, { useState, useEffect, useRef } from 'react';
import { ChartTypes } from './ChartTypes';
import { VolumeProfile } from './VolumeProfile';
import { TimeframeSelector } from './TimeframeSelector';
import TechnicalIndicators from './TechnicalIndicators';
import './SuperChart.css';

const SuperChart = ({ symbol, data: rawData }) => {
  const [chartType, setChartType] = useState('candlestick');
  const [timeframe, setTimeframe] = useState({ type: 'minute', count: 15 });
  const [indicators, setIndicators] = useState([]);
  const [volumeProfileType, setVolumeProfileType] = useState('volume');
  const [showVolumeProfile, setShowVolumeProfile] = useState(false);
  const [showIndicators, setShowIndicators] = useState(false);
  const [processedData, setProcessedData] = useState([]);
  const [indicatorData, setIndicatorData] = useState({});
  const chartRef = useRef(null);

  // Sample data generator for testing
  const generateSampleData = () => {
    const data = [];
    let price = 50000;
    const startTime = Date.now() - (365 * 24 * 60 * 60 * 1000);
    
    for (let i = 0; i < 500; i++) {
      const timestamp = startTime + (i * 60 * 60 * 1000);
      const volatility = 0.02;
      const change = (Math.random() - 0.5) * volatility * price;
      
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * volatility * price * 0.5;
      const low = Math.min(open, close) - Math.random() * volatility * price * 0.5;
      const volume = Math.floor(Math.random() * 1000000) + 100000;
      
      data.push({
        timestamp,
        date: new Date(timestamp),
        open: Math.round(open),
        high: Math.round(high),
        low: Math.round(low),
        close: Math.round(close),
        volume
      });
      
      price = close;
    }
    return data;
  };

  useEffect(() => {
    const data = rawData && rawData.length > 0 ? rawData : generateSampleData();
    setProcessedData(data);
    
    // Calculate indicators
    const newIndicatorData = {};
    indicators.forEach(indicator => {
      switch (indicator.type) {
        case 'sma':
          newIndicatorData[`${indicator.type}_${indicator.period}`] = 
            TechnicalIndicators.SMA(data, indicator.period);
          break;
        case 'ema':
          newIndicatorData[`${indicator.type}_${indicator.period}`] = 
            TechnicalIndicators.EMA(data, indicator.period);
          break;
        case 'bb':
          newIndicatorData[`${indicator.type}_${indicator.period}`] = 
            TechnicalIndicators.BollingerBands(data, indicator.period);
          break;
        case 'rsi':
          newIndicatorData[`${indicator.type}_${indicator.period}`] = 
            TechnicalIndicators.RSI(data, indicator.period);
          break;
        case 'macd':
          newIndicatorData[`${indicator.type}`] = 
            TechnicalIndicators.MACD(data);
          break;
        case 'vwap':
          newIndicatorData[`${indicator.type}`] = 
            TechnicalIndicators.VWAP(data);
          break;
        default:
          break;
      }
    });
    setIndicatorData(newIndicatorData);
  }, [rawData, indicators, timeframe]);

  const addIndicator = (type, period = 20) => {
    const newIndicator = { type, period, id: Date.now() };
    setIndicators(prev => [...prev, newIndicator]);
  };

  const removeIndicator = (id) => {
    setIndicators(prev => prev.filter(ind => ind.id !== id));
  };

  const CHART_TYPES = [
    { value: 'candlestick', label: 'Candlestick' },
    { value: 'heikinashi', label: 'Heikin Ashi' },
    { value: 'renko', label: 'Renko' },
    { value: 'kagi', label: 'Kagi' },
    { value: 'linebreak', label: 'Line Break' },
    { value: 'pointfigure', label: 'Point & Figure' },
    { value: 'rangebar', label: 'Range Bar' },
    { value: 'hollow', label: 'Hollow Candles' },
    { value: 'baseline', label: 'Baseline' }
  ];

  const INDICATORS = [
    { type: 'sma', label: 'SMA', hasSettings: true },
    { type: 'ema', label: 'EMA', hasSettings: true },
    { type: 'bb', label: 'Bollinger Bands', hasSettings: true },
    { type: 'rsi', label: 'RSI', hasSettings: true },
    { type: 'macd', label: 'MACD', hasSettings: false },
    { type: 'vwap', label: 'VWAP', hasSettings: false }
  ];

  return (
    <div className="super-chart">
      {/* Toolbar */}
      <div className="chart-toolbar">
        <div className="toolbar-section">
          <label>Symbol: </label>
          <span className="symbol">{symbol || 'SAMPLE'}</span>
        </div>
        
        <div className="toolbar-section">
          <label>Chart Type: </label>
          <select 
            value={chartType} 
            onChange={(e) => setChartType(e.target.value)}
            className="chart-selector"
          >
            {CHART_TYPES.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="toolbar-section">
          <TimeframeSelector 
            onTimeframeChange={setTimeframe}
            currentTimeframe={timeframe}
          />
        </div>

        <div className="toolbar-section">
          <button 
            className={`toolbar-btn ${showVolumeProfile ? 'active' : ''}`}
            onClick={() => setShowVolumeProfile(!showVolumeProfile)}
          >
            Volume Profile
          </button>
          
          <button 
            className={`toolbar-btn ${showIndicators ? 'active' : ''}`}
            onClick={() => setShowIndicators(!showIndicators)}
          >
            Indicators
          </button>
        </div>

        {showVolumeProfile && (
          <div className="toolbar-section">
            <select 
              value={volumeProfileType} 
              onChange={(e) => setVolumeProfileType(e.target.value)}
            >
              <option value="volume">Volume Profile</option>
              <option value="tpo">TPO Profile</option>
              <option value="footprint">Footprint</option>
              <option value="session">Session Profile</option>
            </select>
          </div>
        )}
      </div>

      {/* Indicators Panel */}
      {showIndicators && (
        <div className="indicators-panel">
          <div className="indicators-toolbar">
            <label>Add Indicator: </label>
            {INDICATORS.map(ind => (
              <button 
                key={ind.type}
                onClick={() => addIndicator(ind.type)}
                className="indicator-btn"
              >
                {ind.label}
              </button>
            ))}
          </div>
          
          {indicators.length > 0 && (
            <div className="active-indicators">
              <label>Active Indicators: </label>
              {indicators.map(ind => (
                <div key={ind.id} className="indicator-tag">
                  <span>{ind.type.toUpperCase()}</span>
                  {ind.period && <span>({ind.period})</span>}
                  <button 
                    onClick={() => removeIndicator(ind.id)}
                    className="remove-btn"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Chart Area */}
      <div className="chart-container">
        <div className="main-chart" ref={chartRef}>
          {processedData.length > 0 && (
            <ChartTypes
              data={processedData}
              type={chartType}
              options={{
                width: 1200,
                height: 600,
                indicators: indicatorData
              }}
            />
          )}
        </div>

        {/* Volume Profile Sidebar */}
        {showVolumeProfile && processedData.length > 0 && (
          <div className="volume-profile-sidebar">
            <VolumeProfile
              data={processedData}
              type={volumeProfileType}
              options={{
                width: 300,
                height: 600
              }}
            />
          </div>
        )}
      </div>

      {/* Chart Info Panel */}
      <div className="chart-info">
        <div className="info-section">
          <h4>Market Data</h4>
          {processedData.length > 0 && (
            <div className="market-stats">
              <div className="stat">
                <label>Last Price:</label>
                <span className="price">
                  {processedData[processedData.length - 1]?.close?.toLocaleString()}
                </span>
              </div>
              <div className="stat">
                <label>Volume:</label>
                <span>{(processedData[processedData.length - 1]?.volume / 1000000).toFixed(2)}M</span>
              </div>
              <div className="stat">
                <label>High:</label>
                <span>{Math.max(...processedData.map(d => d.high)).toLocaleString()}</span>
              </div>
              <div className="stat">
                <label>Low:</label>
                <span>{Math.min(...processedData.map(d => d.low)).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>

        {Object.keys(indicatorData).length > 0 && (
          <div className="info-section">
            <h4>Indicator Values</h4>
            <div className="indicator-values">
              {Object.entries(indicatorData).map(([key, values]) => {
                const lastValue = values[values.length - 1];
                return (
                  <div key={key} className="indicator-value">
                    <label>{key.toUpperCase()}:</label>
                    <span>
                      {typeof lastValue === 'object' && lastValue !== null
                        ? JSON.stringify(lastValue).substring(0, 50) + '...'
                        : lastValue?.toFixed?.(2) || 'N/A'
                      }
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperChart;