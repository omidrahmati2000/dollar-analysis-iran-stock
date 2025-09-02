/**
 * Portfolio Service - مدیریت پرتفوی محلی
 * Local portfolio management without backend
 */

import localStorageManager from './storage/LocalStorageManager';
import stockRepository from './repositories/StockRepository';

class PortfolioService {
  constructor() {
    this.storageKey = 'portfolio';
    this.initializePortfolio();
  }

  /**
   * Initialize portfolio structure
   */
  initializePortfolio() {
    const defaultPortfolio = {
      positions: [],
      transactions: [],
      watchlists: {
        default: [],
        custom: {}
      },
      settings: {
        baseCurrency: 'IRR',
        showUnrealizedPnL: true,
        groupBySector: false,
        sortBy: 'value' // value, quantity, pnl, alphabetical
      },
      statistics: {
        totalValue: 0,
        totalInvested: 0,
        totalReturn: 0,
        totalReturnPercent: 0,
        dayChange: 0,
        dayChangePercent: 0,
        bestPerformer: null,
        worstPerformer: null,
        lastUpdated: null
      }
    };

    if (!localStorageManager.exists('portfolio_initialized')) {
      localStorageManager.setData('portfolio', defaultPortfolio);
      localStorageManager.setData('portfolio_initialized', true);
      console.log('💼 Portfolio initialized');
    }
  }

  /**
   * Add position to portfolio
   */
  addPosition(positionData) {
    const {
      symbol,
      quantity,
      averagePrice,
      sector = null,
      notes = '',
      tags = []
    } = positionData;

    if (!symbol || !quantity || !averagePrice) {
      throw new Error('Symbol, quantity, and average price are required');
    }

    const position = {
      id: this.generateId(),
      symbol: symbol.toUpperCase(),
      quantity: parseFloat(quantity),
      averagePrice: parseFloat(averagePrice),
      currentPrice: parseFloat(averagePrice), // Will be updated with real prices
      sector,
      notes,
      tags,
      addedAt: Date.now(),
      updatedAt: Date.now(),
      // Calculated fields
      totalValue: parseFloat(quantity) * parseFloat(averagePrice),
      totalInvested: parseFloat(quantity) * parseFloat(averagePrice),
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
      dayChange: 0,
      dayChangePercent: 0
    };

    // Add transaction record
    this.addTransaction({
      type: 'buy',
      symbol: position.symbol,
      quantity: position.quantity,
      price: position.averagePrice,
      total: position.totalValue,
      fee: 0,
      notes: `Initial position: ${notes}`,
      date: Date.now()
    });

    return localStorageManager.appendToArray('portfolio.positions', position);
  }

  /**
   * Update position (buy more or sell)
   */
  updatePosition(positionId, transactionData) {
    const {
      type, // 'buy' or 'sell'
      quantity,
      price,
      fee = 0,
      notes = ''
    } = transactionData;

    const positions = this.getPositions();
    const positionIndex = positions.findIndex(p => p.id === positionId);

    if (positionIndex === -1) {
      throw new Error('Position not found');
    }

    const position = positions[positionIndex];
    const transactionQuantity = parseFloat(quantity);
    const transactionPrice = parseFloat(price);
    const transactionFee = parseFloat(fee);

    if (type === 'buy') {
      // Add to position
      const newTotalQuantity = position.quantity + transactionQuantity;
      const newTotalInvested = (position.quantity * position.averagePrice) + 
                              (transactionQuantity * transactionPrice) + transactionFee;
      
      position.averagePrice = newTotalInvested / newTotalQuantity;
      position.quantity = newTotalQuantity;
      position.totalInvested = newTotalInvested;
      
    } else if (type === 'sell') {
      // Reduce position
      if (transactionQuantity > position.quantity) {
        throw new Error('Cannot sell more than owned quantity');
      }
      
      position.quantity -= transactionQuantity;
      
      // If position becomes zero, we can remove it
      if (position.quantity <= 0) {
        return this.removePosition(positionId);
      }
    }

    position.updatedAt = Date.now();
    
    // Update the position
    localStorageManager.updateArrayItem('portfolio.positions', positionId, position);

    // Add transaction record
    this.addTransaction({
      type,
      positionId,
      symbol: position.symbol,
      quantity: transactionQuantity,
      price: transactionPrice,
      total: transactionQuantity * transactionPrice,
      fee: transactionFee,
      notes,
      date: Date.now()
    });

    return position;
  }

  /**
   * Remove position
   */
  removePosition(positionId) {
    return localStorageManager.removeFromArray('portfolio.positions', positionId);
  }

  /**
   * Get all positions
   */
  getPositions() {
    return localStorageManager.getNestedData('portfolio', 'positions', []);
  }

  /**
   * Get position by ID
   */
  getPosition(positionId) {
    const positions = this.getPositions();
    return positions.find(p => p.id === positionId) || null;
  }

  /**
   * Get position by symbol
   */
  getPositionBySymbol(symbol) {
    const positions = this.getPositions();
    return positions.find(p => p.symbol === symbol.toUpperCase()) || null;
  }

  /**
   * Add transaction record
   */
  addTransaction(transactionData) {
    const transaction = {
      id: this.generateId(),
      ...transactionData,
      createdAt: transactionData.date || Date.now()
    };

    return localStorageManager.appendToArray('portfolio.transactions', transaction, 1000); // Keep last 1000
  }

  /**
   * Get transactions
   */
  getTransactions(limit = 100) {
    const transactions = localStorageManager.getNestedData('portfolio', 'transactions', []);
    return transactions
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /**
   * Get transactions for specific symbol
   */
  getTransactionsBySymbol(symbol, limit = 50) {
    const transactions = this.getTransactions();
    return transactions
      .filter(t => t.symbol === symbol.toUpperCase())
      .slice(0, limit);
  }

  /**
   * Update positions with current market prices via REST API
   */
  async updatePortfolioWithMarketPrices() {
    const positions = this.getPositions();
    
    if (positions.length === 0) {
      return this.calculateStatistics();
    }

    console.log('💼 Updating portfolio with current market prices via REST API...');
    
    // Get current prices for all symbols using REST API
    const priceUpdates = await Promise.allSettled(
      positions.map(async (position) => {
        try {
          const realTimeData = await stockRepository.getRealTimeData(position.symbol);
          return {
            symbol: position.symbol,
            currentPrice: realTimeData.close,
            dayChange: realTimeData.change,
            dayChangePercent: realTimeData.changePercent
          };
        } catch (error) {
          console.warn(`⚠️ Failed to get REST API price for ${position.symbol}:`, error.message);
          return {
            symbol: position.symbol,
            currentPrice: position.currentPrice, // Keep old price
            dayChange: 0,
            dayChangePercent: 0
          };
        }
      })
    );

    // Update positions with new prices
    const updatedPositions = positions.map(position => {
      const priceUpdate = priceUpdates.find(p => 
        p.status === 'fulfilled' && p.value.symbol === position.symbol
      );

      if (priceUpdate) {
        const { currentPrice, dayChange, dayChangePercent } = priceUpdate.value;
        
        return {
          ...position,
          currentPrice,
          dayChange,
          dayChangePercent,
          totalValue: position.quantity * currentPrice,
          unrealizedPnL: (currentPrice - position.averagePrice) * position.quantity,
          unrealizedPnLPercent: ((currentPrice - position.averagePrice) / position.averagePrice) * 100,
          updatedAt: Date.now()
        };
      }

      return position;
    });

    // Save updated positions
    localStorageManager.updateData('portfolio', 'positions', updatedPositions);

    return this.calculateStatistics();
  }

  /**
   * Calculate portfolio statistics
   */
  calculateStatistics() {
    const positions = this.getPositions();
    
    if (positions.length === 0) {
      const emptyStats = {
        totalValue: 0,
        totalInvested: 0,
        totalReturn: 0,
        totalReturnPercent: 0,
        dayChange: 0,
        dayChangePercent: 0,
        bestPerformer: null,
        worstPerformer: null,
        lastUpdated: Date.now()
      };
      
      localStorageManager.updateData('portfolio', 'statistics', emptyStats);
      return emptyStats;
    }

    const stats = positions.reduce((acc, position) => {
      acc.totalValue += position.totalValue;
      acc.totalInvested += position.totalInvested;
      acc.totalReturn += position.unrealizedPnL;
      acc.dayChange += (position.dayChange * position.quantity);

      return acc;
    }, {
      totalValue: 0,
      totalInvested: 0,
      totalReturn: 0,
      dayChange: 0
    });

    stats.totalReturnPercent = stats.totalInvested > 0 ? 
      (stats.totalReturn / stats.totalInvested) * 100 : 0;
    
    stats.dayChangePercent = stats.totalValue > 0 ? 
      (stats.dayChange / stats.totalValue) * 100 : 0;

    // Find best and worst performers
    const sortedByPerformance = positions
      .filter(p => p.unrealizedPnLPercent !== undefined)
      .sort((a, b) => b.unrealizedPnLPercent - a.unrealizedPnLPercent);

    stats.bestPerformer = sortedByPerformance[0] || null;
    stats.worstPerformer = sortedByPerformance[sortedByPerformance.length - 1] || null;
    stats.lastUpdated = Date.now();

    // Save statistics
    localStorageManager.updateData('portfolio', 'statistics', stats);

    return stats;
  }

  /**
   * Get portfolio statistics
   */
  getStatistics() {
    return localStorageManager.getNestedData('portfolio', 'statistics', {});
  }

  /**
   * Get portfolio performance over time
   */
  getPerformanceHistory(days = 30) {
    // This would require historical data storage
    // For now, return mock data or calculate from transaction history
    const transactions = this.getTransactions();
    const cutoffDate = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    const recentTransactions = transactions.filter(t => t.createdAt >= cutoffDate);
    
    // Group by day and calculate cumulative values
    const performanceByDay = {};
    let cumulativeInvested = 0;
    
    recentTransactions
      .sort((a, b) => a.createdAt - b.createdAt)
      .forEach(transaction => {
        const dayKey = new Date(transaction.createdAt).toDateString();
        
        if (!performanceByDay[dayKey]) {
          performanceByDay[dayKey] = {
            date: dayKey,
            invested: cumulativeInvested,
            transactions: 0
          };
        }
        
        if (transaction.type === 'buy') {
          cumulativeInvested += transaction.total;
        } else if (transaction.type === 'sell') {
          cumulativeInvested -= transaction.total;
        }
        
        performanceByDay[dayKey].invested = cumulativeInvested;
        performanceByDay[dayKey].transactions++;
      });

    return Object.values(performanceByDay);
  }

  /**
   * Get sector allocation
   */
  getSectorAllocation() {
    const positions = this.getPositions();
    const sectorAllocation = {};
    
    positions.forEach(position => {
      const sector = position.sector || 'Other';
      if (!sectorAllocation[sector]) {
        sectorAllocation[sector] = {
          sector,
          value: 0,
          count: 0,
          percentage: 0
        };
      }
      
      sectorAllocation[sector].value += position.totalValue;
      sectorAllocation[sector].count += 1;
    });
    
    // Calculate percentages
    const totalValue = Object.values(sectorAllocation).reduce((sum, s) => sum + s.value, 0);
    
    Object.values(sectorAllocation).forEach(sector => {
      sector.percentage = totalValue > 0 ? (sector.value / totalValue) * 100 : 0;
    });
    
    return Object.values(sectorAllocation).sort((a, b) => b.value - a.value);
  }

  /**
   * Portfolio settings
   */
  getSettings() {
    return localStorageManager.getNestedData('portfolio', 'settings', {});
  }

  updateSettings(newSettings) {
    const currentSettings = this.getSettings();
    const updatedSettings = { ...currentSettings, ...newSettings };
    return localStorageManager.updateData('portfolio', 'settings', updatedSettings);
  }

  /**
   * Export portfolio data
   */
  exportPortfolio() {
    const portfolioData = {
      positions: this.getPositions(),
      transactions: this.getTransactions(),
      statistics: this.getStatistics(),
      settings: this.getSettings(),
      exportDate: Date.now(),
      version: '1.0.0'
    };

    const blob = new Blob([JSON.stringify(portfolioData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `portfolio_export_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    
    return portfolioData;
  }

  /**
   * Import portfolio data
   */
  importPortfolio(portfolioData, mergeMode = false) {
    try {
      if (!portfolioData || !portfolioData.positions) {
        throw new Error('Invalid portfolio data format');
      }

      if (mergeMode) {
        // Merge with existing data
        const existingPositions = this.getPositions();
        const newPositions = [...existingPositions, ...portfolioData.positions];
        localStorageManager.updateData('portfolio', 'positions', newPositions);
        
        if (portfolioData.transactions) {
          const existingTransactions = this.getTransactions();
          const newTransactions = [...existingTransactions, ...portfolioData.transactions];
          localStorageManager.updateData('portfolio', 'transactions', newTransactions);
        }
      } else {
        // Replace existing data
        localStorageManager.updateData('portfolio', 'positions', portfolioData.positions);
        
        if (portfolioData.transactions) {
          localStorageManager.updateData('portfolio', 'transactions', portfolioData.transactions);
        }
        
        if (portfolioData.settings) {
          localStorageManager.updateData('portfolio', 'settings', portfolioData.settings);
        }
      }

      // Recalculate statistics
      this.calculateStatistics();

      console.log('💼 Portfolio imported successfully');
      return { success: true };

    } catch (error) {
      console.error('❌ Portfolio import failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear all portfolio data
   */
  clearPortfolio() {
    localStorageManager.updateData('portfolio', 'positions', []);
    localStorageManager.updateData('portfolio', 'transactions', []);
    this.calculateStatistics();
    console.log('💼 Portfolio cleared');
  }

  /**
   * Utility methods
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('fa-IR', {
      style: 'currency',
      currency: 'IRR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  formatPercent(percent) {
    return new Intl.NumberFormat('fa-IR', {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(percent / 100);
  }
}

// Singleton instance
const portfolioService = new PortfolioService();

export { PortfolioService, portfolioService };
export default portfolioService;