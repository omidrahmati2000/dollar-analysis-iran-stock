/**
 * Indicator Repository - مدیریت اندیکاتورهای تکنیکال
 * Repository Pattern Implementation for Technical Indicators
 */

import apiService from '../api/base';
import { CacheManager } from '../cache/CacheManager';

class IndicatorRepository {
  constructor() {
    this.cache = new CacheManager('indicators');
    this.endpoints = {
      single: (symbol) => `/api/indicators/${symbol}`,
      batch: '/api/indicators/batch',
      patterns: (symbol) => `/api/patterns/${symbol}`,
      custom: '/api/indicators/custom'
    };
  }

  /**
   * Get single technical indicator
   */
  async getSingleIndicator(symbol, indicatorConfig) {
    const {
      indicator,
      period = 20,
      timeframe = '1D',
      limit = 100
    } = indicatorConfig;

    const params = {
      indicator,
      period,
      timeframe,
      limit
    };

    const cacheKey = `single_${symbol}_${JSON.stringify(params)}`;
    
    try {
      // Cache based on timeframe
      const cacheTime = this.getCacheTime(timeframe);
      const cached = this.cache.get(cacheKey, cacheTime);
      
      if (cached) {
        console.log(`📦 Cache hit for ${symbol} ${indicator}(${period})`);
        return cached;
      }

      const data = await apiService.get(this.endpoints.single(symbol), params);
      this.cache.set(cacheKey, data);
      
      return this.transformIndicatorData(data);
    } catch (error) {
      console.error(`❌ Failed to get ${indicator} for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get multiple indicators in batch
   */
  async getBatchIndicators(symbol, indicatorsConfig) {
    const {
      timeframe = '1D',
      indicators = [],
      limit = 100
    } = indicatorsConfig;

    const payload = {
      symbol,
      timeframe,
      indicators,
      limit
    };

    const cacheKey = `batch_${symbol}_${JSON.stringify(payload)}`;
    
    try {
      const cacheTime = this.getCacheTime(timeframe);
      const cached = this.cache.get(cacheKey, cacheTime);
      
      if (cached) {
        console.log(`📦 Cache hit for ${symbol} batch indicators`);
        return cached;
      }

      const data = await apiService.post(this.endpoints.batch, payload);
      this.cache.set(cacheKey, data);
      
      return this.transformBatchIndicatorData(data);
    } catch (error) {
      console.error(`❌ Failed to get batch indicators for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get candlestick patterns
   */
  async getPatterns(symbol, options = {}) {
    const {
      timeframe = '1D',
      limit = 50
    } = options;

    const params = {
      timeframe,
      limit
    };

    const cacheKey = `patterns_${symbol}_${JSON.stringify(params)}`;
    
    try {
      const cacheTime = this.getCacheTime(timeframe);
      const cached = this.cache.get(cacheKey, cacheTime);
      
      if (cached) return cached;

      const data = await apiService.get(this.endpoints.patterns(symbol), params);
      this.cache.set(cacheKey, data);
      
      return this.transformPatternData(data);
    } catch (error) {
      console.error(`❌ Failed to get patterns for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Calculate custom indicator
   */
  async calculateCustomIndicator(symbol, formula, options = {}) {
    const {
      timeframe = '1D',
      period = 20,
      parameters = {},
      limit = 100
    } = options;

    const payload = {
      symbol,
      formula,
      timeframe,
      period,
      parameters,
      limit
    };

    const cacheKey = `custom_${symbol}_${JSON.stringify(payload)}`;
    
    try {
      const cacheTime = this.getCacheTime(timeframe);
      const cached = this.cache.get(cacheKey, cacheTime);
      
      if (cached) return cached;

      const data = await apiService.post(this.endpoints.custom, payload);
      this.cache.set(cacheKey, data);
      
      return this.transformIndicatorData(data);
    } catch (error) {
      console.error(`❌ Failed to calculate custom indicator for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get popular indicator presets
   */
  getIndicatorPresets() {
    return {
      trend: [
        { type: 'sma', period: 20, label: 'SMA 20' },
        { type: 'sma', period: 50, label: 'SMA 50' },
        { type: 'ema', period: 12, label: 'EMA 12' },
        { type: 'ema', period: 26, label: 'EMA 26' },
        { type: 'bollinger', period: 20, std: 2, label: 'Bollinger Bands' },
        { type: 'ichimoku', label: 'Ichimoku Cloud' }
      ],
      momentum: [
        { type: 'rsi', period: 14, label: 'RSI' },
        { type: 'macd', fast: 12, slow: 26, signal: 9, label: 'MACD' },
        { type: 'stochastic', period: 14, label: 'Stochastic' },
        { type: 'williams_r', period: 14, label: 'Williams %R' },
        { type: 'cci', period: 20, label: 'CCI' }
      ],
      volume: [
        { type: 'obv', label: 'OBV' },
        { type: 'mfi', period: 14, label: 'Money Flow Index' },
        { type: 'vwap', label: 'VWAP' },
        { type: 'ad_line', label: 'A/D Line' },
        { type: 'chaikin_mf', period: 20, label: 'Chaikin Money Flow' }
      ],
      volatility: [
        { type: 'atr', period: 14, label: 'ATR' },
        { type: 'keltner', period: 20, multiplier: 2, label: 'Keltner Channels' },
        { type: 'donchian', period: 20, label: 'Donchian Channels' },
        { type: 'standard_deviation', period: 20, label: 'Standard Deviation' }
      ]
    };
  }

  /**
   * Data transformation methods
   */
  transformIndicatorData(data) {
    if (!data || !data.data) return [];

    return data.data.map(item => ({
      timestamp: item.timestamp,
      date: new Date(item.timestamp),
      value: item.value
    }));
  }

  transformBatchIndicatorData(data) {
    if (!data || !data.data) return [];

    return data.data.map(item => {
      const transformed = {
        timestamp: item.timestamp,
        date: new Date(item.timestamp)
      };

      // Add all indicator values
      Object.keys(item).forEach(key => {
        if (key !== 'timestamp') {
          transformed[key] = item[key];
        }
      });

      return transformed;
    });
  }

  transformPatternData(data) {
    if (!data || !data.patterns) return [];

    return data.patterns.map(pattern => ({
      timestamp: pattern.timestamp,
      date: new Date(pattern.timestamp),
      pattern: pattern.pattern,
      strength: pattern.strength,
      confidence: pattern.confidence,
      descriptionFa: pattern.description_fa,
      descriptionEn: this.getPatternDescription(pattern.pattern)
    }));
  }

  /**
   * Get pattern description in English
   */
  getPatternDescription(patternName) {
    const descriptions = {
      'bullish_engulfing': 'Bullish Engulfing',
      'bearish_engulfing': 'Bearish Engulfing',
      'hammer': 'Hammer',
      'shooting_star': 'Shooting Star',
      'doji': 'Doji',
      'morning_star': 'Morning Star',
      'evening_star': 'Evening Star',
      'hanging_man': 'Hanging Man',
      'inverted_hammer': 'Inverted Hammer',
      'dark_cloud_cover': 'Dark Cloud Cover',
      'piercing_pattern': 'Piercing Pattern',
      'three_white_soldiers': 'Three White Soldiers',
      'three_black_crows': 'Three Black Crows'
    };

    return descriptions[patternName] || patternName;
  }

  /**
   * Get cache time based on timeframe
   */
  getCacheTime(timeframe) {
    const timeframeCacheMap = {
      '1m': 30,    // 30 seconds
      '5m': 60,    // 1 minute
      '15m': 180,  // 3 minutes
      '30m': 300,  // 5 minutes
      '1H': 600,   // 10 minutes
      '4H': 1800,  // 30 minutes
      '1D': 3600,  // 1 hour
      '1W': 7200,  // 2 hours
      '1M': 14400  // 4 hours
    };

    return timeframeCacheMap[timeframe] || 600;
  }

  /**
   * Validate indicator configuration
   */
  validateIndicatorConfig(config) {
    const required = ['type'];
    const errors = [];

    required.forEach(field => {
      if (!config[field]) {
        errors.push(`${field} is required`);
      }
    });

    // Validate specific indicator requirements
    switch (config.type) {
      case 'sma':
      case 'ema':
      case 'wma':
        if (!config.period || config.period < 1) {
          errors.push('Period must be greater than 0');
        }
        break;
      
      case 'bollinger':
        if (!config.period || config.period < 1) {
          errors.push('Period must be greater than 0');
        }
        if (!config.std || config.std <= 0) {
          errors.push('Standard deviation must be greater than 0');
        }
        break;
      
      case 'macd':
        if (!config.fast || !config.slow || !config.signal) {
          errors.push('MACD requires fast, slow, and signal periods');
        }
        break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Clear cache
   */
  clearCache(symbol = null) {
    if (symbol) {
      this.cache.clearPattern(`*${symbol}*`);
    } else {
      this.cache.clear();
    }
  }
}

// Singleton instance
const indicatorRepository = new IndicatorRepository();

export { IndicatorRepository, indicatorRepository };
export default indicatorRepository;