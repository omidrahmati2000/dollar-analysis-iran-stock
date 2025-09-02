import React, { useState, useCallback } from 'react';
import './TimeframeSelector.css';

const PRESET_TIMEFRAMES = {
  tick: [
    { label: '1T', value: { type: 'tick', count: 1 } },
    { label: '10T', value: { type: 'tick', count: 10 } },
    { label: '100T', value: { type: 'tick', count: 100 } },
    { label: '500T', value: { type: 'tick', count: 500 } }
  ],
  seconds: [
    { label: '1s', value: { type: 'second', count: 1 } },
    { label: '5s', value: { type: 'second', count: 5 } },
    { label: '10s', value: { type: 'second', count: 10 } },
    { label: '30s', value: { type: 'second', count: 30 } }
  ],
  minutes: [
    { label: '1m', value: { type: 'minute', count: 1 } },
    { label: '3m', value: { type: 'minute', count: 3 } },
    { label: '5m', value: { type: 'minute', count: 5 } },
    { label: '15m', value: { type: 'minute', count: 15 } },
    { label: '30m', value: { type: 'minute', count: 30 } },
    { label: '45m', value: { type: 'minute', count: 45 } }
  ],
  hours: [
    { label: '1H', value: { type: 'hour', count: 1 } },
    { label: '2H', value: { type: 'hour', count: 2 } },
    { label: '3H', value: { type: 'hour', count: 3 } },
    { label: '4H', value: { type: 'hour', count: 4 } },
    { label: '6H', value: { type: 'hour', count: 6 } },
    { label: '8H', value: { type: 'hour', count: 8 } },
    { label: '12H', value: { type: 'hour', count: 12 } }
  ],
  days: [
    { label: '1D', value: { type: 'day', count: 1 } },
    { label: '2D', value: { type: 'day', count: 2 } },
    { label: '3D', value: { type: 'day', count: 3 } },
    { label: '5D', value: { type: 'day', count: 5 } }
  ],
  weeks: [
    { label: '1W', value: { type: 'week', count: 1 } },
    { label: '2W', value: { type: 'week', count: 2 } },
    { label: '3W', value: { type: 'week', count: 3 } }
  ],
  months: [
    { label: '1M', value: { type: 'month', count: 1 } },
    { label: '3M', value: { type: 'month', count: 3 } },
    { label: '6M', value: { type: 'month', count: 6 } }
  ],
  range: [
    { label: 'R10', value: { type: 'range', count: 10 } },
    { label: 'R25', value: { type: 'range', count: 25 } },
    { label: 'R50', value: { type: 'range', count: 50 } },
    { label: 'R100', value: { type: 'range', count: 100 } }
  ],
  renko: [
    { label: 'RK1', value: { type: 'renko', count: 1 } },
    { label: 'RK2', value: { type: 'renko', count: 2 } },
    { label: 'RK3', value: { type: 'renko', count: 3 } },
    { label: 'RK5', value: { type: 'renko', count: 5 } }
  ]
};

class TimeframeManager {
  constructor() {
    this.customTimeframes = this.loadCustomTimeframes();
    this.recentTimeframes = this.loadRecentTimeframes();
  }

  loadCustomTimeframes() {
    const saved = localStorage.getItem('customTimeframes');
    return saved ? JSON.parse(saved) : [];
  }

  saveCustomTimeframes(timeframes) {
    localStorage.setItem('customTimeframes', JSON.stringify(timeframes));
  }

  loadRecentTimeframes() {
    const saved = localStorage.getItem('recentTimeframes');
    return saved ? JSON.parse(saved) : [];
  }

  saveRecentTimeframe(timeframe) {
    let recent = this.recentTimeframes.filter(tf => 
      JSON.stringify(tf.value) !== JSON.stringify(timeframe.value)
    );
    recent.unshift(timeframe);
    recent = recent.slice(0, 5);
    this.recentTimeframes = recent;
    localStorage.setItem('recentTimeframes', JSON.stringify(recent));
  }

  addCustomTimeframe(label, type, count, params = {}) {
    const timeframe = {
      label,
      value: { type, count, ...params },
      custom: true
    };
    this.customTimeframes.push(timeframe);
    this.saveCustomTimeframes(this.customTimeframes);
    return timeframe;
  }

  removeCustomTimeframe(index) {
    this.customTimeframes.splice(index, 1);
    this.saveCustomTimeframes(this.customTimeframes);
  }

  convertToMilliseconds(timeframe) {
    const { type, count } = timeframe;
    const multipliers = {
      second: 1000,
      minute: 60000,
      hour: 3600000,
      day: 86400000,
      week: 604800000,
      month: 2592000000
    };
    return multipliers[type] ? multipliers[type] * count : null;
  }

  aggregateData(data, sourceTimeframe, targetTimeframe) {
    if (targetTimeframe.type === 'tick') {
      return this.aggregateByTicks(data, targetTimeframe.count);
    }
    
    if (targetTimeframe.type === 'range') {
      return this.aggregateByRange(data, targetTimeframe.count);
    }
    
    if (targetTimeframe.type === 'renko') {
      return this.aggregateByRenko(data, targetTimeframe.count);
    }
    
    const targetMs = this.convertToMilliseconds(targetTimeframe);
    if (!targetMs) return data;
    
    const aggregated = [];
    let currentBar = null;
    
    data.forEach(candle => {
      const barTime = Math.floor(candle.timestamp / targetMs) * targetMs;
      
      if (!currentBar || currentBar.timestamp !== barTime) {
        if (currentBar) aggregated.push(currentBar);
        currentBar = {
          timestamp: barTime,
          date: new Date(barTime),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume
        };
      } else {
        currentBar.high = Math.max(currentBar.high, candle.high);
        currentBar.low = Math.min(currentBar.low, candle.low);
        currentBar.close = candle.close;
        currentBar.volume += candle.volume;
      }
    });
    
    if (currentBar) aggregated.push(currentBar);
    return aggregated;
  }

  aggregateByTicks(data, tickCount) {
    const aggregated = [];
    let currentBar = null;
    let tickCounter = 0;
    
    data.forEach(tick => {
      if (!currentBar) {
        currentBar = {
          timestamp: tick.timestamp,
          date: tick.date,
          open: tick.open,
          high: tick.high,
          low: tick.low,
          close: tick.close,
          volume: tick.volume
        };
        tickCounter = 1;
      } else {
        currentBar.high = Math.max(currentBar.high, tick.high);
        currentBar.low = Math.min(currentBar.low, tick.low);
        currentBar.close = tick.close;
        currentBar.volume += tick.volume;
        tickCounter++;
        
        if (tickCounter >= tickCount) {
          aggregated.push(currentBar);
          currentBar = null;
          tickCounter = 0;
        }
      }
    });
    
    if (currentBar) aggregated.push(currentBar);
    return aggregated;
  }

  aggregateByRange(data, rangeSize) {
    const aggregated = [];
    let currentBar = null;
    
    data.forEach(tick => {
      if (!currentBar) {
        currentBar = {
          timestamp: tick.timestamp,
          date: tick.date,
          open: tick.open,
          high: tick.high,
          low: tick.low,
          close: tick.close,
          volume: tick.volume
        };
      } else {
        currentBar.high = Math.max(currentBar.high, tick.high);
        currentBar.low = Math.min(currentBar.low, tick.low);
        currentBar.close = tick.close;
        currentBar.volume += tick.volume;
        
        if (currentBar.high - currentBar.low >= rangeSize) {
          aggregated.push(currentBar);
          currentBar = null;
        }
      }
    });
    
    if (currentBar) aggregated.push(currentBar);
    return aggregated;
  }

  aggregateByRenko(data, boxSize) {
    const aggregated = [];
    let currentPrice = data[0].close;
    
    data.forEach(tick => {
      const priceDiff = tick.close - currentPrice;
      const boxCount = Math.floor(Math.abs(priceDiff) / boxSize);
      
      for (let i = 0; i < boxCount; i++) {
        const box = {
          timestamp: tick.timestamp,
          date: tick.date,
          open: currentPrice,
          close: currentPrice + (priceDiff > 0 ? boxSize : -boxSize),
          high: Math.max(currentPrice, currentPrice + (priceDiff > 0 ? boxSize : -boxSize)),
          low: Math.min(currentPrice, currentPrice + (priceDiff > 0 ? boxSize : -boxSize)),
          volume: tick.volume / boxCount
        };
        aggregated.push(box);
        currentPrice = box.close;
      }
    });
    
    return aggregated;
  }

  getSessionBreaks(timeframe, timezone = 'Asia/Tehran') {
    const sessions = {
      tehran: {
        open: { hour: 9, minute: 0 },
        close: { hour: 12, minute: 30 }
      },
      asian: {
        open: { hour: 1, minute: 0 },
        close: { hour: 9, minute: 0 }
      },
      european: {
        open: { hour: 8, minute: 0 },
        close: { hour: 16, minute: 30 }
      },
      american: {
        open: { hour: 13, minute: 30 },
        close: { hour: 20, minute: 0 }
      }
    };
    
    return sessions;
  }
}

export const TimeframeSelector = ({ onTimeframeChange, currentTimeframe }) => {
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [customType, setCustomType] = useState('minute');
  const [customCount, setCustomCount] = useState(1);
  const [customLabel, setCustomLabel] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('minutes');
  
  const timeframeManager = React.useMemo(() => new TimeframeManager(), []);

  const handleTimeframeSelect = useCallback((timeframe) => {
    timeframeManager.saveRecentTimeframe(timeframe);
    onTimeframeChange(timeframe);
  }, [onTimeframeChange, timeframeManager]);

  const handleCreateCustom = useCallback(() => {
    const label = customLabel || `${customCount}${customType[0].toUpperCase()}`;
    const timeframe = timeframeManager.addCustomTimeframe(label, customType, customCount);
    handleTimeframeSelect(timeframe);
    setShowCustomDialog(false);
    setCustomLabel('');
    setCustomCount(1);
  }, [customLabel, customType, customCount, timeframeManager, handleTimeframeSelect]);

  return (
    <div className="timeframe-selector">
      <div className="timeframe-categories">
        {Object.keys(PRESET_TIMEFRAMES).map(category => (
          <button
            key={category}
            className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
            onClick={() => setSelectedCategory(category)}
          >
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </button>
        ))}
      </div>
      
      <div className="timeframe-buttons">
        {timeframeManager.recentTimeframes.length > 0 && (
          <div className="recent-section">
            <span className="section-label">Recent:</span>
            {timeframeManager.recentTimeframes.map((tf, idx) => (
              <button
                key={idx}
                className={`timeframe-btn ${
                  JSON.stringify(currentTimeframe) === JSON.stringify(tf.value) ? 'active' : ''
                }`}
                onClick={() => handleTimeframeSelect(tf)}
              >
                {tf.label}
              </button>
            ))}
          </div>
        )}
        
        <div className="preset-section">
          {PRESET_TIMEFRAMES[selectedCategory].map((tf, idx) => (
            <button
              key={idx}
              className={`timeframe-btn ${
                JSON.stringify(currentTimeframe) === JSON.stringify(tf.value) ? 'active' : ''
              }`}
              onClick={() => handleTimeframeSelect(tf)}
            >
              {tf.label}
            </button>
          ))}
        </div>
        
        {timeframeManager.customTimeframes.length > 0 && (
          <div className="custom-section">
            <span className="section-label">Custom:</span>
            {timeframeManager.customTimeframes.map((tf, idx) => (
              <button
                key={idx}
                className={`timeframe-btn custom ${
                  JSON.stringify(currentTimeframe) === JSON.stringify(tf.value) ? 'active' : ''
                }`}
                onClick={() => handleTimeframeSelect(tf)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (window.confirm(`Delete custom timeframe "${tf.label}"?`)) {
                    timeframeManager.removeCustomTimeframe(idx);
                  }
                }}
              >
                {tf.label}
              </button>
            ))}
          </div>
        )}
        
        <button 
          className="add-custom-btn"
          onClick={() => setShowCustomDialog(true)}
        >
          + Custom
        </button>
      </div>
      
      {showCustomDialog && (
        <div className="custom-dialog-overlay">
          <div className="custom-dialog">
            <h3>Create Custom Timeframe</h3>
            <div className="form-group">
              <label>Type:</label>
              <select value={customType} onChange={(e) => setCustomType(e.target.value)}>
                <option value="second">Seconds</option>
                <option value="minute">Minutes</option>
                <option value="hour">Hours</option>
                <option value="day">Days</option>
                <option value="week">Weeks</option>
                <option value="month">Months</option>
                <option value="tick">Ticks</option>
                <option value="range">Range</option>
                <option value="renko">Renko</option>
              </select>
            </div>
            <div className="form-group">
              <label>Count:</label>
              <input
                type="number"
                value={customCount}
                onChange={(e) => setCustomCount(parseInt(e.target.value) || 1)}
                min="1"
              />
            </div>
            <div className="form-group">
              <label>Label (optional):</label>
              <input
                type="text"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="e.g., 90m"
              />
            </div>
            <div className="dialog-buttons">
              <button onClick={handleCreateCustom}>Create</button>
              <button onClick={() => setShowCustomDialog(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeframeManager;