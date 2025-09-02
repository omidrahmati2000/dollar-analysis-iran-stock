/**
 * Stock Repository - مدیریت داده‌های سهام
 * Repository Pattern Implementation using REST API only
 * NO WebSocket connections - all data fetched via REST endpoints
 */

import apiService from '../api/base';
import { CacheManager } from '../cache/CacheManager';

class StockRepository {
  constructor() {
    this.cache = new CacheManager('stocks');
    this.endpoints = {
      // Stock endpoints based on your backend API
      stocks: '/api/v2/stocks',
      stockDetails: (symbol) => `/api/v2/stocks/${symbol}`,
      ohlcv: (symbol) => `/api/v2/stocks/${symbol}/ohlcv`,
      search: (query) => `/api/v2/stocks/search/${query}`,
      
      // Technical indicators
      indicators: (symbol) => `/api/v2/indicators/${symbol}`,
      signalsSummary: '/api/v2/indicators/signals/summary',
      
      // Market data
      marketSummary: '/api/v2/market/summary',
      
      // Currency endpoints  
      currencies: '/api/v2/currencies',
      currencyDetails: (code) => `/api/v2/currencies/${code}`,
      currencyConvert: '/api/v2/currencies/convert',
      allRates: '/api/v2/currencies/rates/all',
      currencyStats: '/api/v2/market/currencies/statistics',
      
      // Health endpoints
      health: '/health',
      root: '/'
    };
  }

  /**
   * Get real-time stock data for single symbol using your backend API
   */
  async getRealTimeData(symbol) {
    const cacheKey = `realtime_${symbol}`;
    
    try {
      // Check cache first (cache for 5 seconds for real-time data)
      const cached = this.cache.get(cacheKey, 5);
      if (cached) {
        console.log(`📦 Cache hit for ${symbol} real-time data`);
        return cached;
      }

      console.log(`📡 Fetching real-time data for ${symbol} from backend API`);
      const data = await apiService.get(this.endpoints.stockDetails(symbol));
      
      // Cache the result
      this.cache.set(cacheKey, data);
      
      return this.transformStockResponse(data);
    } catch (error) {
      console.error(`❌ Failed to get real-time data for ${symbol}:`, error);
      
      // Return cached data if available, even if expired
      const fallback = this.cache.get(cacheKey, Infinity);
      if (fallback) {
        console.log(`🔄 Using fallback cache for ${symbol}`);
        return fallback;
      }
      
      throw error;
    }
  }

  /**
   * Get real-time data for multiple symbols using your backend API
   */
  async getBatchRealTimeData(symbols) {
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return {};
    }

    // Check cache for each symbol
    const results = {};
    const symbolsToFetch = [];

    symbols.forEach(symbol => {
      const cacheKey = `realtime_${symbol}`;
      const cached = this.cache.get(cacheKey, 5);
      if (cached) {
        results[symbol] = cached;
        console.log(`📦 Cache hit for ${symbol} batch real-time data`);
      } else {
        symbolsToFetch.push(symbol);
      }
    });

    // Fetch remaining symbols individually (since backend doesn't have batch endpoint yet)
    if (symbolsToFetch.length > 0) {
      console.log(`📡 Fetching real-time data for ${symbolsToFetch.length} symbols from backend API`);
      
      const fetchPromises = symbolsToFetch.map(async (symbol) => {
        try {
          const data = await apiService.get(this.endpoints.stockDetails(symbol));
          const transformedData = this.transformStockResponse(data);
          
          // Cache individual symbol data
          const cacheKey = `realtime_${symbol}`;
          this.cache.set(cacheKey, transformedData);
          
          return { symbol, data: transformedData };
        } catch (error) {
          console.warn(`⚠️ Failed to fetch data for ${symbol}:`, error.message);
          
          // Try to get cached data (even if expired)
          const cacheKey = `realtime_${symbol}`;
          const fallback = this.cache.get(cacheKey, Infinity);
          if (fallback) {
            return { symbol, data: fallback };
          }
          return { symbol, data: null };
        }
      });

      const fetchResults = await Promise.allSettled(fetchPromises);
      fetchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value.data) {
          results[result.value.symbol] = result.value.data;
        }
      });
    }

    return results;
  }

  /**
   * Get historical OHLCV data using your backend API
   */
  async getHistoricalData(symbol, options = {}) {
    const {
      days = 30
    } = options;

    const params = { days };
    const cacheKey = `history_${symbol}_${days}`;
    
    try {
      // Cache historical data for longer (5 minutes)
      const cached = this.cache.get(cacheKey, 300);
      
      if (cached) {
        console.log(`📦 Cache hit for ${symbol} historical data`);
        return cached;
      }

      console.log(`📡 Fetching historical data for ${symbol} (${days} days) from backend API`);
      const data = await apiService.get(this.endpoints.ohlcv(symbol), params);
      
      // Cache the result
      this.cache.set(cacheKey, data);
      
      return this.transformOHLCVData(data);
    } catch (error) {
      console.error(`❌ Failed to get historical data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get tick data (for volume footprint analysis)
   */
  async getTickData(symbol, options = {}) {
    const {
      from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24h ago
      to = new Date().toISOString(),
      limit = 10000
    } = options;

    const params = { from, to, limit };
    const cacheKey = `ticks_${symbol}_${JSON.stringify(params)}`;
    
    try {
      // Cache tick data for 1 minute
      const cached = this.cache.get(cacheKey, 60);
      if (cached) return cached;

      const data = await apiService.get(this.endpoints.ticks(symbol), params);
      this.cache.set(cacheKey, data);
      
      return this.transformTickData(data);
    } catch (error) {
      console.error(`❌ Failed to get tick data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get symbols list (simple array of symbol names)
   */
  async getSymbolsList() {
    const cacheKey = 'symbols_list';
    
    try {
      // Cache symbols list for 10 minutes
      const cached = this.cache.get(cacheKey, 600);
      if (cached) return cached;

      const stockList = await this.getStockList();
      const symbolsList = stockList.map(stock => stock.symbol);
      
      this.cache.set(cacheKey, symbolsList);
      return symbolsList;
    } catch (error) {
      console.error('❌ Failed to get symbols list:', error);
      return [];
    }
  }

  /**
   * Get list of all stocks using your backend API
   */
  async getStockList(filters = {}) {
    const {
      limit = 50,
      symbol_filter = null,
      min_volume = null,
      sort_by = 'volume',
      page = 1
    } = filters;

    const params = {
      limit,
      page,
      sort_by,
      ...(symbol_filter && { symbol_filter }),
      ...(min_volume && { min_volume })
    };

    const cacheKey = `list_${JSON.stringify(params)}`;
    
    try {
      // Cache stock list for 10 minutes
      const cached = this.cache.get(cacheKey, 600);
      if (cached) return cached;

      console.log(`📡 Fetching stock list from backend API`);
      const data = await apiService.get(this.endpoints.stocks, params);
      this.cache.set(cacheKey, data);
      
      return this.transformStockListResponse(data);
    } catch (error) {
      console.error('❌ Failed to get stock list:', error);
      throw error;
    }
  }

  /**
   * Search stocks by symbol or name using your backend API
   */
  async searchStocks(query, limit = 10) {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `search_${query}_${limit}`;
    
    try {
      // Cache search results for 5 minutes
      const cached = this.cache.get(cacheKey, 300);
      if (cached) return cached;

      console.log(`📡 Searching stocks for "${query}" from backend API`);
      const data = await apiService.get(this.endpoints.search(query), { limit });
      this.cache.set(cacheKey, data);
      
      return this.transformStockListResponse(data);
    } catch (error) {
      console.error(`❌ Failed to search stocks for "${query}":`, error);
      return [];
    }
  }

  /**
   * Get technical indicators for symbol
   */
  async getTechnicalIndicators(symbol, indicators = null) {
    const cacheKey = `indicators_${symbol}_${indicators || 'all'}`;
    
    try {
      // Cache indicators for 1 minute
      const cached = this.cache.get(cacheKey, 60);
      if (cached) return cached;

      const params = indicators ? { indicators } : {};
      console.log(`📡 Fetching technical indicators for ${symbol} from backend API`);
      const data = await apiService.get(this.endpoints.indicators(symbol), params);
      this.cache.set(cacheKey, data);
      
      return this.transformTechnicalIndicators(data);
    } catch (error) {
      console.error(`❌ Failed to get technical indicators for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get market summary
   */
  async getMarketSummary() {
    const cacheKey = 'market_summary';
    
    try {
      // Cache market summary for 1 minute
      const cached = this.cache.get(cacheKey, 60);
      if (cached) return cached;

      console.log('📡 Fetching market summary from backend API');
      const data = await apiService.get(this.endpoints.marketSummary);
      this.cache.set(cacheKey, data);
      
      return this.transformMarketSummary(data);
    } catch (error) {
      console.error('❌ Failed to get market summary:', error);
      throw error;
    }
  }

  /**
   * Get signals summary
   */
  async getSignalsSummary(symbols = null) {
    const cacheKey = `signals_${symbols || 'all'}`;
    
    try {
      // Cache signals for 30 seconds
      const cached = this.cache.get(cacheKey, 30);
      if (cached) return cached;

      const params = symbols ? { symbols } : {};
      console.log('📡 Fetching signals summary from backend API');
      const data = await apiService.get(this.endpoints.signalsSummary, params);
      this.cache.set(cacheKey, data);
      
      return data;
    } catch (error) {
      console.error('❌ Failed to get signals summary:', error);
      throw error;
    }
  }

  /**
   * Data transformation methods for your backend API
   */
  transformStockResponse(data) {
    if (!data) return null;

    return {
      symbol: data.symbol,
      company_name: data.company_name,
      companyName: data.company_name,
      timestamp: data.last_update,
      date: new Date(data.last_update),
      open: data.last_price, // Using last_price as current price
      high: data.last_price,
      low: data.last_price, 
      close: data.last_price,
      last_price: data.last_price,
      volume: data.volume,
      market_cap: data.market_cap,
      marketCap: data.market_cap,
      lastTradeTime: new Date(data.last_update),
      last_update: data.last_update,
      change: data.price_change,
      price_change: data.price_change,
      changePercent: data.price_change_percent,
      price_change_percent: data.price_change_percent
    };
  }

  transformOHLCVData(response) {
    if (!Array.isArray(response)) return [];

    return response.map(item => ({
      timestamp: new Date(item.date).getTime(),
      date: new Date(item.date),
      time: new Date(item.date).getTime() / 1000, // LightWeight Charts format
      open: item.open_price,
      high: item.high_price,
      low: item.low_price,
      close: item.close_price,
      volume: item.volume,
      adjustedClose: item.adjusted_close,
      dailyReturn: item.daily_return,
      volatility: item.volatility,
      // Calculate typical price for VWAP calculations
      typical: (item.high_price + item.low_price + item.close_price) / 3,
      // Calculate price change
      change: item.close_price - item.open_price,
      changePercent: item.open_price > 0 ? ((item.close_price - item.open_price) / item.open_price) * 100 : 0
    }));
  }

  transformTickData(response) {
    if (!response || !response.ticks) return [];

    return response.ticks.map(tick => ({
      timestamp: tick.timestamp,
      date: new Date(tick.timestamp),
      price: tick.price,
      volume: tick.volume,
      side: tick.side, // 'buy', 'sell', 'neutral'
      isBuy: tick.side === 'buy',
      isSell: tick.side === 'sell'
    }));
  }

  transformStockListResponse(response) {
    if (!Array.isArray(response)) return [];

    return response.map(stock => ({
      symbol: stock.symbol,
      company_name: stock.company_name,
      companyName: stock.company_name,
      nameFa: stock.company_name, // Using company_name for both
      nameEn: stock.company_name,
      last_price: stock.last_price,
      lastPrice: stock.last_price,
      change: stock.price_change,
      price_change: stock.price_change,
      changePercent: stock.price_change_percent,
      price_change_percent: stock.price_change_percent,
      volume: stock.volume,
      market_cap: stock.market_cap,
      marketCap: stock.market_cap,
      last_update: stock.last_update,
      lastUpdate: stock.last_update,
      isActive: true // Assuming all returned stocks are active
    }));
  }

  transformTechnicalIndicators(data) {
    if (!Array.isArray(data)) return [];

    return data.map(indicator => ({
      symbol: indicator.symbol,
      name: indicator.indicator_name,
      value: indicator.value,
      signal: indicator.signal,
      date: new Date(indicator.calculation_date),
      timestamp: new Date(indicator.calculation_date).getTime()
    }));
  }

  transformMarketSummary(data) {
    if (!data) return null;

    return {
      totalVolume: data.total_volume,
      totalTrades: data.total_trades,
      totalMarketCap: data.total_market_cap,
      activeSymbols: data.active_symbols,
      topGainers: data.top_gainers || [],
      topLosers: data.top_losers || [],
      marketStatus: data.market_status,
      marketTrend: data.market_trend,
      lastUpdate: new Date(data.last_update),
      timestamp: new Date(data.last_update).getTime()
    };
  }

  /**
   * Clear cache for specific symbol or all
   */
  clearCache(symbol = null) {
    if (symbol) {
      this.cache.clearPattern(`*${symbol}*`);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  // Alias methods for compatibility with existing components
  async getAllStocks(limit = 50) {
    return await this.getStockList({ limit });
  }

  async getStock(symbol) {
    return await this.getRealTimeData(symbol);
  }

  async getOHLCVData(symbol, options = {}) {
    const { timeframe = '1d', limit = 500 } = options;
    // Convert timeframe to days for historical data
    let days = 30;
    switch (timeframe) {
      case '1m':
      case '5m':
      case '15m':
      case '30m':
      case '1h':
        days = 1; // 1 day for intraday
        break;
      case '4h':
        days = 7; // 1 week for 4h
        break;
      case '1d':
        days = Math.min(limit, 365); // Up to 1 year for daily
        break;
      case '1w':
        days = Math.min(limit * 7, 365 * 2); // Up to 2 years for weekly
        break;
      default:
        days = 30;
    }
    
    return await this.getHistoricalData(symbol, { days });
  }

  async getStockData(symbol) {
    return await this.getRealTimeData(symbol);
  }

  async searchStock(query) {
    return await this.searchStocks(query);
  }
}

// Singleton instance
const stockRepository = new StockRepository();

export { StockRepository, stockRepository };
export default stockRepository;