/**
 * Services Index - تجمیع تمام سرویس‌ها
 * Central export point for all services
 */

// API Base Service
export { default as apiService, ApiService, ApiError } from './api/base';

// Repositories
export { default as stockRepository, StockRepository } from './repositories/StockRepository';
export { default as indicatorRepository, IndicatorRepository } from './repositories/IndicatorRepository';

// Services
export { default as chartDataService, ChartDataService } from './ChartDataService';

// Cache Management
export { 
  default as CacheManager, 
  getCacheManager, 
  clearAllCaches, 
  getGlobalCacheStats 
} from './cache/CacheManager';

// Service configuration
export const serviceConfig = {
  api: {
    baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
    timeout: 10000,
    retries: 3
  },
  websocket: {
    url: process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws',
    reconnectAttempts: 5,
    reconnectDelay: 1000
  },
  cache: {
    defaultTTL: 300, // 5 minutes
    maxEntries: 1000,
    cleanupInterval: 300000 // 5 minutes
  }
};

/**
 * Initialize all services
 */
export const initializeServices = async () => {
  console.log('🚀 Initializing Iran Market Services...');
  
  try {
    // Check API health
    const health = await apiService.healthCheck();
    console.log('✅ API Health Check:', health);
    
    // Initialize cache cleanup
    console.log('✅ Cache system initialized');
    
    // Log service configuration
    console.log('✅ Service Configuration:', {
      apiURL: serviceConfig.api.baseURL,
      wsURL: serviceConfig.websocket.url,
      cacheEnabled: true
    });
    
    return {
      success: true,
      timestamp: Date.now(),
      services: ['api', 'cache', 'repositories', 'websocket']
    };
    
  } catch (error) {
    console.warn('⚠️ Service initialization completed with warnings:', error.message);
    
    return {
      success: false,
      error: error.message,
      timestamp: Date.now()
    };
  }
};

/**
 * Health check for all services
 */
export const checkServicesHealth = async () => {
  const results = {};
  
  try {
    // API Health
    results.api = await apiService.healthCheck();
  } catch (error) {
    results.api = { status: 'error', message: error.message };
  }
  
  // Cache Health
  try {
    const cacheStats = getGlobalCacheStats();
    results.cache = { 
      status: 'healthy', 
      stats: cacheStats,
      hitRate: cacheStats.globalHitRate 
    };
  } catch (error) {
    results.cache = { status: 'error', message: error.message };
  }
  
  // Repository Health
  try {
    results.repositories = {
      stock: stockRepository.getCacheStats(),
      indicators: indicatorRepository ? 'initialized' : 'not available'
    };
  } catch (error) {
    results.repositories = { status: 'error', message: error.message };
  }
  
  return {
    timestamp: Date.now(),
    overall: Object.values(results).every(r => r.status !== 'error') ? 'healthy' : 'degraded',
    services: results
  };
};

/**
 * Performance monitoring
 */
export const getPerformanceMetrics = () => {
  const cacheStats = getGlobalCacheStats();
  
  return {
    timestamp: Date.now(),
    cache: {
      totalEntries: cacheStats.totalSize,
      hitRate: cacheStats.globalHitRate,
      totalRequests: cacheStats.totalHits + cacheStats.totalMisses,
      namespaces: cacheStats.namespaces.length
    },
    memory: {
      // Rough estimation of cache memory usage
      estimatedCacheSize: cacheStats.namespaces.reduce((total, ns) => {
        return total + parseInt(ns.memoryUsage) || 0;
      }, 0)
    },
    performance: {
      // Navigation timing if available
      ...(window.performance && window.performance.timing ? {
        pageLoadTime: window.performance.timing.loadEventEnd - window.performance.timing.navigationStart,
        domReadyTime: window.performance.timing.domContentLoadedEventEnd - window.performance.timing.navigationStart
      } : {})
    }
  };
};

/**
 * Cleanup all services
 */
export const cleanupServices = () => {
  console.log('🧹 Cleaning up Iran Market Services...');
  
  try {
    // Cleanup chart data service
    if (chartDataService && typeof chartDataService.destroy === 'function') {
      chartDataService.destroy();
    }
    
    // Clear all caches
    clearAllCaches();
    
    console.log('✅ Services cleaned up successfully');
    
  } catch (error) {
    console.error('❌ Error during service cleanup:', error);
  }
};

// Export everything as default for easier importing
export default {
  // Services
  apiService,
  stockRepository,
  indicatorRepository,
  chartDataService,
  
  // Cache
  CacheManager,
  getCacheManager,
  clearAllCaches,
  getGlobalCacheStats,
  
  // Utilities
  serviceConfig,
  initializeServices,
  checkServicesHealth,
  getPerformanceMetrics,
  cleanupServices
};