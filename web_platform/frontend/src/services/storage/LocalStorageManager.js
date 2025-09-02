/**
 * LocalStorage Manager - مدیریت ذخیره‌سازی محلی
 * Complete LocalStorage management for user data
 */

class LocalStorageManager {
  constructor(namespace = 'iran_market') {
    this.namespace = namespace;
    this.version = '1.0.0';
    this.initializeStorage();
  }

  /**
   * Initialize storage structure
   */
  initializeStorage() {
    const storageStructure = {
      version: this.version,
      user: {
        preferences: {},
        settings: {},
        theme: 'dark'
      },
      portfolio: {
        positions: [],
        transactions: [],
        totalValue: 0,
        totalReturn: 0,
        lastUpdated: null
      },
      watchlists: {
        default: [],
        custom: {}
      },
      alerts: {
        price: [],
        technical: [],
        news: []
      },
      charts: {
        saved: {},
        layouts: {},
        drawings: {},
        templates: {}
      },
      analysis: {
        saved: [],
        notes: {},
        screenshots: {}
      },
      cache: {
        symbols: {},
        lastUpdated: {}
      }
    };

    // Initialize if not exists
    if (!this.exists('storage_initialized')) {
      this.setData('storage', storageStructure);
      this.setData('storage_initialized', true);
      console.log('🗄️ LocalStorage initialized with structure');
    } else {
      this.migrateIfNeeded();
    }
  }

  /**
   * Generate full key with namespace
   */
  getKey(key) {
    return `${this.namespace}_${key}`;
  }

  /**
   * Check if key exists
   */
  exists(key) {
    return localStorage.getItem(this.getKey(key)) !== null;
  }

  /**
   * Get data from localStorage
   */
  getData(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(this.getKey(key));
      if (item === null) return defaultValue;
      
      const parsed = JSON.parse(item);
      
      // Check for expiration
      if (parsed && parsed._expires && Date.now() > parsed._expires) {
        this.removeData(key);
        return defaultValue;
      }
      
      return parsed && parsed._value !== undefined ? parsed._value : parsed;
    } catch (error) {
      console.error(`❌ LocalStorage read error for key "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * Set data to localStorage
   */
  setData(key, value, ttlMinutes = null) {
    let dataToStore = value;
    
    // Add expiration if TTL provided
    if (ttlMinutes) {
      dataToStore = {
        _value: value,
        _expires: Date.now() + (ttlMinutes * 60 * 1000),
        _created: Date.now()
      };
    }
    
    try {
      localStorage.setItem(this.getKey(key), JSON.stringify(dataToStore));
      return true;
    } catch (error) {
      console.error(`❌ LocalStorage write error for key "${key}":`, error);
      
      // Try to free up space
      if (error.name === 'QuotaExceededError') {
        this.cleanupExpiredItems();
        console.log('🧹 Cleaned up expired items, retrying...');
        
        try {
          localStorage.setItem(this.getKey(key), JSON.stringify(dataToStore));
          return true;
        } catch (retryError) {
          console.error('❌ LocalStorage still full after cleanup:', retryError);
          return false;
        }
      }
      
      return false;
    }
  }

  /**
   * Remove data from localStorage
   */
  removeData(key) {
    try {
      localStorage.removeItem(this.getKey(key));
      return true;
    } catch (error) {
      console.error(`❌ LocalStorage remove error for key "${key}":`, error);
      return false;
    }
  }

  /**
   * Update nested object data
   */
  updateData(key, path, value) {
    try {
      const currentData = this.getData(key, {});
      const pathArray = path.split('.');
      
      let current = currentData;
      for (let i = 0; i < pathArray.length - 1; i++) {
        if (!current[pathArray[i]]) {
          current[pathArray[i]] = {};
        }
        current = current[pathArray[i]];
      }
      
      current[pathArray[pathArray.length - 1]] = value;
      
      return this.setData(key, currentData);
    } catch (error) {
      console.error(`❌ LocalStorage update error for "${key}.${path}":`, error);
      return false;
    }
  }

  /**
   * Get nested object data
   */
  getNestedData(key, path, defaultValue = null) {
    try {
      const data = this.getData(key, {});
      const pathArray = path.split('.');
      
      let current = data;
      for (const pathPart of pathArray) {
        if (current && current[pathPart] !== undefined) {
          current = current[pathPart];
        } else {
          return defaultValue;
        }
      }
      
      return current;
    } catch (error) {
      console.error(`❌ LocalStorage nested read error for "${key}.${path}":`, error);
      return defaultValue;
    }
  }

  /**
   * Append to array
   */
  appendToArray(key, item, maxItems = null) {
    try {
      const currentArray = this.getData(key, []);
      
      if (!Array.isArray(currentArray)) {
        console.error(`❌ Key "${key}" is not an array`);
        return false;
      }
      
      currentArray.push({
        ...item,
        id: item.id || this.generateId(),
        createdAt: item.createdAt || Date.now(),
        updatedAt: Date.now()
      });
      
      // Limit array size if specified
      if (maxItems && currentArray.length > maxItems) {
        currentArray.splice(0, currentArray.length - maxItems);
      }
      
      return this.setData(key, currentArray);
    } catch (error) {
      console.error(`❌ LocalStorage append error for key "${key}":`, error);
      return false;
    }
  }

  /**
   * Remove from array by ID or condition
   */
  removeFromArray(key, condition) {
    try {
      const currentArray = this.getData(key, []);
      
      if (!Array.isArray(currentArray)) {
        console.error(`❌ Key "${key}" is not an array`);
        return false;
      }
      
      let filteredArray;
      
      if (typeof condition === 'function') {
        filteredArray = currentArray.filter(item => !condition(item));
      } else if (typeof condition === 'string' || typeof condition === 'number') {
        filteredArray = currentArray.filter(item => item.id !== condition);
      } else {
        console.error('❌ Invalid condition for removeFromArray');
        return false;
      }
      
      return this.setData(key, filteredArray);
    } catch (error) {
      console.error(`❌ LocalStorage remove from array error for key "${key}":`, error);
      return false;
    }
  }

  /**
   * Update array item
   */
  updateArrayItem(key, id, updates) {
    try {
      const currentArray = this.getData(key, []);
      
      if (!Array.isArray(currentArray)) {
        console.error(`❌ Key "${key}" is not an array`);
        return false;
      }
      
      const itemIndex = currentArray.findIndex(item => item.id === id);
      
      if (itemIndex === -1) {
        console.error(`❌ Item with id "${id}" not found in array "${key}"`);
        return false;
      }
      
      currentArray[itemIndex] = {
        ...currentArray[itemIndex],
        ...updates,
        updatedAt: Date.now()
      };
      
      return this.setData(key, currentArray);
    } catch (error) {
      console.error(`❌ LocalStorage update array item error for "${key}[${id}]":`, error);
      return false;
    }
  }

  /**
   * Search in data
   */
  searchData(key, searchTerm, searchFields = ['name', 'title', 'symbol']) {
    try {
      const data = this.getData(key, []);
      
      if (!Array.isArray(data)) {
        return [];
      }
      
      const term = searchTerm.toLowerCase();
      
      return data.filter(item => {
        return searchFields.some(field => {
          const value = item[field];
          return value && value.toString().toLowerCase().includes(term);
        });
      });
    } catch (error) {
      console.error(`❌ LocalStorage search error for key "${key}":`, error);
      return [];
    }
  }

  /**
   * Get storage statistics
   */
  getStorageStats() {
    try {
      let totalSize = 0;
      let itemCount = 0;
      const keys = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.namespace)) {
          const value = localStorage.getItem(key);
          totalSize += key.length + (value ? value.length : 0);
          itemCount++;
          keys.push(key.replace(`${this.namespace}_`, ''));
        }
      }
      
      // Estimate quota (usually 5-10MB)
      const quota = 5 * 1024 * 1024; // 5MB estimate
      const usagePercent = (totalSize / quota * 100).toFixed(2);
      
      return {
        totalSize,
        totalSizeFormatted: this.formatBytes(totalSize),
        itemCount,
        usagePercent: `${usagePercent}%`,
        quota: this.formatBytes(quota),
        keys,
        available: quota - totalSize,
        availableFormatted: this.formatBytes(quota - totalSize)
      };
    } catch (error) {
      console.error('❌ Error getting storage stats:', error);
      return null;
    }
  }

  /**
   * Clean up expired items
   */
  cleanupExpiredItems() {
    try {
      let cleanedCount = 0;
      const keysToRemove = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.namespace)) {
          try {
            const value = localStorage.getItem(key);
            if (value) {
              const parsed = JSON.parse(value);
              if (parsed && parsed._expires && Date.now() > parsed._expires) {
                keysToRemove.push(key);
              }
            }
          } catch (parseError) {
            // If can't parse, leave it alone
          }
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        cleanedCount++;
      });
      
      console.log(`🧹 Cleaned up ${cleanedCount} expired items`);
      return cleanedCount;
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      return 0;
    }
  }

  /**
   * Backup data to JSON
   */
  exportData() {
    try {
      const backup = {
        timestamp: Date.now(),
        version: this.version,
        data: {}
      };
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.namespace)) {
          const cleanKey = key.replace(`${this.namespace}_`, '');
          backup.data[cleanKey] = this.getData(cleanKey);
        }
      }
      
      return backup;
    } catch (error) {
      console.error('❌ Error exporting data:', error);
      return null;
    }
  }

  /**
   * Import data from JSON
   */
  importData(backup, overwrite = false) {
    try {
      if (!backup || !backup.data) {
        throw new Error('Invalid backup format');
      }
      
      let importedCount = 0;
      let skippedCount = 0;
      
      Object.entries(backup.data).forEach(([key, value]) => {
        if (overwrite || !this.exists(key)) {
          this.setData(key, value);
          importedCount++;
        } else {
          skippedCount++;
        }
      });
      
      console.log(`📥 Import complete: ${importedCount} imported, ${skippedCount} skipped`);
      
      return {
        success: true,
        imported: importedCount,
        skipped: skippedCount
      };
    } catch (error) {
      console.error('❌ Error importing data:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Clear all data
   */
  clearAll() {
    try {
      const keysToRemove = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.namespace)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      console.log(`🧹 Cleared ${keysToRemove.length} items from LocalStorage`);
      
      // Re-initialize
      this.initializeStorage();
      
      return keysToRemove.length;
    } catch (error) {
      console.error('❌ Error clearing storage:', error);
      return 0;
    }
  }

  /**
   * Migration for version updates
   */
  migrateIfNeeded() {
    const currentVersion = this.getNestedData('storage', 'version', '0.0.0');
    
    if (currentVersion !== this.version) {
      console.log(`🔄 Migrating from version ${currentVersion} to ${this.version}`);
      
      // Add migration logic here as needed
      this.updateData('storage', 'version', this.version);
      
      console.log('✅ Migration completed');
    }
  }

  /**
   * Utility methods
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Compatibility methods for setItem/getItem interface
   */
  setItem(key, value, ttlMinutes = null) {
    return this.setData(key, value, ttlMinutes);
  }

  getItem(key, defaultValue = null) {
    return this.getData(key, defaultValue);
  }

  removeItem(key) {
    return this.removeData(key);
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Debug methods
   */
  debugDump() {
    console.log('🐛 LocalStorage Debug Dump:');
    console.log('Stats:', this.getStorageStats());
    console.log('Storage Structure:', this.getData('storage'));
  }
}

// Singleton instance
const localStorageManager = new LocalStorageManager();

export { LocalStorageManager, localStorageManager };
export default localStorageManager;