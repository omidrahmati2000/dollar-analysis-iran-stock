/**
 * Watchlist Service - مدیریت واچ لیست محلی
 * Local watchlist management with real-time price updates
 */

import localStorageManager from './storage/LocalStorageManager';
import stockRepository from './repositories/StockRepository';
import chartDataService from './ChartDataService';

class WatchlistService {
  constructor() {
    this.storageKey = 'watchlists';
    this.priceUpdateInterval = null;
    this.updateFrequency = 30000; // 30 seconds
    this.subscribedSymbols = new Set();
    
    this.initializeWatchlists();
  }

  /**
   * Initialize watchlists structure
   */
  initializeWatchlists() {
    const defaultWatchlists = {
      lists: {
        'default': {
          id: 'default',
          name: 'پیش‌فرض',
          symbols: [],
          color: '#2196f3',
          isDefault: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      symbolData: {}, // Cache for symbol price data
      settings: {
        autoUpdate: true,
        updateFrequency: 30000,
        showChangePercent: true,
        showVolume: true,
        defaultSort: 'alphabetical', // alphabetical, change, volume
        compactView: false
      },
      activeList: 'default'
    };

    if (!localStorageManager.exists('watchlists_initialized')) {
      localStorageManager.setData('watchlists', defaultWatchlists);
      localStorageManager.setData('watchlists_initialized', true);
      console.log('👁️ Watchlists initialized');
    }

    this.startPriceUpdates();
  }

  /**
   * Create new watchlist
   */
  createWatchlist(name, color = '#2196f3') {
    if (!name || name.trim().length === 0) {
      throw new Error('Watchlist name is required');
    }

    const watchlist = {
      id: this.generateId(),
      name: name.trim(),
      symbols: [],
      color,
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const lists = this.getWatchlists();
    lists[watchlist.id] = watchlist;
    
    localStorageManager.updateData('watchlists', 'lists', lists);
    
    console.log(`👁️ Watchlist created: ${name}`);
    return watchlist;
  }

  /**
   * Get all watchlists
   */
  getWatchlists() {
    return localStorageManager.getNestedData('watchlists', 'lists', {});
  }

  /**
   * Get specific watchlist
   */
  getWatchlist(listId) {
    const lists = this.getWatchlists();
    return lists[listId] || null;
  }

  /**
   * Update watchlist
   */
  updateWatchlist(listId, updates) {
    const lists = this.getWatchlists();
    
    if (!lists[listId]) {
      throw new Error('Watchlist not found');
    }

    if (lists[listId].isDefault && updates.name) {
      throw new Error('Cannot rename default watchlist');
    }

    lists[listId] = {
      ...lists[listId],
      ...updates,
      updatedAt: Date.now()
    };

    localStorageManager.updateData('watchlists', 'lists', lists);
    return lists[listId];
  }

  /**
   * Delete watchlist
   */
  deleteWatchlist(listId) {
    const lists = this.getWatchlists();
    
    if (!lists[listId]) {
      throw new Error('Watchlist not found');
    }

    if (lists[listId].isDefault) {
      throw new Error('Cannot delete default watchlist');
    }

    delete lists[listId];
    localStorageManager.updateData('watchlists', 'lists', lists);
    
    // If this was active list, switch to default
    const activeList = this.getActiveWatchlist();
    if (activeList === listId) {
      this.setActiveWatchlist('default');
    }

    console.log(`👁️ Watchlist deleted: ${listId}`);
    return true;
  }

  /**
   * Add symbol to watchlist
   */
  async addSymbol(listId, symbol, customData = {}) {
    const lists = this.getWatchlists();
    
    if (!lists[listId]) {
      throw new Error('Watchlist not found');
    }

    const upperSymbol = symbol.toUpperCase();
    
    // Check if symbol already exists
    if (lists[listId].symbols.some(s => s.symbol === upperSymbol)) {
      throw new Error('Symbol already in watchlist');
    }

    // Try to get symbol information
    let symbolInfo = null;
    try {
      const stockList = await stockRepository.getStockList({ search: upperSymbol });
      symbolInfo = stockList.find(s => s.symbol === upperSymbol);
    } catch (error) {
      console.warn(`⚠️ Could not fetch symbol info for ${upperSymbol}:`, error);
    }

    const symbolEntry = {
      symbol: upperSymbol,
      name: symbolInfo?.nameFa || customData.name || upperSymbol,
      sector: symbolInfo?.sector || customData.sector || 'Other',
      addedAt: Date.now(),
      notes: customData.notes || '',
      tags: customData.tags || [],
      // Price data (will be updated)
      currentPrice: null,
      change: null,
      changePercent: null,
      volume: null,
      lastUpdate: null
    };

    lists[listId].symbols.push(symbolEntry);
    lists[listId].updatedAt = Date.now();

    localStorageManager.updateData('watchlists', 'lists', lists);

    // Subscribe for price updates
    this.subscribeToSymbol(upperSymbol);

    console.log(`👁️ Symbol ${upperSymbol} added to ${lists[listId].name}`);
    return symbolEntry;
  }

  /**
   * Remove symbol from watchlist
   */
  removeSymbol(listId, symbol) {
    const lists = this.getWatchlists();
    
    if (!lists[listId]) {
      throw new Error('Watchlist not found');
    }

    const upperSymbol = symbol.toUpperCase();
    const initialLength = lists[listId].symbols.length;
    
    lists[listId].symbols = lists[listId].symbols.filter(s => s.symbol !== upperSymbol);
    
    if (lists[listId].symbols.length === initialLength) {
      throw new Error('Symbol not found in watchlist');
    }

    lists[listId].updatedAt = Date.now();
    localStorageManager.updateData('watchlists', 'lists', lists);

    // Unsubscribe if no other watchlists have this symbol
    this.checkAndUnsubscribe(upperSymbol);

    console.log(`👁️ Symbol ${upperSymbol} removed from ${lists[listId].name}`);
    return true;
  }

  /**
   * Move symbol between watchlists
   */
  moveSymbol(fromListId, toListId, symbol) {
    const lists = this.getWatchlists();
    
    if (!lists[fromListId] || !lists[toListId]) {
      throw new Error('One or both watchlists not found');
    }

    const upperSymbol = symbol.toUpperCase();
    const symbolIndex = lists[fromListId].symbols.findIndex(s => s.symbol === upperSymbol);
    
    if (symbolIndex === -1) {
      throw new Error('Symbol not found in source watchlist');
    }

    // Check if already exists in target
    if (lists[toListId].symbols.some(s => s.symbol === upperSymbol)) {
      throw new Error('Symbol already exists in target watchlist');
    }

    // Move the symbol
    const symbolData = lists[fromListId].symbols.splice(symbolIndex, 1)[0];
    lists[toListId].symbols.push(symbolData);

    // Update timestamps
    lists[fromListId].updatedAt = Date.now();
    lists[toListId].updatedAt = Date.now();

    localStorageManager.updateData('watchlists', 'lists', lists);

    console.log(`👁️ Symbol ${upperSymbol} moved from ${lists[fromListId].name} to ${lists[toListId].name}`);
    return true;
  }

  /**
   * Get active watchlist ID
   */
  getActiveWatchlist() {
    return localStorageManager.getNestedData('watchlists', 'activeList', 'default');
  }

  /**
   * Set active watchlist
   */
  setActiveWatchlist(listId) {
    const lists = this.getWatchlists();
    
    if (!lists[listId]) {
      throw new Error('Watchlist not found');
    }

    localStorageManager.updateData('watchlists', 'activeList', listId);
    
    // Update subscriptions based on new active list
    this.updatePriceSubscriptions();
    
    return listId;
  }

  /**
   * Get watchlist with current prices
   */
  getWatchlistWithPrices(listId) {
    const watchlist = this.getWatchlist(listId);
    if (!watchlist) {
      return null;
    }

    const symbolData = localStorageManager.getNestedData('watchlists', 'symbolData', {});
    
    // Merge watchlist symbols with cached price data
    const symbolsWithPrices = watchlist.symbols.map(symbol => ({
      ...symbol,
      ...(symbolData[symbol.symbol] || {})
    }));

    // Sort based on settings
    const settings = this.getSettings();
    const sortedSymbols = this.sortSymbols(symbolsWithPrices, settings.defaultSort);

    return {
      ...watchlist,
      symbols: sortedSymbols
    };
  }

  /**
   * Sort symbols based on criteria
   */
  sortSymbols(symbols, sortBy) {
    switch (sortBy) {
      case 'alphabetical':
        return symbols.sort((a, b) => a.symbol.localeCompare(b.symbol));
      
      case 'change':
        return symbols.sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0));
      
      case 'volume':
        return symbols.sort((a, b) => (b.volume || 0) - (a.volume || 0));
      
      case 'price':
        return symbols.sort((a, b) => (b.currentPrice || 0) - (a.currentPrice || 0));
      
      case 'sector':
        return symbols.sort((a, b) => {
          if (a.sector !== b.sector) {
            return a.sector.localeCompare(b.sector);
          }
          return a.symbol.localeCompare(b.symbol);
        });
      
      default:
        return symbols;
    }
  }

  /**
   * Search symbols in all watchlists
   */
  searchSymbols(query) {
    const lists = this.getWatchlists();
    const results = [];
    const lowerQuery = query.toLowerCase();

    Object.values(lists).forEach(list => {
      list.symbols.forEach(symbol => {
        if (
          symbol.symbol.toLowerCase().includes(lowerQuery) ||
          symbol.name.toLowerCase().includes(lowerQuery) ||
          (symbol.tags && symbol.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
        ) {
          results.push({
            ...symbol,
            watchlistId: list.id,
            watchlistName: list.name
          });
        }
      });
    });

    return results;
  }

  /**
   * Get all unique symbols from all watchlists
   */
  getAllSymbols() {
    const lists = this.getWatchlists();
    const symbolSet = new Set();
    
    Object.values(lists).forEach(list => {
      list.symbols.forEach(symbol => {
        symbolSet.add(symbol.symbol);
      });
    });

    return Array.from(symbolSet);
  }

  /**
   * Start real-time price updates
   */
  startPriceUpdates() {
    const settings = this.getSettings();
    
    if (!settings.autoUpdate) {
      console.log('👁️ Auto-update disabled');
      return;
    }

    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
    }

    this.priceUpdateInterval = setInterval(() => {
      this.updateAllPrices();
    }, settings.updateFrequency || this.updateFrequency);

    console.log(`👁️ Price updates started (${settings.updateFrequency || this.updateFrequency}ms interval)`);
    
    // Initial update
    this.updateAllPrices();
  }

  /**
   * Stop price updates
   */
  stopPriceUpdates() {
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
      this.priceUpdateInterval = null;
      console.log('👁️ Price updates stopped');
    }
  }

  /**
   * Update prices for all symbols using batch REST API
   */
  async updateAllPrices() {
    const symbols = this.getAllSymbols();
    
    if (symbols.length === 0) {
      return;
    }

    console.log(`👁️ Updating prices for ${symbols.length} symbols via batch REST API...`);

    try {
      // Use batch API for better performance
      const batchData = await stockRepository.getBatchRealTimeData(symbols);
      
      // Update all watchlists with new data
      Object.entries(batchData).forEach(([symbol, realTimeData]) => {
        const priceData = {
          currentPrice: realTimeData.close,
          changePercent: realTimeData.changePercent,
          volume: realTimeData.volume,
          lastUpdate: Date.now()
        };

        // Update symbol data cache
        this.updateSymbolData(symbol, priceData);
      });

      console.log(`✅ Updated prices for ${Object.keys(batchData).length}/${symbols.length} symbols via batch REST API`);
      
      // Dispatch custom event for UI updates
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('watchlistPricesUpdated', {
          detail: { 
            updatedCount: Object.keys(batchData).length, 
            totalSymbols: symbols.length,
            timestamp: Date.now()
          }
        }));
      }
    } catch (error) {
      console.error('❌ Failed to update watchlist prices:', error);
      
      // Fallback to individual API calls if batch fails
      console.log('🔄 Falling back to individual REST API calls...');
      await this.updatePricesIndividually(symbols);
    }
  }

  /**
   * Fallback method for individual symbol updates
   */
  async updatePricesIndividually(symbols) {
    const updatePromises = symbols.map(async (symbol) => {
      try {
        const realTimeData = await stockRepository.getRealTimeData(symbol);
        const priceData = {
          currentPrice: realTimeData.close,
          change: realTimeData.change,
          changePercent: realTimeData.changePercent,
          volume: realTimeData.volume,
          lastUpdate: Date.now()
        };
        
        this.updateSymbolData(symbol, priceData);
        return { symbol, success: true };
      } catch (error) {
        console.warn(`⚠️ Failed to update individual price for ${symbol}:`, error.message);
        return { symbol, success: false, error };
      }
    });

    const results = await Promise.allSettled(updatePromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    
    console.log(`✅ Individual updates: ${successCount}/${symbols.length} symbols updated`);
  }

  /**
   * Subscribe to real-time updates for symbol
   */
  subscribeToSymbol(symbol) {
    if (!this.subscribedSymbols.has(symbol)) {
      chartDataService.subscribeToRealTimeUpdates(symbol, (update) => {
        this.handleRealTimeUpdate(symbol, update);
      });
      
      this.subscribedSymbols.add(symbol);
      console.log(`👁️ Subscribed to real-time updates for ${symbol}`);
    }
  }

  /**
   * Handle real-time price update
   */
  handleRealTimeUpdate(symbol, update) {
    const symbolData = localStorageManager.getNestedData('watchlists', 'symbolData', {});
    
    symbolData[symbol] = {
      ...symbolData[symbol],
      currentPrice: update.price,
      change: update.change,
      changePercent: update.changePercent,
      volume: update.volume,
      lastUpdate: Date.now()
    };

    localStorageManager.updateData('watchlists', 'symbolData', symbolData);

    // Dispatch event for immediate UI update
    window.dispatchEvent(new CustomEvent('watchlistRealTimeUpdate', {
      detail: { symbol, update }
    }));
  }

  /**
   * Check if symbol should be unsubscribed
   */
  checkAndUnsubscribe(symbol) {
    const lists = this.getWatchlists();
    const stillUsed = Object.values(lists).some(list =>
      list.symbols.some(s => s.symbol === symbol)
    );

    if (!stillUsed && this.subscribedSymbols.has(symbol)) {
      chartDataService.unsubscribeFromRealTimeUpdates(symbol);
      this.subscribedSymbols.delete(symbol);
      console.log(`👁️ Unsubscribed from ${symbol}`);
    }
  }

  /**
   * Update price subscriptions based on current watchlists
   */
  updatePriceSubscriptions() {
    const currentSymbols = this.getAllSymbols();
    
    // Subscribe to new symbols
    currentSymbols.forEach(symbol => {
      this.subscribeToSymbol(symbol);
    });

    // Unsubscribe from unused symbols
    this.subscribedSymbols.forEach(symbol => {
      if (!currentSymbols.includes(symbol)) {
        chartDataService.unsubscribeFromRealTimeUpdates(symbol);
        this.subscribedSymbols.delete(symbol);
      }
    });
  }

  /**
   * Watchlist settings
   */
  getSettings() {
    return localStorageManager.getNestedData('watchlists', 'settings', {});
  }

  updateSettings(newSettings) {
    const currentSettings = this.getSettings();
    const updatedSettings = { ...currentSettings, ...newSettings };
    
    localStorageManager.updateData('watchlists', 'settings', updatedSettings);
    
    // Restart price updates if frequency changed
    if (newSettings.updateFrequency || newSettings.autoUpdate !== undefined) {
      if (updatedSettings.autoUpdate) {
        this.updateFrequency = updatedSettings.updateFrequency || this.updateFrequency;
        this.startPriceUpdates();
      } else {
        this.stopPriceUpdates();
      }
    }
    
    return updatedSettings;
  }

  /**
   * Get watchlist statistics
   */
  getStatistics() {
    const lists = this.getWatchlists();
    const symbolData = localStorageManager.getNestedData('watchlists', 'symbolData', {});
    
    let totalSymbols = 0;
    let symbolsWithPrices = 0;
    let totalValue = 0;
    let gainers = 0;
    let losers = 0;
    let unchanged = 0;

    Object.values(lists).forEach(list => {
      list.symbols.forEach(symbol => {
        totalSymbols++;
        const priceData = symbolData[symbol.symbol];
        
        if (priceData && priceData.currentPrice) {
          symbolsWithPrices++;
          totalValue += priceData.currentPrice;
          
          if (priceData.changePercent > 0) gainers++;
          else if (priceData.changePercent < 0) losers++;
          else unchanged++;
        }
      });
    });

    return {
      totalWatchlists: Object.keys(lists).length,
      totalSymbols,
      symbolsWithPrices,
      priceUpdateRate: totalSymbols > 0 ? (symbolsWithPrices / totalSymbols * 100).toFixed(1) : '0',
      marketSummary: {
        gainers,
        losers,
        unchanged
      },
      lastUpdate: Date.now()
    };
  }

  /**
   * Export watchlists
   */
  exportWatchlists() {
    const watchlistsData = {
      lists: this.getWatchlists(),
      settings: this.getSettings(),
      exportDate: Date.now(),
      version: '1.0.0'
    };

    const blob = new Blob([JSON.stringify(watchlistsData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `watchlists_export_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    
    return watchlistsData;
  }

  /**
   * Import watchlists
   */
  importWatchlists(watchlistsData, mergeMode = false) {
    try {
      if (!watchlistsData || !watchlistsData.lists) {
        throw new Error('Invalid watchlists data format');
      }

      const currentLists = this.getWatchlists();
      let newLists;

      if (mergeMode) {
        // Merge with existing watchlists
        newLists = { ...currentLists };
        
        Object.entries(watchlistsData.lists).forEach(([id, list]) => {
          if (list.isDefault) {
            // Merge symbols into default list
            const defaultList = newLists['default'];
            if (defaultList) {
              list.symbols.forEach(symbol => {
                if (!defaultList.symbols.some(s => s.symbol === symbol.symbol)) {
                  defaultList.symbols.push(symbol);
                }
              });
            }
          } else {
            // Add new watchlist with unique ID if name conflicts
            let uniqueId = id;
            let counter = 1;
            while (newLists[uniqueId]) {
              uniqueId = `${id}_${counter}`;
              counter++;
            }
            newLists[uniqueId] = { ...list, id: uniqueId };
          }
        });
      } else {
        // Replace all watchlists except default
        newLists = { default: currentLists.default };
        
        Object.entries(watchlistsData.lists).forEach(([id, list]) => {
          if (list.isDefault && newLists.default) {
            // Replace default list symbols
            newLists.default.symbols = list.symbols;
            newLists.default.updatedAt = Date.now();
          } else if (!list.isDefault) {
            newLists[id] = list;
          }
        });
      }

      localStorageManager.updateData('watchlists', 'lists', newLists);

      // Import settings if provided
      if (watchlistsData.settings) {
        this.updateSettings(watchlistsData.settings);
      }

      // Update subscriptions
      this.updatePriceSubscriptions();

      console.log('👁️ Watchlists imported successfully');
      return { success: true };

    } catch (error) {
      console.error('❌ Watchlists import failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Utility methods
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stopPriceUpdates();
    
    // Unsubscribe from all real-time updates
    this.subscribedSymbols.forEach(symbol => {
      chartDataService.unsubscribeFromRealTimeUpdates(symbol);
    });
    this.subscribedSymbols.clear();
    
    console.log('👁️ Watchlist service destroyed');
  }
}

// Singleton instance
const watchlistService = new WatchlistService();

export { WatchlistService, watchlistService };
export default watchlistService;