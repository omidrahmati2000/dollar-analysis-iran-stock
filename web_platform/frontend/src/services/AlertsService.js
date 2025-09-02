/**
 * Alerts Service - سیستم هشدارهای محلی
 * Local alerts system without backend dependency
 */

import localStorageManager from './storage/LocalStorageManager';
import stockRepository from './repositories/StockRepository';
import TechnicalIndicators from '../components/Charts/TechnicalIndicators';

class AlertsService {
  constructor() {
    this.storageKey = 'alerts';
    this.checkInterval = null;
    this.checkFrequency = 30000; // 30 seconds
    this.isChecking = false;
    
    this.initializeAlerts();
    this.startAlertMonitoring();
  }

  /**
   * Initialize alerts structure
   */
  initializeAlerts() {
    const defaultAlerts = {
      price: [],
      technical: [],
      news: [], // For future use
      triggered: [],
      settings: {
        enabled: true,
        sound: true,
        desktop: true,
        checkFrequency: 30000,
        maxTriggeredHistory: 100
      }
    };

    if (!localStorageManager.exists('alerts_initialized')) {
      localStorageManager.setData('alerts', defaultAlerts);
      localStorageManager.setData('alerts_initialized', true);
      console.log('🚨 Alerts system initialized');
    }

    // Request notification permission
    this.requestNotificationPermission();
  }

  /**
   * Request notification permission
   */
  async requestNotificationPermission() {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        console.log('🔔 Notification permission:', permission);
      }
    }
  }

  /**
   * Create price alert
   */
  createPriceAlert(alertData) {
    const {
      symbol,
      condition, // 'above', 'below', 'crosses_above', 'crosses_below'
      value,
      message = '',
      oneTime = true,
      enabled = true
    } = alertData;

    if (!symbol || !condition || value === undefined) {
      throw new Error('Symbol, condition, and value are required');
    }

    const alert = {
      id: this.generateId(),
      type: 'price',
      symbol: symbol.toUpperCase(),
      condition,
      value: parseFloat(value),
      message: message || this.generateDefaultMessage('price', symbol, condition, value),
      oneTime,
      enabled,
      triggered: false,
      triggerCount: 0,
      lastTriggered: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      // State tracking for crosses
      lastPrice: null,
      crossDirection: null
    };

    return localStorageManager.appendToArray('alerts.price', alert);
  }

  /**
   * Create technical indicator alert
   */
  createTechnicalAlert(alertData) {
    const {
      symbol,
      indicator, // 'rsi', 'macd', 'sma', etc.
      condition, // 'above', 'below', 'crosses_above', 'crosses_below'
      value,
      parameters = {}, // indicator parameters like period
      timeframe = '1D',
      message = '',
      oneTime = true,
      enabled = true
    } = alertData;

    if (!symbol || !indicator || !condition || value === undefined) {
      throw new Error('Symbol, indicator, condition, and value are required');
    }

    const alert = {
      id: this.generateId(),
      type: 'technical',
      symbol: symbol.toUpperCase(),
      indicator,
      condition,
      value: parseFloat(value),
      parameters,
      timeframe,
      message: message || this.generateDefaultMessage('technical', symbol, condition, value, indicator),
      oneTime,
      enabled,
      triggered: false,
      triggerCount: 0,
      lastTriggered: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      // State tracking
      lastValue: null,
      crossDirection: null
    };

    return localStorageManager.appendToArray('alerts.technical', alert);
  }

  /**
   * Get all alerts
   */
  getAllAlerts() {
    const priceAlerts = localStorageManager.getNestedData('alerts', 'price', []);
    const technicalAlerts = localStorageManager.getNestedData('alerts', 'technical', []);
    
    return {
      price: priceAlerts,
      technical: technicalAlerts,
      total: priceAlerts.length + technicalAlerts.length,
      active: priceAlerts.filter(a => a.enabled).length + technicalAlerts.filter(a => a.enabled).length
    };
  }

  /**
   * Get alerts by symbol
   */
  getAlertsBySymbol(symbol) {
    const allAlerts = this.getAllAlerts();
    const upperSymbol = symbol.toUpperCase();
    
    return {
      price: allAlerts.price.filter(a => a.symbol === upperSymbol),
      technical: allAlerts.technical.filter(a => a.symbol === upperSymbol)
    };
  }

  /**
   * Update alert
   */
  updateAlert(alertId, updates) {
    const allAlerts = this.getAllAlerts();
    
    // Find in price alerts
    let found = allAlerts.price.find(a => a.id === alertId);
    if (found) {
      return localStorageManager.updateArrayItem('alerts.price', alertId, {
        ...updates,
        updatedAt: Date.now()
      });
    }
    
    // Find in technical alerts
    found = allAlerts.technical.find(a => a.id === alertId);
    if (found) {
      return localStorageManager.updateArrayItem('alerts.technical', alertId, {
        ...updates,
        updatedAt: Date.now()
      });
    }
    
    throw new Error('Alert not found');
  }

  /**
   * Delete alert
   */
  deleteAlert(alertId) {
    const allAlerts = this.getAllAlerts();
    
    // Try to remove from price alerts
    const priceAlert = allAlerts.price.find(a => a.id === alertId);
    if (priceAlert) {
      return localStorageManager.removeFromArray('alerts.price', alertId);
    }
    
    // Try to remove from technical alerts
    const technicalAlert = allAlerts.technical.find(a => a.id === alertId);
    if (technicalAlert) {
      return localStorageManager.removeFromArray('alerts.technical', alertId);
    }
    
    throw new Error('Alert not found');
  }

  /**
   * Toggle alert enabled/disabled
   */
  toggleAlert(alertId) {
    const allAlerts = this.getAllAlerts();
    
    let alert = allAlerts.price.find(a => a.id === alertId);
    if (alert) {
      return this.updateAlert(alertId, { enabled: !alert.enabled });
    }
    
    alert = allAlerts.technical.find(a => a.id === alertId);
    if (alert) {
      return this.updateAlert(alertId, { enabled: !alert.enabled });
    }
    
    throw new Error('Alert not found');
  }

  /**
   * Start alert monitoring
   */
  startAlertMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    const settings = this.getSettings();
    if (!settings.enabled) {
      console.log('🚨 Alert monitoring is disabled');
      return;
    }

    this.checkInterval = setInterval(() => {
      this.checkAlerts();
    }, settings.checkFrequency || this.checkFrequency);

    console.log(`🚨 Alert monitoring started (checking every ${settings.checkFrequency || this.checkFrequency}ms)`);
  }

  /**
   * Stop alert monitoring
   */
  stopAlertMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('🚨 Alert monitoring stopped');
    }
  }

  /**
   * Check all alerts
   */
  async checkAlerts() {
    if (this.isChecking) {
      return; // Prevent overlapping checks
    }

    this.isChecking = true;
    
    try {
      const settings = this.getSettings();
      if (!settings.enabled) {
        return;
      }

      const allAlerts = this.getAllAlerts();
      const activeAlerts = [
        ...allAlerts.price.filter(a => a.enabled && !a.triggered),
        ...allAlerts.technical.filter(a => a.enabled && !a.triggered)
      ];

      if (activeAlerts.length === 0) {
        return;
      }

      console.log(`🔍 Checking ${activeAlerts.length} active alerts...`);

      // Group alerts by symbol for efficient API calls
      const symbolGroups = {};
      activeAlerts.forEach(alert => {
        if (!symbolGroups[alert.symbol]) {
          symbolGroups[alert.symbol] = [];
        }
        symbolGroups[alert.symbol].push(alert);
      });

      // Check each symbol's alerts
      for (const [symbol, symbolAlerts] of Object.entries(symbolGroups)) {
        await this.checkSymbolAlerts(symbol, symbolAlerts);
      }

    } catch (error) {
      console.error('❌ Error checking alerts:', error);
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Check alerts for specific symbol
   */
  async checkSymbolAlerts(symbol, alerts) {
    try {
      // Get current market data
      const marketData = await stockRepository.getRealTimeData(symbol);
      const currentPrice = marketData.close;

      // Check price alerts
      const priceAlerts = alerts.filter(a => a.type === 'price');
      for (const alert of priceAlerts) {
        await this.checkPriceAlert(alert, currentPrice);
      }

      // Check technical alerts
      const technicalAlerts = alerts.filter(a => a.type === 'technical');
      if (technicalAlerts.length > 0) {
        await this.checkTechnicalAlerts(symbol, technicalAlerts);
      }

    } catch (error) {
      console.error(`❌ Error checking alerts for ${symbol}:`, error);
    }
  }

  /**
   * Check individual price alert
   */
  async checkPriceAlert(alert, currentPrice) {
    let shouldTrigger = false;
    let triggerMessage = alert.message;

    switch (alert.condition) {
      case 'above':
        shouldTrigger = currentPrice > alert.value;
        break;
      
      case 'below':
        shouldTrigger = currentPrice < alert.value;
        break;
      
      case 'crosses_above':
        if (alert.lastPrice !== null && alert.lastPrice <= alert.value && currentPrice > alert.value) {
          shouldTrigger = true;
          alert.crossDirection = 'up';
        }
        break;
      
      case 'crosses_below':
        if (alert.lastPrice !== null && alert.lastPrice >= alert.value && currentPrice < alert.value) {
          shouldTrigger = true;
          alert.crossDirection = 'down';
        }
        break;
    }

    // Update last price for cross detection
    alert.lastPrice = currentPrice;
    this.updateAlert(alert.id, { lastPrice: currentPrice });

    if (shouldTrigger) {
      await this.triggerAlert(alert, {
        currentPrice,
        message: triggerMessage.replace('{current_price}', this.formatPrice(currentPrice))
      });
    }
  }

  /**
   * Check technical indicator alerts
   */
  async checkTechnicalAlerts(symbol, alerts) {
    try {
      // Get historical data for calculations
      const historicalData = await stockRepository.getHistoricalData(symbol, {
        timeframe: alerts[0].timeframe,
        limit: 100
      });

      if (!historicalData || historicalData.length < 20) {
        console.warn(`⚠️ Insufficient data for technical alerts on ${symbol}`);
        return;
      }

      // Calculate indicators for each alert
      for (const alert of alerts) {
        await this.checkTechnicalAlert(alert, historicalData);
      }

    } catch (error) {
      console.error(`❌ Error checking technical alerts for ${symbol}:`, error);
    }
  }

  /**
   * Check individual technical alert
   */
  async checkTechnicalAlert(alert, historicalData) {
    try {
      let indicatorValues = [];
      let currentValue = null;

      // Calculate indicator based on type
      switch (alert.indicator.toLowerCase()) {
        case 'rsi':
          indicatorValues = TechnicalIndicators.RSI(historicalData, alert.parameters.period || 14);
          currentValue = indicatorValues[indicatorValues.length - 1];
          break;
        
        case 'sma':
          indicatorValues = TechnicalIndicators.SMA(historicalData, alert.parameters.period || 20);
          currentValue = indicatorValues[indicatorValues.length - 1];
          break;
        
        case 'ema':
          indicatorValues = TechnicalIndicators.EMA(historicalData, alert.parameters.period || 20);
          currentValue = indicatorValues[indicatorValues.length - 1];
          break;
        
        case 'macd':
          const macdData = TechnicalIndicators.MACD(historicalData);
          const lastMacd = macdData[macdData.length - 1];
          currentValue = lastMacd ? lastMacd.macd : null;
          break;
        
        default:
          console.warn(`⚠️ Unsupported indicator: ${alert.indicator}`);
          return;
      }

      if (currentValue === null || currentValue === undefined) {
        return;
      }

      // Check condition
      let shouldTrigger = false;

      switch (alert.condition) {
        case 'above':
          shouldTrigger = currentValue > alert.value;
          break;
        
        case 'below':
          shouldTrigger = currentValue < alert.value;
          break;
        
        case 'crosses_above':
          if (alert.lastValue !== null && alert.lastValue <= alert.value && currentValue > alert.value) {
            shouldTrigger = true;
            alert.crossDirection = 'up';
          }
          break;
        
        case 'crosses_below':
          if (alert.lastValue !== null && alert.lastValue >= alert.value && currentValue < alert.value) {
            shouldTrigger = true;
            alert.crossDirection = 'down';
          }
          break;
      }

      // Update last value
      alert.lastValue = currentValue;
      this.updateAlert(alert.id, { lastValue: currentValue });

      if (shouldTrigger) {
        await this.triggerAlert(alert, {
          currentValue,
          message: alert.message.replace('{current_value}', currentValue.toFixed(2))
        });
      }

    } catch (error) {
      console.error(`❌ Error checking technical alert ${alert.id}:`, error);
    }
  }

  /**
   * Trigger alert
   */
  async triggerAlert(alert, triggerData) {
    console.log(`🚨 Alert triggered: ${alert.symbol} - ${alert.message}`);

    const triggeredAlert = {
      ...alert,
      triggered: true,
      triggerCount: alert.triggerCount + 1,
      lastTriggered: Date.now(),
      triggerData
    };

    // Update the original alert
    this.updateAlert(alert.id, {
      triggered: alert.oneTime ? true : false, // Keep active if not one-time
      triggerCount: triggeredAlert.triggerCount,
      lastTriggered: triggeredAlert.lastTriggered
    });

    // Add to triggered history
    localStorageManager.appendToArray('alerts.triggered', triggeredAlert, 100);

    // Show notifications
    await this.showNotification(triggeredAlert);

    // Play sound if enabled
    const settings = this.getSettings();
    if (settings.sound) {
      this.playAlertSound();
    }

    // Dispatch custom event for UI updates
    window.dispatchEvent(new CustomEvent('alertTriggered', {
      detail: triggeredAlert
    }));
  }

  /**
   * Show notification
   */
  async showNotification(alert) {
    const settings = this.getSettings();
    
    if (!settings.desktop) {
      return;
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`Iran Market Alert - ${alert.symbol}`, {
        body: alert.message,
        icon: '/favicon.ico',
        tag: `alert_${alert.id}`,
        requireInteraction: true
      });
    }
  }

  /**
   * Play alert sound
   */
  playAlertSound() {
    try {
      // Create audio context for alert sound
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('⚠️ Could not play alert sound:', error);
    }
  }

  /**
   * Get triggered alerts history
   */
  getTriggeredAlerts(limit = 50) {
    const triggered = localStorageManager.getNestedData('alerts', 'triggered', []);
    return triggered
      .sort((a, b) => b.lastTriggered - a.lastTriggered)
      .slice(0, limit);
  }

  /**
   * Clear triggered alerts history
   */
  clearTriggeredHistory() {
    return localStorageManager.updateData('alerts', 'triggered', []);
  }

  /**
   * Alert settings
   */
  getSettings() {
    return localStorageManager.getNestedData('alerts', 'settings', {});
  }

  updateSettings(newSettings) {
    const currentSettings = this.getSettings();
    const updatedSettings = { ...currentSettings, ...newSettings };
    
    localStorageManager.updateData('alerts', 'settings', updatedSettings);
    
    // Restart monitoring if frequency changed
    if (newSettings.checkFrequency && newSettings.checkFrequency !== this.checkFrequency) {
      this.checkFrequency = newSettings.checkFrequency;
      this.startAlertMonitoring();
    }
    
    // Stop/start monitoring if enabled/disabled
    if (newSettings.enabled !== undefined) {
      if (newSettings.enabled) {
        this.startAlertMonitoring();
      } else {
        this.stopAlertMonitoring();
      }
    }
    
    return updatedSettings;
  }

  /**
   * Utility methods
   */
  generateDefaultMessage(type, symbol, condition, value, indicator = null) {
    if (type === 'price') {
      const conditionText = {
        'above': 'بالای',
        'below': 'زیر',
        'crosses_above': 'عبور به بالای',
        'crosses_below': 'عبور به زیر'
      };
      
      return `${symbol} ${conditionText[condition]} ${this.formatPrice(value)}`;
    }
    
    if (type === 'technical') {
      const conditionText = {
        'above': 'بالای',
        'below': 'زیر', 
        'crosses_above': 'عبور به بالای',
        'crosses_below': 'عبور به زیر'
      };
      
      return `${indicator.toUpperCase()} برای ${symbol} ${conditionText[condition]} ${value}`;
    }
    
    return `Alert for ${symbol}`;
  }

  formatPrice(price) {
    return new Intl.NumberFormat('fa-IR').format(Math.round(price));
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Bulk operations
   */
  createBulkAlerts(alertsData) {
    const results = [];
    
    alertsData.forEach(alertData => {
      try {
        if (alertData.type === 'price') {
          results.push({ success: true, alert: this.createPriceAlert(alertData) });
        } else if (alertData.type === 'technical') {
          results.push({ success: true, alert: this.createTechnicalAlert(alertData) });
        }
      } catch (error) {
        results.push({ success: false, error: error.message, data: alertData });
      }
    });
    
    return results;
  }

  deleteAllAlerts() {
    localStorageManager.updateData('alerts', 'price', []);
    localStorageManager.updateData('alerts', 'technical', []);
    console.log('🚨 All alerts deleted');
  }

  /**
   * Export/Import alerts
   */
  exportAlerts() {
    const alertsData = {
      ...this.getAllAlerts(),
      settings: this.getSettings(),
      triggered: this.getTriggeredAlerts(),
      exportDate: Date.now(),
      version: '1.0.0'
    };

    const blob = new Blob([JSON.stringify(alertsData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `alerts_export_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
    
    return alertsData;
  }

  importAlerts(alertsData, mergeMode = false) {
    try {
      if (!mergeMode) {
        this.deleteAllAlerts();
      }
      
      if (alertsData.price) {
        alertsData.price.forEach(alert => {
          if (!mergeMode || !this.getAllAlerts().price.find(a => a.id === alert.id)) {
            localStorageManager.appendToArray('alerts.price', alert);
          }
        });
      }
      
      if (alertsData.technical) {
        alertsData.technical.forEach(alert => {
          if (!mergeMode || !this.getAllAlerts().technical.find(a => a.id === alert.id)) {
            localStorageManager.appendToArray('alerts.technical', alert);
          }
        });
      }
      
      if (alertsData.settings) {
        this.updateSettings(alertsData.settings);
      }
      
      console.log('🚨 Alerts imported successfully');
      return { success: true };
      
    } catch (error) {
      console.error('❌ Alerts import failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stopAlertMonitoring();
    console.log('🚨 Alerts service destroyed');
  }
}

// Singleton instance
const alertsService = new AlertsService();

export { AlertsService, alertsService };
export default alertsService;