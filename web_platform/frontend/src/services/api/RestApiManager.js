/**
 * REST API Manager - مدیریت API درخواست‌ها
 * Centralized REST API management with polling, caching, and error handling
 * ⚠️ NO WebSocket connections - ONLY REST API calls to backend
 * Connects to backend at http://localhost:8000
 */

import stockRepository from '../repositories/StockRepository';
import localStorageManager from '../storage/LocalStorageManager';

class RestApiManager {
  constructor() {
    this.pollingIntervals = new Map();
    this.subscribers = new Map();
    this.isPolling = false;
    this.settings = {
      realTimeInterval: 5000,    // 5 seconds for real-time data
      marketDataInterval: 10000, // 10 seconds for market overview
      portfolioInterval: 30000,  // 30 seconds for portfolio updates
      alertsInterval: 15000,     // 15 seconds for alerts checking
      watchlistInterval: 5000,   // 5 seconds for watchlist updates
      maxRetries: 3,
      retryDelay: 2000,
      batchSize: 10  // Max symbols per batch request
    };
    
    this.loadSettings();
  }

  /**
   * Load settings from storage
   */
  loadSettings() {
    const savedSettings = localStorageManager.getNestedData('api', 'settings', {});
    this.settings = { ...this.settings, ...savedSettings };
  }

  /**
   * Save settings to storage
   */
  saveSettings() {
    localStorageManager.updateData('api', 'settings', this.settings);
  }

  /**
   * Subscribe to real-time data for symbols
   */
  subscribeToSymbols(symbols, callback, options = {}) {
    const {
      interval = this.settings.realTimeInterval,
      type = 'realtime'
    } = options;

    const subscriptionId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store subscription
    this.subscribers.set(subscriptionId, {
      symbols: Array.isArray(symbols) ? symbols : [symbols],
      callback,
      type,
      interval,
      lastUpdate: 0,
      active: true
    });

    console.log(`📡 Subscribed to ${symbols.length || 1} symbols (${type}) - ID: ${subscriptionId}`);
    
    // Start polling if not already running
    this.startPolling();
    
    // Return unsubscribe function
    return () => this.unsubscribe(subscriptionId);
  }

  /**
   * Unsubscribe from data updates
   */
  unsubscribe(subscriptionId) {
    if (this.subscribers.has(subscriptionId)) {
      this.subscribers.delete(subscriptionId);
      console.log(`📡 Unsubscribed - ID: ${subscriptionId}`);
      
      // Stop polling if no more subscribers
      if (this.subscribers.size === 0) {
        this.stopPolling();
      }
    }
  }

  /**
   * Start polling for all subscriptions
   */
  startPolling() {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;
    console.log('📡 Started REST API polling');
    
    // Start main polling loop
    this.pollingLoop();
  }

  /**
   * Stop all polling
   */
  stopPolling() {
    this.isPolling = false;
    
    // Clear all intervals
    this.pollingIntervals.forEach(interval => clearTimeout(interval));
    this.pollingIntervals.clear();
    
    console.log('📡 Stopped REST API polling');
  }

  /**
   * Main polling loop
   */
  async pollingLoop() {
    if (!this.isPolling) {
      return;
    }

    const now = Date.now();
    const activeSubscriptions = Array.from(this.subscribers.values()).filter(sub => sub.active);
    
    if (activeSubscriptions.length === 0) {
      this.scheduleNextPoll();
      return;
    }

    // Group subscriptions by type and interval
    const subscriptionGroups = this.groupSubscriptions(activeSubscriptions, now);
    
    // Process each group
    for (const [groupKey, group] of subscriptionGroups.entries()) {
      if (group.shouldUpdate) {
        await this.processSubscriptionGroup(group);
      }
    }

    // Schedule next poll
    this.scheduleNextPoll();
  }

  /**
   * Group subscriptions by type and check if they need updates
   */
  groupSubscriptions(subscriptions, now) {
    const groups = new Map();

    subscriptions.forEach(subscription => {
      const groupKey = `${subscription.type}_${subscription.interval}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          type: subscription.type,
          interval: subscription.interval,
          subscriptions: [],
          symbols: new Set(),
          shouldUpdate: false
        });
      }

      const group = groups.get(groupKey);
      group.subscriptions.push(subscription);
      
      // Add symbols to the group
      subscription.symbols.forEach(symbol => group.symbols.add(symbol));
      
      // Check if this group needs update
      if (now - subscription.lastUpdate >= subscription.interval) {
        group.shouldUpdate = true;
      }
    });

    return groups;
  }

  /**
   * Process a group of subscriptions
   */
  async processSubscriptionGroup(group) {
    const symbols = Array.from(group.symbols);
    
    try {
      console.log(`📡 Fetching ${group.type} data for ${symbols.length} symbols via REST API`);
      
      let data;
      switch (group.type) {
        case 'realtime':
          data = await this.fetchRealTimeData(symbols);
          break;
        case 'historical':
          data = await this.fetchHistoricalData(symbols);
          break;
        case 'fundamentals':
          data = await this.fetchFundamentalsData(symbols);
          break;
        default:
          console.warn(`Unknown subscription type: ${group.type}`);
          return;
      }

      // Notify all subscribers in this group
      const now = Date.now();
      group.subscriptions.forEach(subscription => {
        const symbolData = {};
        subscription.symbols.forEach(symbol => {
          if (data[symbol]) {
            symbolData[symbol] = data[symbol];
          }
        });

        if (Object.keys(symbolData).length > 0) {
          subscription.callback(symbolData);
          subscription.lastUpdate = now;
        }
      });

    } catch (error) {
      console.error(`❌ Failed to fetch ${group.type} data:`, error);
      
      // Notify subscribers of error
      group.subscriptions.forEach(subscription => {
        if (typeof subscription.callback === 'function') {
          subscription.callback(null, error);
        }
      });
    }
  }

  /**
   * Fetch real-time data for multiple symbols
   */
  async fetchRealTimeData(symbols) {
    const data = {};
    const batches = this.createBatches(symbols, this.settings.batchSize);
    
    for (const batch of batches) {
      const batchPromises = batch.map(async (symbol) => {
        try {
          const symbolData = await this.fetchWithRetry(
            () => stockRepository.getRealTimeData(symbol),
            `realtime_${symbol}`
          );
          return { symbol, data: symbolData };
        } catch (error) {
          console.warn(`⚠️ Failed to fetch real-time data for ${symbol}:`, error.message);
          return { symbol, data: null, error };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value.data) {
          data[result.value.symbol] = result.value.data;
        }
      });
    }

    return data;
  }

  /**
   * Fetch historical data for multiple symbols
   */
  async fetchHistoricalData(symbols, options = {}) {
    const data = {};
    
    for (const symbol of symbols) {
      try {
        const symbolData = await this.fetchWithRetry(
          () => stockRepository.getHistoricalData(symbol, options),
          `historical_${symbol}`
        );
        data[symbol] = symbolData;
      } catch (error) {
        console.warn(`⚠️ Failed to fetch historical data for ${symbol}:`, error.message);
      }
    }

    return data;
  }

  /**
   * Fetch fundamentals data for multiple symbols
   */
  async fetchFundamentalsData(symbols) {
    const data = {};
    
    for (const symbol of symbols) {
      try {
        const symbolData = await this.fetchWithRetry(
          () => stockRepository.getFundamentals(symbol),
          `fundamentals_${symbol}`
        );
        data[symbol] = symbolData;
      } catch (error) {
        console.warn(`⚠️ Failed to fetch fundamentals for ${symbol}:`, error.message);
      }
    }

    return data;
  }

  /**
   * Fetch data with retry logic
   */
  async fetchWithRetry(fetchFunction, cacheKey, retries = 0) {
    try {
      return await fetchFunction();
    } catch (error) {
      if (retries < this.settings.maxRetries) {
        console.log(`🔄 Retrying ${cacheKey} (attempt ${retries + 1})`);
        await this.sleep(this.settings.retryDelay * (retries + 1));
        return this.fetchWithRetry(fetchFunction, cacheKey, retries + 1);
      }
      throw error;
    }
  }

  /**
   * Create batches from array
   */
  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Schedule next polling iteration
   */
  scheduleNextPoll() {
    if (!this.isPolling) {
      return;
    }

    // Find the shortest interval among active subscriptions
    const activeSubscriptions = Array.from(this.subscribers.values()).filter(sub => sub.active);
    const shortestInterval = activeSubscriptions.reduce((min, sub) => {
      return Math.min(min, sub.interval);
    }, this.settings.realTimeInterval);

    // Schedule next poll
    const pollInterval = Math.min(shortestInterval / 2, 1000); // At least every second
    const timeoutId = setTimeout(() => this.pollingLoop(), pollInterval);
    this.pollingIntervals.set(Date.now(), timeoutId);
  }

  /**
   * Utility sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current polling status
   */
  getStatus() {
    return {
      isPolling: this.isPolling,
      subscriberCount: this.subscribers.size,
      activeIntervals: this.pollingIntervals.size,
      settings: { ...this.settings }
    };
  }

  /**
   * Update settings
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
    console.log('⚙️ REST API settings updated:', newSettings);
  }

  /**
   * Get all subscriptions info
   */
  getSubscriptions() {
    return Array.from(this.subscribers.entries()).map(([id, sub]) => ({
      id,
      type: sub.type,
      symbols: sub.symbols,
      interval: sub.interval,
      lastUpdate: sub.lastUpdate,
      active: sub.active
    }));
  }

  /**
   * Pause/resume specific subscription
   */
  toggleSubscription(subscriptionId, active) {
    if (this.subscribers.has(subscriptionId)) {
      this.subscribers.get(subscriptionId).active = active;
      console.log(`📡 Subscription ${subscriptionId} ${active ? 'resumed' : 'paused'}`);
    }
  }

  /**
   * Clear all subscriptions and stop polling
   */
  destroy() {
    this.stopPolling();
    this.subscribers.clear();
    console.log('💥 REST API Manager destroyed');
  }
}

// Singleton instance
const restApiManager = new RestApiManager();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    restApiManager.destroy();
  });
}

export { RestApiManager, restApiManager };
export default restApiManager;