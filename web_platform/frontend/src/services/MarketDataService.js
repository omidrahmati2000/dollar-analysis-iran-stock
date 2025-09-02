/**
 * Market Data Service - سرویس داده‌های بازار
 * Service for fetching and managing market data from backend API
 * NO WebSocket - only REST API calls to http://localhost:8000
 */

import stockRepository from './repositories/StockRepository';
import restApiManager from './api/RestApiManager';

class MarketDataService {
  constructor() {
    this.isInitialized = false;
    this.marketData = {
      summary: null,
      topGainers: [],
      topLosers: [],
      activeSymbols: [],
      lastUpdate: null
    };
    
    this.subscribers = new Set();
    this.updateInterval = null;
    this.pollingFrequency = 30000; // 30 seconds for market data
  }

  /**
   * Initialize the service
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('🚀 Initializing Market Data Service...');
      
      // Initial data fetch
      await this.fetchMarketData();
      
      // Start polling
      this.startPolling();
      
      this.isInitialized = true;
      console.log('✅ Market Data Service initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize Market Data Service:', error);
      throw error;
    }
  }

  /**
   * Fetch market summary and statistics
   */
  async fetchMarketData() {
    try {
      console.log('📡 Fetching market data from backend API...');
      
      // Fetch market summary
      const marketSummary = await stockRepository.getMarketSummary();
      
      // Fetch stock list for top gainers/losers
      const stockList = await stockRepository.getStockList({ 
        limit: 100,
        sort_by: 'volume'
      });

      // Process data
      this.marketData = {
        summary: marketSummary,
        topGainers: this.extractTopPerformers(stockList, 'gainers'),
        topLosers: this.extractTopPerformers(stockList, 'losers'),
        activeSymbols: stockList.length,
        lastUpdate: Date.now()
      };

      // Notify subscribers
      this.notifySubscribers();
      
      console.log('✅ Market data updated successfully');
      
    } catch (error) {
      console.error('❌ Failed to fetch market data:', error);
      throw error;
    }
  }

  /**
   * Extract top performers from stock list
   */
  extractTopPerformers(stocks, type = 'gainers', limit = 10) {
    if (!Array.isArray(stocks) || stocks.length === 0) {
      return [];
    }

    const filtered = stocks
      .filter(stock => stock.changePercent !== undefined && stock.changePercent !== null)
      .sort((a, b) => {
        if (type === 'gainers') {
          return b.changePercent - a.changePercent;
        } else {
          return a.changePercent - b.changePercent;
        }
      })
      .slice(0, limit);

    return filtered.map(stock => ({
      symbol: stock.symbol,
      companyName: stock.companyName,
      price: stock.lastPrice,
      change: stock.change,
      changePercent: stock.changePercent,
      volume: stock.volume
    }));
  }

  /**
   * Get current market data
   */
  getMarketData() {
    return { ...this.marketData };
  }

  /**
   * Get market summary
   */
  getMarketSummary() {
    return this.marketData.summary;
  }

  /**
   * Get top gainers
   */
  getTopGainers(limit = 10) {
    return this.marketData.topGainers.slice(0, limit);
  }

  /**
   * Get top losers
   */
  getTopLosers(limit = 10) {
    return this.marketData.topLosers.slice(0, limit);
  }

  /**
   * Subscribe to market data updates
   */
  subscribe(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    this.subscribers.add(callback);
    
    // Send current data immediately
    if (this.marketData.lastUpdate) {
      callback(this.getMarketData());
    }

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify all subscribers
   */
  notifySubscribers() {
    const data = this.getMarketData();
    this.subscribers.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('❌ Error notifying subscriber:', error);
      }
    });
  }

  /**
   * Start polling for updates
   */
  startPolling() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(() => {
      this.fetchMarketData().catch(error => {
        console.error('❌ Market data polling error:', error);
      });
    }, this.pollingFrequency);

    console.log(`📡 Market data polling started (${this.pollingFrequency}ms interval)`);
  }

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('⏹️ Market data polling stopped');
    }
  }

  /**
   * Update polling frequency
   */
  setPollingFrequency(frequency) {
    this.pollingFrequency = frequency;
    if (this.updateInterval) {
      this.stopPolling();
      this.startPolling();
    }
  }

  /**
   * Force refresh market data
   */
  async refresh() {
    console.log('🔄 Force refreshing market data...');
    await this.fetchMarketData();
  }

  /**
   * Get specific stock data
   */
  async getStockData(symbol) {
    try {
      const data = await stockRepository.getRealTimeData(symbol);
      return data;
    } catch (error) {
      console.error(`❌ Failed to get data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Search stocks
   */
  async searchStocks(query) {
    try {
      const results = await stockRepository.searchStocks(query);
      return results;
    } catch (error) {
      console.error(`❌ Failed to search stocks for "${query}":`, error);
      return [];
    }
  }

  /**
   * Get technical indicators for symbol
   */
  async getTechnicalIndicators(symbol) {
    try {
      const indicators = await stockRepository.getTechnicalIndicators(symbol);
      return indicators;
    } catch (error) {
      console.error(`❌ Failed to get indicators for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get historical data for symbol
   */
  async getHistoricalData(symbol, days = 30) {
    try {
      const data = await stockRepository.getHistoricalData(symbol, { days });
      return data;
    } catch (error) {
      console.error(`❌ Failed to get historical data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Check if service is running
   */
  isRunning() {
    return this.isInitialized && this.updateInterval !== null;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      polling: this.updateInterval !== null,
      subscribers: this.subscribers.size,
      pollingFrequency: this.pollingFrequency,
      lastUpdate: this.marketData.lastUpdate,
      dataSource: 'REST API (http://localhost:8000)'
    };
  }

  /**
   * Cleanup and stop service
   */
  destroy() {
    this.stopPolling();
    this.subscribers.clear();
    this.isInitialized = false;
    console.log('💥 Market Data Service destroyed');
  }
}

// Singleton instance
const marketDataService = new MarketDataService();

// Initialize on import
if (typeof window !== 'undefined') {
  // Initialize after a short delay to ensure DOM is ready
  setTimeout(() => {
    marketDataService.initialize().catch(error => {
      console.error('❌ Failed to auto-initialize Market Data Service:', error);
    });
  }, 1000);

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    marketDataService.destroy();
  });
}

export { MarketDataService, marketDataService };
export default marketDataService;