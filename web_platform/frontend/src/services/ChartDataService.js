/**
 * Chart Data Service - سرویس مدیریت داده‌های نمودار
 * Business Logic Layer for Chart Data Management
 */

import stockRepository from './repositories/StockRepository';
import indicatorRepository from './repositories/IndicatorRepository';
import TechnicalIndicators from '../components/Charts/TechnicalIndicators';

class ChartDataService {
  constructor() {
    this.activeSubscriptions = new Map();
    this.websocket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  /**
   * Get comprehensive chart data for a symbol
   */
  async getChartData(symbol, options = {}) {
    const {
      timeframe = '1D',
      from = null,
      to = null,
      limit = 500,
      includeIndicators = false,
      indicators = [],
      includePatterns = false,
      includeVolume = true
    } = options;

    try {
      console.log(`📊 Loading chart data for ${symbol}...`);
      
      // Get historical data
      const historicalData = await stockRepository.getHistoricalData(symbol, {
        timeframe,
        from,
        to,
        limit
      });

      if (!historicalData || historicalData.length === 0) {
        throw new Error(`No data available for ${symbol}`);
      }

      const chartData = {
        symbol,
        timeframe,
        data: historicalData,
        metadata: {
          dataPoints: historicalData.length,
          firstDate: historicalData[0]?.date,
          lastDate: historicalData[historicalData.length - 1]?.date,
          priceRange: {
            high: Math.max(...historicalData.map(d => d.high)),
            low: Math.min(...historicalData.map(d => d.low))
          },
          volumeRange: {
            max: Math.max(...historicalData.map(d => d.volume)),
            avg: historicalData.reduce((sum, d) => sum + d.volume, 0) / historicalData.length
          }
        }
      };

      // Add technical indicators if requested
      if (includeIndicators && indicators.length > 0) {
        chartData.indicators = await this.calculateIndicators(symbol, indicators, {
          timeframe,
          limit,
          data: historicalData
        });
      }

      // Add pattern recognition if requested
      if (includePatterns) {
        chartData.patterns = await this.detectPatterns(symbol, {
          timeframe,
          limit: Math.min(limit, 100)
        });
      }

      // Add volume analysis if requested
      if (includeVolume) {
        chartData.volumeAnalysis = this.calculateVolumeAnalysis(historicalData);
      }

      console.log(`✅ Chart data loaded for ${symbol}:`, chartData.metadata);
      return chartData;

    } catch (error) {
      console.error(`❌ Failed to load chart data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get real-time data for a symbol
   */
  async getRealTimeData(symbol) {
    try {
      const realTimeData = await stockRepository.getRealTimeData(symbol);
      
      if (!realTimeData) {
        throw new Error(`No real-time data available for ${symbol}`);
      }

      return {
        symbol: realTimeData.symbol,
        price: realTimeData.close,
        change: realTimeData.change,
        changePercent: realTimeData.changePercent,
        volume: realTimeData.volume,
        timestamp: realTimeData.timestamp,
        lastUpdate: new Date(realTimeData.timestamp),
        marketStatus: this.determineMarketStatus(realTimeData.timestamp)
      };

    } catch (error) {
      console.error(`❌ Failed to get real-time data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Calculate technical indicators for chart data
   */
  async calculateIndicators(symbol, indicatorConfigs, options = {}) {
    const { timeframe, limit, data } = options;
    const indicators = {};

    try {
      // Try to get from API first
      if (indicatorConfigs.length > 1) {
        const batchResult = await indicatorRepository.getBatchIndicators(symbol, {
          timeframe,
          indicators: indicatorConfigs,
          limit
        });
        
        return this.processBatchIndicators(batchResult, indicatorConfigs);
      }

      // Calculate individual indicators
      for (const config of indicatorConfigs) {
        const key = `${config.type}_${config.period || 'default'}`;
        
        try {
          // Try API first
          const apiResult = await indicatorRepository.getSingleIndicator(symbol, {
            indicator: config.type,
            period: config.period,
            timeframe,
            limit
          });
          
          indicators[key] = apiResult;
        } catch (error) {
          // Fallback to client-side calculation if API fails
          console.warn(`⚠️ API calculation failed for ${config.type}, using client-side calculation`);
          
          if (data && data.length > 0) {
            indicators[key] = this.calculateIndicatorClientSide(config, data);
          }
        }
      }

      return indicators;

    } catch (error) {
      console.error(`❌ Failed to calculate indicators for ${symbol}:`, error);
      
      // Fallback to client-side calculation
      if (data && data.length > 0) {
        return this.calculateIndicatorsClientSide(indicatorConfigs, data);
      }
      
      throw error;
    }
  }

  /**
   * Client-side indicator calculation fallback
   */
  calculateIndicatorClientSide(config, data) {
    const { type, period = 20 } = config;
    
    switch (type) {
      case 'sma':
        return TechnicalIndicators.SMA(data, period).map((value, index) => ({
          timestamp: data[index]?.timestamp,
          date: data[index]?.date,
          value
        }));
        
      case 'ema':
        return TechnicalIndicators.EMA(data, period).map((value, index) => ({
          timestamp: data[index]?.timestamp,
          date: data[index]?.date,
          value
        }));
        
      case 'rsi':
        return TechnicalIndicators.RSI(data, period).map((value, index) => ({
          timestamp: data[index]?.timestamp,
          date: data[index]?.date,
          value
        }));
        
      case 'bollinger':
        const bb = TechnicalIndicators.BollingerBands(data, period);
        return bb.map((bands, index) => ({
          timestamp: data[index]?.timestamp,
          date: data[index]?.date,
          upper: bands.upper,
          middle: bands.middle,
          lower: bands.lower
        }));
        
      case 'macd':
        const macd = TechnicalIndicators.MACD(data);
        return macd.map((macdData, index) => ({
          timestamp: data[index]?.timestamp,
          date: data[index]?.date,
          macd: macdData.macd,
          signal: macdData.signal,
          histogram: macdData.histogram
        }));
        
      case 'vwap':
        return TechnicalIndicators.VWAP(data).map((value, index) => ({
          timestamp: data[index]?.timestamp,
          date: data[index]?.date,
          value
        }));
        
      default:
        console.warn(`⚠️ Unsupported indicator type: ${type}`);
        return [];
    }
  }

  /**
   * Calculate multiple indicators client-side
   */
  calculateIndicatorsClientSide(indicatorConfigs, data) {
    const indicators = {};
    
    indicatorConfigs.forEach(config => {
      const key = `${config.type}_${config.period || 'default'}`;
      indicators[key] = this.calculateIndicatorClientSide(config, data);
    });
    
    return indicators;
  }

  /**
   * Detect candlestick patterns
   */
  async detectPatterns(symbol, options = {}) {
    try {
      const patterns = await indicatorRepository.getPatterns(symbol, options);
      
      return patterns.map(pattern => ({
        ...pattern,
        color: this.getPatternColor(pattern.pattern),
        icon: this.getPatternIcon(pattern.pattern)
      }));
      
    } catch (error) {
      console.warn(`⚠️ Pattern detection failed for ${symbol}, using client-side detection`);
      
      // Fallback to client-side pattern detection
      return this.detectPatternsClientSide(options.data || []);
    }
  }

  /**
   * Client-side pattern detection
   */
  detectPatternsClientSide(data) {
    if (!data || data.length < 3) return [];
    
    return TechnicalIndicators.CandlePatterns.detectPatterns(data).map(pattern => ({
      timestamp: data[pattern.index]?.timestamp,
      date: data[pattern.index]?.date,
      pattern: pattern.type,
      strength: pattern.strength,
      confidence: 0.8, // Default confidence for client-side detection
      color: this.getPatternColor(pattern.type),
      icon: this.getPatternIcon(pattern.type)
    }));
  }

  /**
   * Calculate volume analysis
   */
  calculateVolumeAnalysis(data) {
    if (!data || data.length === 0) return null;

    const volumes = data.map(d => d.volume);
    const prices = data.map(d => d.close);
    
    return {
      avgVolume: volumes.reduce((a, b) => a + b, 0) / volumes.length,
      maxVolume: Math.max(...volumes),
      minVolume: Math.min(...volumes),
      vwap: this.calculateVWAP(data),
      volumeTrend: this.calculateVolumeTrend(volumes),
      priceVolumeDivergence: this.calculatePriceVolumeDivergence(prices, volumes),
      volumeProfile: this.calculateSimpleVolumeProfile(data)
    };
  }

  /**
   * Calculate VWAP
   */
  calculateVWAP(data) {
    let sumPriceVolume = 0;
    let sumVolume = 0;
    
    data.forEach(candle => {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      sumPriceVolume += typicalPrice * candle.volume;
      sumVolume += candle.volume;
    });
    
    return sumVolume > 0 ? sumPriceVolume / sumVolume : 0;
  }

  /**
   * Calculate volume trend
   */
  calculateVolumeTrend(volumes) {
    if (volumes.length < 20) return 'neutral';
    
    const recent = volumes.slice(-10);
    const previous = volumes.slice(-20, -10);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const previousAvg = previous.reduce((a, b) => a + b, 0) / previous.length;
    
    const change = (recentAvg - previousAvg) / previousAvg;
    
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'neutral';
  }

  /**
   * Calculate price-volume divergence
   */
  calculatePriceVolumeDivergence(prices, volumes) {
    if (prices.length < 20 || volumes.length < 20) return 'none';
    
    const priceChange = prices[prices.length - 1] - prices[prices.length - 10];
    const volumeChange = volumes.slice(-10).reduce((a, b) => a + b) - 
                        volumes.slice(-20, -10).reduce((a, b) => a + b);
    
    if (priceChange > 0 && volumeChange < 0) return 'bearish';
    if (priceChange < 0 && volumeChange > 0) return 'bullish';
    return 'none';
  }

  /**
   * Calculate simple volume profile
   */
  calculateSimpleVolumeProfile(data) {
    const priceRange = Math.max(...data.map(d => d.high)) - Math.min(...data.map(d => d.low));
    const bucketSize = priceRange / 20;
    const buckets = new Array(20).fill(0);
    
    data.forEach(candle => {
      const avgPrice = (candle.high + candle.low + candle.close) / 3;
      const bucketIndex = Math.min(19, Math.floor(avgPrice / bucketSize));
      buckets[bucketIndex] += candle.volume;
    });
    
    return buckets.map((volume, index) => ({
      price: index * bucketSize,
      volume
    }));
  }

  /**
   * WebSocket management for real-time updates
   */
  subscribeToRealTimeUpdates(symbol, callback) {
    const subscriptionKey = `realtime_${symbol}`;
    
    if (this.activeSubscriptions.has(subscriptionKey)) {
      console.log(`📡 Already subscribed to ${symbol}`);
      return;
    }

    this.activeSubscriptions.set(subscriptionKey, {
      symbol,
      callback,
      createdAt: Date.now()
    });

    this.connectWebSocket();
    this.sendWebSocketMessage({
      action: 'subscribe',
      symbol,
      types: ['price', 'volume', 'trades']
    });

    console.log(`📡 Subscribed to real-time updates for ${symbol}`);
  }

  unsubscribeFromRealTimeUpdates(symbol) {
    const subscriptionKey = `realtime_${symbol}`;
    
    if (this.activeSubscriptions.has(subscriptionKey)) {
      this.activeSubscriptions.delete(subscriptionKey);
      
      this.sendWebSocketMessage({
        action: 'unsubscribe',
        symbol
      });

      console.log(`📡 Unsubscribed from real-time updates for ${symbol}`);
    }
  }

  /**
   * WebSocket connection management
   */
  connectWebSocket() {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws';
    
    try {
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.onopen = () => {
        console.log('🔌 WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.websocket.onmessage = (event) => {
        this.handleWebSocketMessage(event);
      };

      this.websocket.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        this.scheduleReconnect();
      };

      this.websocket.onerror = (error) => {
        console.error('🔌 WebSocket error:', error);
      };

    } catch (error) {
      console.error('🔌 Failed to connect WebSocket:', error);
    }
  }

  handleWebSocketMessage(event) {
    try {
      const data = JSON.parse(event.data);
      const subscriptionKey = `realtime_${data.symbol}`;
      
      if (this.activeSubscriptions.has(subscriptionKey)) {
        const subscription = this.activeSubscriptions.get(subscriptionKey);
        subscription.callback(data);
      }
    } catch (error) {
      console.error('🔌 Failed to parse WebSocket message:', error);
    }
  }

  sendWebSocketMessage(message) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
    }
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.pow(2, this.reconnectAttempts) * 1000;
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connectWebSocket();
      }, delay);
    }
  }

  /**
   * Utility methods
   */
  determineMarketStatus(timestamp) {
    const date = new Date(timestamp);
    const hour = date.getHours();
    const minute = date.getMinutes();
    const timeValue = hour * 100 + minute;

    if (timeValue >= 830 && timeValue < 900) return 'pre_open';
    if (timeValue >= 900 && timeValue <= 1230) return 'open';
    return 'closed';
  }

  getPatternColor(pattern) {
    const bullishPatterns = ['bullish_engulfing', 'hammer', 'morning_star', 'piercing_pattern'];
    const bearishPatterns = ['bearish_engulfing', 'shooting_star', 'evening_star', 'dark_cloud_cover'];
    
    if (bullishPatterns.includes(pattern)) return '#4caf50';
    if (bearishPatterns.includes(pattern)) return '#f44336';
    return '#ff9800';
  }

  getPatternIcon(pattern) {
    const icons = {
      'bullish_engulfing': '📈',
      'bearish_engulfing': '📉',
      'hammer': '🔨',
      'shooting_star': '⭐',
      'doji': '➕',
      'morning_star': '🌅',
      'evening_star': '🌆'
    };
    
    return icons[pattern] || '📊';
  }

  /**
   * Process batch indicators from API
   */
  processBatchIndicators(batchResult, configs) {
    const indicators = {};
    
    configs.forEach(config => {
      const key = `${config.type}_${config.period || 'default'}`;
      indicators[key] = batchResult.filter(item => item[key] !== undefined)
        .map(item => ({
          timestamp: item.timestamp,
          date: item.date,
          value: item[key]
        }));
    });
    
    return indicators;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    // Close WebSocket
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }

    // Clear subscriptions
    this.activeSubscriptions.clear();

    console.log('🧹 Chart Data Service destroyed');
  }
}

// Singleton instance
const chartDataService = new ChartDataService();

export { ChartDataService, chartDataService };
export default chartDataService;